import {
  canonicalNotificationId,
  createClearNotificationsHandler,
  createGetNotificationsHandler,
  createMarkAllNotificationsReadHandler,
  createPatchNotificationReadHandler,
  persistCanonicalNotification,
} from '../notifications';
import { NotificationsDatabase } from '../notificationsTypes';

const timestamp = (ms: number) => ({ toMillis: () => ms });
const makeRes = (uid = 'teacher-1') => {
  const res: any = { locals: { firebaseUser: { uid } } };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
};

const makeDb = () => {
  const profileGet = jest.fn();
  const stateGet = jest.fn();
  const itemsGet = jest.fn();
  const query: any = {
    orderBy: jest.fn(() => query),
    startAfter: jest.fn(() => query),
    limit: jest.fn(() => query),
    get: itemsGet,
  };
  const itemsCollection = { orderBy: query.orderBy };
  const generationDoc = jest.fn(() => ({ collection: jest.fn(() => itemsCollection) }));
  const stateDoc = jest.fn(() => ({ get: stateGet }));
  const userCollection = jest.fn((name: string) =>
    name === 'notificationState' ? { doc: stateDoc } : { doc: generationDoc }
  );
  const userDoc = jest.fn(() => ({ get: profileGet, collection: userCollection }));
  const collection = jest.fn(() => ({ doc: userDoc }));
  return {
    db: ({ collection } as unknown) as NotificationsDatabase,
    profileGet,
    stateGet,
    itemsGet,
    query,
    userDoc,
    userCollection,
    generationDoc,
  };
};

const item = (id: string, occurrence: number, created: number, readAt: number | null = null) => ({
  id,
  data: () => ({
    notificationId: id,
    ownerUid: 'teacher-1',
    eventType: 'class.upcoming',
    eventKey: `class:${id}:upcoming`,
    source: { kind: 'class', classId: id },
    eventOccurrenceAt: timestamp(occurrence),
    createdAt: timestamp(created),
    readAt: readAt === null ? null : timestamp(readAt),
    title: `Class ${id}`,
    message: 'Starts soon',
    destination: { kind: 'classes' },
  }),
});

const teacher = { exists: true, data: () => ({ role: 'teacher' }) };
const state = (generation = 3, unreadCount = 14, readBefore: number | null = null) => ({
  exists: true,
  data: () => ({ currentGeneration: generation, unreadCount, readBefore: readBefore === null ? null : timestamp(readBefore) }),
});

const makeMemoryDb = () => {
  const values = new Map<string, any>();
  const ref = (path: string): any => ({
    path,
    collection: (name: string) => ({ doc: (id: string) => ref(`${path}/${name}/${id}`) }),
    get: async () => snapshot(path),
  });
  const snapshot = (path: string) => ({
    exists: values.has(path),
    id: path.split('/').pop(),
    data: () => values.get(path),
  });
  const transaction = {
    get: jest.fn(async (document: any) => snapshot(document.path)),
    create: jest.fn((document: any, value: any) => {
      if (values.has(document.path)) throw new Error('already exists');
      values.set(document.path, value);
    }),
    update: jest.fn((document: any, value: any) => {
      if (!values.has(document.path)) throw new Error('document does not exist');
      values.set(document.path, { ...values.get(document.path), ...value });
    }),
  };
  let transactionTail = Promise.resolve();
  const runTransaction = (work: any) => {
    const result = transactionTail.then(() => work(transaction));
    transactionTail = result.then(() => undefined, () => undefined);
    return result;
  };
  return {
    db: ({
      collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
      runTransaction,
    } as unknown) as NotificationsDatabase,
    values,
    transaction,
  };
};

const candidate = (overrides: any = {}) => ({
  eventType: 'class.upcoming',
  eventKey: 'class:class-1:upcoming',
  source: { kind: 'class', classId: 'class-1' },
  eventOccurrenceAt: timestamp(100),
  title: 'Class soon',
  message: 'Starts in 15 minutes',
  destination: { kind: 'classes' },
  ...overrides,
});

