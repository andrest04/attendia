import { createDrainOneClearBatch } from '../notificationsMaintenance';
import { NotificationsDatabase } from '../notificationsTypes';

const timestamp = (ms: number) => ({ toMillis: () => ms });

type QueryState = {
  path: string;
  field: string;
  direction: 'asc' | 'desc';
  after?: string;
  size?: number;
};

const makeDb = () => {
  const values = new Map<string, any>();
  let crash: 'before' | 'after' | undefined;
  const snapshot = (path: string) => ({
    exists: values.has(path),
    id: path.split('/').pop(),
    data: () => values.get(path),
  });
  const query = (state: QueryState): any => ({
    state,
    orderBy: (field: string, direction: 'asc' | 'desc') => query({ ...state, field, direction }),
    startAfter: (after: string) => query({ ...state, after }),
    limit: (size: number) => query({ ...state, size }),
  });
  const collection = (path: string): any => ({
    doc: (id: string) => ref(`${path}/${id}`),
    orderBy: (field: string, direction: 'asc' | 'desc') => query({ path, field, direction }),
  });
  const ref = (path: string): any => ({
    path,
    collection: (name: string) => collection(`${path}/${name}`),
    get: async () => snapshot(path),
  });
  const querySnapshot = (state: QueryState) => {
    const prefix = `${state.path}/`;
    let docs = Array.from(values.keys())
      .filter(path => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
      .map(path => snapshot(path));
    const value = (doc: any) => state.field === '__name__'
      ? doc.id
      : (doc.data() || {})[state.field].toMillis();
    docs.sort((left, right) => {
      const compared = value(left) < value(right) ? -1 : value(left) > value(right) ? 1 : 0;
      return state.direction === 'asc' ? compared : -compared;
    });
    if (state.after !== undefined) docs = docs.filter(doc => doc.id! > state.after!);
    return { docs: state.size === undefined ? docs : docs.slice(0, state.size) };
  };
  let tail = Promise.resolve();
  const runTransaction = (work: any) => {
    const result = tail.then(async () => {
      const writes: Array<() => void> = [];
      const transaction = {
        get: async (target: any) => target.state ? querySnapshot(target.state) : snapshot(target.path),
        create: (document: any, value: any) => writes.push(() => values.set(document.path, value)),
        update: (document: any, value: any) => writes.push(() => values.set(document.path, {
          ...values.get(document.path), ...value,
        })),
        delete: (document: any) => writes.push(() => values.delete(document.path)),
      };
      const output = await work(transaction);
      if (crash === 'before') {
        crash = undefined;
        throw new Error('crash before commit');
      }
      writes.forEach(write => write());
      if (crash === 'after') {
        crash = undefined;
        throw new Error('ambiguous committed response');
      }
      return output;
    });
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
  return {
    db: ({ collection: (name: string) => collection(name), runTransaction } as unknown) as NotificationsDatabase,
    values,
    setCrash: (value: 'before' | 'after') => { crash = value; },
  };
};

const jobPath = (generation: number) => `users/teacher-1/notificationClearJobs/${generation}`;
const itemPath = (generation: number, id: string) =>
  `users/teacher-1/notificationGenerations/${generation}/items/${id}`;
const seedJob = (f: ReturnType<typeof makeDb>, generation: number, createdAt: number, nextAfterId: string | null = null) => {
  f.values.set(jobPath(generation), {
    retiredGeneration: generation, nextAfterId, batchSize: 100, status: 'pending',
    createdAt: timestamp(createdAt), updatedAt: timestamp(createdAt), deletedCount: 0,
  });
};
const seedItems = (f: ReturnType<typeof makeDb>, generation: number, count: number) => {
  for (let number = 1; number <= count; number += 1) {
    const id = `id-${String(number).padStart(3, '0')}`;
    f.values.set(itemPath(generation, id), { ownerUid: 'teacher-1' });
  }
};

describe('transactional notification clear drain', () => {
  it('deletes one fixed-size ID batch with cursor/count atomically and never changes current state', async () => {
    const f = makeDb();
    seedJob(f, 3, 10);
    seedItems(f, 3, 101);
    f.values.set('users/teacher-1/notificationState/inbox', { currentGeneration: 4, unreadCount: 7 });
    const drain = createDrainOneClearBatch(f.db, () => timestamp(50));

    await drain('teacher-1');

    expect(Array.from(f.values.keys()).filter(path => path.includes('/3/items/'))).toEqual([itemPath(3, 'id-101')]);
    expect(f.values.get(jobPath(3))).toEqual(expect.objectContaining({ nextAfterId: 'id-100', deletedCount: 100 }));
    expect(f.values.get('users/teacher-1/notificationState/inbox')).toEqual({ currentGeneration: 4, unreadCount: 7 });
    await drain('teacher-1');
    expect(f.values.has(jobPath(3))).toBe(false);
    expect(f.values.has(itemPath(3, 'id-101'))).toBe(false);
  });

  it('selects the oldest job, tolerates missing IDs, and advances later work fairly', async () => {
    const f = makeDb();
    seedJob(f, 4, 20, 'id-050');
    seedJob(f, 3, 10);
    f.values.set(itemPath(3, 'id-002'), {});
    f.values.set(itemPath(4, 'id-051'), {});
    const drain = createDrainOneClearBatch(f.db, () => timestamp(60));

    await drain('teacher-1');
    expect(f.values.has(jobPath(3))).toBe(false);
    expect(f.values.has(jobPath(4))).toBe(true);
    await drain('teacher-1');
    expect(f.values.has(jobPath(4))).toBe(false);
  });

  it('rolls back a pre-commit crash and safely continues after an ambiguous committed response', async () => {
    const f = makeDb();
    seedJob(f, 3, 10);
    seedItems(f, 3, 101);
    const drain = createDrainOneClearBatch(f.db, () => timestamp(70));

    f.setCrash('before');
    await expect(drain('teacher-1')).rejects.toThrow('crash before commit');
    expect(Array.from(f.values.keys()).filter(path => path.includes('/3/items/'))).toHaveLength(101);
    expect(f.values.get(jobPath(3)).deletedCount).toBe(0);

    f.setCrash('after');
    await expect(drain('teacher-1')).rejects.toThrow('ambiguous committed response');
    expect(f.values.get(jobPath(3)).deletedCount).toBe(100);
    await drain('teacher-1');
    expect(f.values.has(jobPath(3))).toBe(false);
  });

  it('serializes multi-device drainers and resumes durable work after a scale-to-zero gap', async () => {
    const f = makeDb();
    seedJob(f, 3, 10);
    seedItems(f, 3, 201);
    const firstProcess = createDrainOneClearBatch(f.db, () => timestamp(80));

    await Promise.all([firstProcess('teacher-1'), firstProcess('teacher-1')]);
    expect(f.values.get(jobPath(3)).deletedCount).toBe(200);
    expect(f.values.has(itemPath(3, 'id-201'))).toBe(true);

    const restartedProcess = createDrainOneClearBatch(f.db, () => timestamp(90));
    await restartedProcess('teacher-1');
    expect(f.values.has(jobPath(3))).toBe(false);
    expect(Array.from(f.values.keys()).filter(path => path.includes('/3/items/'))).toHaveLength(0);
  });
});