describe('GET /notifications', () => {
  it('authorizes from the verified UID and ignores cross-UID client claims', async () => {
    const f = makeDb();
    f.profileGet.mockResolvedValue(teacher);
    f.stateGet.mockResolvedValue(state());
    f.itemsGet.mockResolvedValue({ docs: [] });
    const res = makeRes();

    await createGetNotificationsHandler(f.db)({ query: { uid: 'other-teacher' } } as any, res, jest.fn());

    expect(f.userDoc).toHaveBeenCalledWith('teacher-1');
    expect(f.userDoc).not.toHaveBeenCalledWith('other-teacher');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ items: [], unreadCount: 14, nextCursor: null, hasMore: false });
  });

  it('rejects missing authentication and a trusted non-teacher before inbox access', async () => {
    const f = makeDb();
    const handler = createGetNotificationsHandler(f.db);
    const unauthenticated = makeRes();
    unauthenticated.locals = {};
    await handler({ query: {} } as any, unauthenticated, jest.fn());
    expect(unauthenticated.status).toHaveBeenCalledWith(401);

    f.profileGet.mockResolvedValue({ exists: true, data: () => ({ role: 'student' }) });
    const student = makeRes('student-1');
    await handler({ query: {} } as any, student, jest.fn());
    expect(student.status).toHaveBeenCalledWith(403);
    expect(f.stateGet).not.toHaveBeenCalled();
  });

  it('returns the current generation newest 10, global count, and effective read projection', async () => {
    const f = makeDb();
    f.profileGet.mockResolvedValue(teacher);
    f.stateGet.mockResolvedValue(state(3, 14, 995));
    f.itemsGet.mockResolvedValue({ docs: Array.from({ length: 11 }, (_, n) => item(`id-${20 - n}`, 2000 - n, 1000 - n)) });
    const res = makeRes();

    await createGetNotificationsHandler(f.db)({ query: {} } as any, res, jest.fn());

    expect(f.generationDoc).toHaveBeenCalledWith('3');
    expect(f.query.orderBy.mock.calls).toEqual([
      ['eventOccurrenceAt', 'desc'],
      ['createdAt', 'desc'],
      ['__name__', 'desc'],
    ]);
    expect(f.query.limit).toHaveBeenCalledWith(11);
    const body = res.json.mock.calls[0][0];
    expect(body.items).toHaveLength(10);
    expect(body.items[0]).toEqual(expect.objectContaining({ notificationId: 'id-20', readAtMs: null }));
    expect(body.items[9]).toEqual(expect.objectContaining({ notificationId: 'id-11', readAtMs: 995 }));
    expect(body).toEqual(expect.objectContaining({ unreadCount: 14, hasMore: true }));
    expect(typeof body.nextCursor).toBe('string');
  });

  it('continues from an opaque boundary when a newer item arrives between pages', async () => {
    const first = makeDb();
    first.profileGet.mockResolvedValue(teacher);
    first.stateGet.mockResolvedValue(state());
    first.itemsGet.mockResolvedValue({ docs: Array.from({ length: 11 }, (_, n) => item(`id-${20 - n}`, 2000 - n, 1000 - n)) });
    const firstRes = makeRes();
    await createGetNotificationsHandler(first.db)({ query: {} } as any, firstRes, jest.fn());
    const cursor = firstRes.json.mock.calls[0][0].nextCursor;

    const second = makeDb();
    second.profileGet.mockResolvedValue(teacher);
    second.stateGet.mockResolvedValue(state());
    second.itemsGet.mockResolvedValue({ docs: [item('id-10', 1990, 990)] });
    const secondRes = makeRes();
    await createGetNotificationsHandler(second.db)({ query: { cursor } } as any, secondRes, jest.fn());

    const boundary = second.query.startAfter.mock.calls[0];
    expect([boundary[0].getTime(), boundary[1].getTime(), boundary[2]]).toEqual([1991, 991, 'id-11']);
    expect(secondRes.json.mock.calls[0][0].items.map((value: any) => value.notificationId)).toEqual(['id-10']);
  });

  it('rejects malformed and retired-generation cursors', async () => {
    const malformed = makeDb();
    malformed.profileGet.mockResolvedValue(teacher);
    malformed.stateGet.mockResolvedValue(state());
    const malformedRes = makeRes();
    await createGetNotificationsHandler(malformed.db)({ query: { cursor: 'not-a-cursor' } } as any, malformedRes, jest.fn());
    expect(malformedRes.status).toHaveBeenCalledWith(400);
    expect(malformed.itemsGet).not.toHaveBeenCalled();

    const old = Buffer.from(JSON.stringify({ generation: 2, eventOccurrenceAtMs: 1, createdAtMs: 1, id: 'id-1' })).toString('base64url');
    const stale = makeDb();
    stale.profileGet.mockResolvedValue(teacher);
    stale.stateGet.mockResolvedValue(state(3));
    const staleRes = makeRes();
    await createGetNotificationsHandler(stale.db)({ query: { cursor: old } } as any, staleRes, jest.fn());
    expect(staleRes.status).toHaveBeenCalledWith(409);
    expect(staleRes.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ message: 'stale_cursor' }) }));
  });

  it('refreshes the global count and invokes one bounded-maintenance seam after success', async () => {
    const f = makeDb();
    f.profileGet.mockResolvedValue(teacher);
    f.stateGet.mockResolvedValueOnce(state(3, 8)).mockResolvedValueOnce(state(3, 5));
    f.itemsGet.mockResolvedValue({ docs: [item('id-1', 1, 1)] });
    const maintenance = jest.fn(() => Promise.resolve());
    const handler = createGetNotificationsHandler(f.db, maintenance);
    const first = makeRes();
    const refreshed = makeRes();

    await handler({ query: {} } as any, first, jest.fn());
    await handler({ query: {} } as any, refreshed, jest.fn());

    expect(first.json.mock.calls[0][0].unreadCount).toBe(8);
    expect(refreshed.json.mock.calls[0][0].unreadCount).toBe(5);
    expect(maintenance.mock.calls).toEqual([['teacher-1'], ['teacher-1']]);
  });
});

describe('canonical notification persistence', () => {
  it('derives deterministic IDs only for all five exact canonical event-key shapes', () => {
    const cases: Array<[string, string]> = [
      ['class.upcoming', 'class:class_1:upcoming'], ['class.not_started', 'class:class_1:not-started'],
      ['recording.ready', 'recording:req-1:ready'], ['recording.failed', 'recording:req-1:failed'],
      ['report.save_failed', 'report:report-1:save-failed:episode-1'],
    ];
    for (const [eventType, eventKey] of cases) {
      expect(canonicalNotificationId(eventType as any, eventKey)).toMatch(/^[a-f0-9]{64}$/);
      expect(canonicalNotificationId(eventType as any, eventKey)).toBe(canonicalNotificationId(eventType as any, eventKey));
    }
    expect(() => canonicalNotificationId('class.upcoming', 'class:class-1:not-started')).toThrow('invalid canonical event key');
    expect(() => canonicalNotificationId('recording.ready', 'recording::ready')).toThrow('invalid canonical event key');
    expect(() => canonicalNotificationId('unknown' as any, 'class:class-1:upcoming')).toThrow('invalid canonical event key');
  });

  it('rejects a canonical key whose trusted source identity does not match', async () => {
    const f = makeMemoryDb();
    f.values.set('users/teacher-1/notificationState/inbox', { currentGeneration: 3, unreadCount: 0 });
    await expect(persistCanonicalNotification(f.db, 'teacher-1', candidate({
      eventType: 'recording.ready',
      eventKey: 'recording:req-1:ready',
      source: { kind: 'class', classId: 'req-1' },
    }), timestamp(200))).rejects.toThrow('invalid canonical source');
    expect(f.transaction.create).not.toHaveBeenCalled();
  });

  it('creates once, preserves immutable canonical fields on replay, and rejects collisions', async () => {
    const f = makeMemoryDb();
    f.values.set('users/teacher-1/notificationState/inbox', { currentGeneration: 3, unreadCount: 0 });
    const first = await persistCanonicalNotification(f.db, 'teacher-1', candidate(), timestamp(200));
    const replay = await persistCanonicalNotification(f.db, 'teacher-1', candidate(), timestamp(300));
    const path = `users/teacher-1/notificationGenerations/3/items/${first.notificationId}`;

    expect(replay).toEqual(first);
    expect(f.values.get(path)).toEqual(expect.objectContaining({
      notificationId: first.notificationId,
      ownerUid: 'teacher-1',
      eventKey: 'class:class-1:upcoming',
      readAt: null,
    }));
    expect(f.values.get(path).createdAt.toMillis()).toBe(200);
    expect(f.values.get('users/teacher-1/notificationState/inbox').unreadCount).toBe(1);
    await expect(persistCanonicalNotification(f.db, 'teacher-1', candidate({ title: 'Tampered' }), timestamp(400)))
      .rejects.toThrow('immutable canonical mismatch');
    f.values.get(path).eventKey = 'class:collision:upcoming';
    await expect(persistCanonicalNotification(f.db, 'teacher-1', candidate(), timestamp(500)))
      .rejects.toThrow('notification collision');
  });
});

describe('PATCH /notifications/:id/read', () => {
  const seed = (f: ReturnType<typeof makeMemoryDb>, readBefore: number | null = null) => {
    const notificationId = canonicalNotificationId('class.upcoming', 'class:class-1:upcoming');
    f.values.set('users/teacher-1', { role: 'teacher' });
    f.values.set('users/teacher-1/notificationState/inbox', {
      currentGeneration: 3,
      unreadCount: readBefore === null ? 2 : 0,
      readBefore: readBefore === null ? null : timestamp(readBefore),
    });
    f.values.set(`users/teacher-1/notificationGenerations/3/items/${notificationId}`, {
      notificationId,
      ownerUid: 'teacher-1',
      ...candidate(),
      createdAt: timestamp(100),
      readAt: null,
    });
    return notificationId;
  };

  it('uses the verified teacher/current generation and ignores destination, UID, and client time', async () => {
    const f = makeMemoryDb();
    const id = seed(f);
    const maintenance = jest.fn(async () => undefined);
    const handler = createPatchNotificationReadHandler(f.db, () => timestamp(999), maintenance);
    const body = { uid: 'other-teacher', destination: { kind: 'recording', roomSid: 'evil' }, readAt: 1 };
    const first = makeRes();
    const retry = makeRes();

    await handler({ params: { id }, body } as any, first, jest.fn());
    await handler({ params: { id }, body } as any, retry, jest.fn());

    expect(first.status).toHaveBeenCalledWith(200);
    expect(first.json.mock.calls[0][0]).toEqual(expect.objectContaining({
      unreadCount: 1,
      notification: expect.objectContaining({ readAtMs: 999, destination: { kind: 'classes' } }),
    }));
    expect(retry.json.mock.calls[0][0]).toEqual(first.json.mock.calls[0][0]);
    expect(f.values.get('users/teacher-1/notificationState/inbox').unreadCount).toBe(1);
    expect(maintenance.mock.calls).toEqual([['teacher-1'], ['teacher-1']]);
  });

  it('projects read-before atomically without decrementing and converges on refresh', async () => {
    const f = makeMemoryDb();
    const id = seed(f, 150);
    const res = makeRes();

    await createPatchNotificationReadHandler(f.db, () => timestamp(999))(
      { params: { id }, body: { readAt: 999999 } } as any,
      res,
      jest.fn()
    );

    expect(res.json.mock.calls[0][0]).toEqual(expect.objectContaining({
      unreadCount: 0,
      notification: expect.objectContaining({ readAtMs: 150 }),
    }));
    expect(f.transaction.update).not.toHaveBeenCalled();
  });

  it('rejects malformed IDs, non-teachers, and rows outside the current generation', async () => {
    const malformed = makeMemoryDb();
    seed(malformed);
    const malformedRes = makeRes();
    await createPatchNotificationReadHandler(malformed.db, () => timestamp(999))(
      { params: { id: '../old' }, body: {} } as any, malformedRes, jest.fn());
    expect(malformedRes.status).toHaveBeenCalledWith(400);

    const student = makeMemoryDb();
    const studentId = seed(student);
    student.values.set('users/teacher-1', { role: 'student' });
    const studentRes = makeRes();
    await createPatchNotificationReadHandler(student.db, () => timestamp(999))(
      { params: { id: studentId }, body: {} } as any, studentRes, jest.fn());
    expect(studentRes.status).toHaveBeenCalledWith(403);

    const retired = makeMemoryDb();
    const retiredId = seed(retired);
    retired.values.get('users/teacher-1/notificationState/inbox').currentGeneration = 4;
    const retiredRes = makeRes();
    await createPatchNotificationReadHandler(retired.db, () => timestamp(999))(
      { params: { id: retiredId }, body: {} } as any, retiredRes, jest.fn());
    expect(retiredRes.status).toHaveBeenCalledWith(404);
  });
});

describe('POST /notifications/mark-all-read', () => {
  const seedState = (f: ReturnType<typeof makeMemoryDb>, unreadCount = 0) => {
    f.values.set('users/teacher-1', { role: 'teacher' });
    f.values.set('users/teacher-1/notificationState/inbox', {
      currentGeneration: 3,
      unreadCount,
      readBefore: null,
    });
  };
  const request = (idempotencyKey?: string, body: any = {}) => ({
    headers: idempotencyKey === undefined ? {} : { 'idempotency-key': idempotencyKey },
    body,
  } as any);

  it('requires a bounded key and trusted teacher without accepting a client UID', async () => {
    const f = makeMemoryDb();
    seedState(f, 2);
    const handler = createMarkAllNotificationsReadHandler(f.db, () => timestamp(500));
    const missing = makeRes();
    const oversized = makeRes();
    const student = makeRes();

    await handler(request(undefined), missing, jest.fn());
    await handler(request('x'.repeat(129)), oversized, jest.fn());
    f.values.set('users/teacher-1', { role: 'student' });
    await handler(request('student-request', { uid: 'teacher-1' }), student, jest.fn());

    expect(missing.status).toHaveBeenCalledWith(400);
    expect(oversized.status).toHaveBeenCalledWith(400);
    expect(student.status).toHaveBeenCalledWith(403);
    expect(f.values.has('users/teacher-1/notificationOperations/student-request')).toBe(false);
  });

  it('commits one accepted boundary and durable receipt covering earlier creation', async () => {
    const f = makeMemoryDb();
    seedState(f);
    await persistCanonicalNotification(f.db, 'teacher-1', candidate(), timestamp(100));
    const maintenance = jest.fn(async () => undefined);
    const serverTime = jest.fn(() => timestamp(500));
    const res = makeRes();

    await createMarkAllNotificationsReadHandler(f.db, serverTime, maintenance)(
      request('mark-1', { uid: 'other-teacher', acceptedAtMs: 1 }), res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({ acceptedAtMs: 500, unreadCount: 0 });
    expect(f.values.get('users/teacher-1/notificationState/inbox').readBefore.toMillis()).toBe(500);
    expect(f.values.get('users/teacher-1/notificationState/inbox').unreadCount).toBe(0);
    const receipt = f.values.get('users/teacher-1/notificationOperations/mark-1');
    expect({ ...receipt, acceptedAt: receipt.acceptedAt.toMillis() }).toEqual({
      kind: 'mark-all-read', acceptedAt: 500, generation: 3, response: { unreadCount: 0 },
    });
    expect(serverTime).toHaveBeenCalledTimes(1);
    expect(maintenance).toHaveBeenCalledWith('teacher-1');
  });

  it('replays the durable response after loss and serializes concurrent repeats', async () => {
    const f = makeMemoryDb();
    seedState(f, 4);
    const maintenance = jest.fn(async () => undefined);
    const handler = createMarkAllNotificationsReadHandler(f.db, () => timestamp(500), maintenance);
    const first = makeRes();
    const concurrent = makeRes();
    const lostResponseRetry = makeRes();

    await Promise.all([
      handler(request('same-operation'), first, jest.fn()),
      handler(request('same-operation'), concurrent, jest.fn()),
    ]);
    await handler(request('same-operation'), lostResponseRetry, jest.fn());

    const expected = { acceptedAtMs: 500, unreadCount: 0 };
    expect(first.json).toHaveBeenCalledWith(expected);
    expect(concurrent.json).toHaveBeenCalledWith(expected);
    expect(lostResponseRetry.json).toHaveBeenCalledWith(expected);
    expect(f.transaction.create).toHaveBeenCalledTimes(1);
    expect(maintenance.mock.calls).toEqual([['teacher-1'], ['teacher-1'], ['teacher-1']]);
  });

  it('creates the accepted boundary for an empty inbox without pre-existing metadata', async () => {
    const f = makeMemoryDb();
    f.values.set('users/teacher-1', { role: 'teacher' });
    const res = makeRes();

    await createMarkAllNotificationsReadHandler(f.db, () => timestamp(500))(
      request('empty-inbox'), res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({ acceptedAtMs: 500, unreadCount: 0 });
    expect(f.values.get('users/teacher-1/notificationState/inbox')).toEqual(expect.objectContaining({
      currentGeneration: 0, unreadCount: 0,
    }));
  });

  it('leaves later creation unread and converges with a row-read from another device', async () => {
    const f = makeMemoryDb();
    seedState(f, 1);
    await createMarkAllNotificationsReadHandler(f.db, () => timestamp(500))(
      request('mark-before-create'), makeRes(), jest.fn());
    const created = await persistCanonicalNotification(f.db, 'teacher-1', candidate(), timestamp(600));
    const readRes = makeRes();

    expect(f.values.get('users/teacher-1/notificationState/inbox').unreadCount).toBe(1);
    await createPatchNotificationReadHandler(f.db, () => timestamp(700))(
      { params: { id: created.notificationId }, body: {} } as any, readRes, jest.fn());

    expect(readRes.json).toHaveBeenCalledWith(expect.objectContaining({ unreadCount: 0 }));
    expect(f.values.get('users/teacher-1/notificationState/inbox').readBefore.toMillis()).toBe(500);
  });
});
describe('DELETE /notifications', () => {
  const seedState = (f: ReturnType<typeof makeMemoryDb>, unreadCount = 3) => {
    f.values.set('users/teacher-1', { role: 'teacher' });
    f.values.set('users/teacher-1/notificationState/inbox', {
      currentGeneration: 3, unreadCount, readBefore: timestamp(100),
      clearBefore: timestamp(50), classSweepAfter: 'old-cursor',
    });
  };
  const request = (idempotencyKey?: string, body: any = {}) => ({
    headers: idempotencyKey === undefined ? {} : { 'idempotency-key': idempotencyKey }, body,
  } as any);

  it('atomically switches generation, commits a trusted clear boundary, and enqueues cleanup', async () => {
    const f = makeMemoryDb();
    seedState(f);
    const maintenance = jest.fn(async () => undefined);
    const serverTime = jest.fn(() => timestamp(500));
    const res = makeRes();

    await createClearNotificationsHandler(f.db, serverTime, maintenance)(
      request('clear-1', { uid: 'other-teacher', clearBefore: 999999 }), res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({ acceptedAtMs: 500, unreadCount: 0 });
    const acceptedState = f.values.get('users/teacher-1/notificationState/inbox');
    expect({ ...acceptedState, clearBefore: acceptedState.clearBefore.toMillis(), updatedAt: acceptedState.updatedAt.toMillis() }).toEqual({
      currentGeneration: 4, unreadCount: 0, readBefore: null, clearBefore: 500,
      classSweepAfter: null, updatedAt: 500,
    });
    const receipt = f.values.get('users/teacher-1/notificationOperations/clear-1');
    expect({ ...receipt, acceptedAt: receipt.acceptedAt.toMillis() }).toEqual({
      kind: 'clear', acceptedAt: 500, generation: 3, response: { unreadCount: 0 },
    });
    const job = f.values.get('users/teacher-1/notificationClearJobs/3');
    expect({ ...job, createdAt: job.createdAt.toMillis(), updatedAt: job.updatedAt.toMillis() }).toEqual({
      retiredGeneration: 3, nextAfterId: null, batchSize: 100, status: 'pending',
      createdAt: 500, updatedAt: 500, deletedCount: 0,
    });
    expect(serverTime).toHaveBeenCalledTimes(1);
    expect(maintenance).toHaveBeenCalledWith('teacher-1');
  });

  it('requires a bounded key and teacher authority before changing state', async () => {
    const f = makeMemoryDb();
    seedState(f);
    const handler = createClearNotificationsHandler(f.db, () => timestamp(500));
    const missing = makeRes();
    const student = makeRes();
    await handler(request(), missing, jest.fn());
    f.values.set('users/teacher-1', { role: 'student' });
    await handler(request('student-clear', { uid: 'teacher-1' }), student, jest.fn());

    expect(missing.status).toHaveBeenCalledWith(400);
    expect(student.status).toHaveBeenCalledWith(403);
    expect(f.values.get('users/teacher-1/notificationState/inbox').currentGeneration).toBe(3);
  });

  it('replays ambiguous and concurrent retries without advancing generation twice', async () => {
    const f = makeMemoryDb();
    seedState(f);
    const handler = createClearNotificationsHandler(f.db, () => timestamp(500));
    const responses = [makeRes(), makeRes(), makeRes()];
    await Promise.all(responses.slice(0, 2).map(res => handler(request('same-clear'), res, jest.fn())));
    await handler(request('same-clear'), responses[2], jest.fn());

    responses.forEach(res => expect(res.json).toHaveBeenCalledWith({ acceptedAtMs: 500, unreadCount: 0 }));
    expect(f.values.get('users/teacher-1/notificationState/inbox').currentGeneration).toBe(4);
    expect(Array.from(f.values.keys()).filter(path => path.includes('notificationClearJobs')).length).toBe(1);
  });

  it('retires earlier items immediately while later creation remains current and counted', async () => {
    const f = makeMemoryDb();
    seedState(f, 0);
    const before = await persistCanonicalNotification(f.db, 'teacher-1', candidate(), timestamp(100));
    await createClearNotificationsHandler(f.db, () => timestamp(500))(
      request('clear-before-create'), makeRes(), jest.fn());
    const after = await persistCanonicalNotification(f.db, 'teacher-1', candidate({
      eventKey: 'class:class-2:upcoming', source: { kind: 'class', classId: 'class-2' },
    }), timestamp(600));

    expect(f.values.has(`users/teacher-1/notificationGenerations/3/items/${before.notificationId}`)).toBe(true);
    expect(f.values.has(`users/teacher-1/notificationGenerations/4/items/${before.notificationId}`)).toBe(false);
    expect(f.values.has(`users/teacher-1/notificationGenerations/4/items/${after.notificationId}`)).toBe(true);
    expect(f.values.get('users/teacher-1/notificationState/inbox').unreadCount).toBe(1);
  });

  it('isolates maintenance failure and rejects reuse by another operation kind', async () => {
    const f = makeMemoryDb();
    seedState(f);
    const maintenance = jest.fn(async () => { throw new Error('cleanup unavailable'); });
    const clearRes = makeRes();
    await createClearNotificationsHandler(f.db, () => timestamp(500), maintenance)(
      request('shared-key'), clearRes, jest.fn());
    const markRes = makeRes();
    await createMarkAllNotificationsReadHandler(f.db, () => timestamp(600))(
      request('shared-key'), markRes, jest.fn());

    expect(clearRes.status).toHaveBeenCalledWith(200);
    expect(markRes.status).toHaveBeenCalledWith(409);
    expect(f.values.get('users/teacher-1/notificationState/inbox').currentGeneration).toBe(4);
  });
});
