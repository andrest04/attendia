import {
  createReconcileClassesHandler,
  findReconcileCandidates,
  MAX_ROOMS_CHECKED_PER_CALL,
  ReconcilableClass,
  ROOM_CREATION_MARGIN_MS,
  selectRoomsToCheck,
} from '../classReconcile';
import { ClassesDatabase } from '../classes';

const NOW = 1800000000000;
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

const record = (overrides: Partial<ReconcilableClass>): ReconcilableClass => ({
  id: 'class-1',
  roomName: 'room-1',
  status: 'started',
  scheduledAtMs: NOW - MINUTE,
  startedAtMs: NOW - MINUTE,
  ...overrides,
});

const idsOf = (records: ReconcilableClass[]) => records.map(candidate => candidate.id);

describe('findReconcileCandidates', () => {
  it('uses a 10-minute margin', () => {
    expect(ROOM_CREATION_MARGIN_MS).toBe(10 * MINUTE);
  });

  it('leaves a started record inside the margin alone, since its room may not exist yet', () => {
    expect(findReconcileCandidates([record({})], NOW)).toEqual([]);
  });

  it('takes a started record older than the margin, and not one exactly at it', () => {
    const older = record({ id: 'older', roomName: 'a', startedAtMs: NOW - 10 * MINUTE - 1 });
    const atLimit = record({ id: 'at-limit', roomName: 'b', startedAtMs: NOW - 10 * MINUTE });

    expect(idsOf(findReconcileCandidates([older, atLimit], NOW))).toEqual(['older']);
  });

  it('measures age from startedAt, so restarting an old class makes it recent', () => {
    const restarted = record({ scheduledAtMs: NOW - 30 * DAY, startedAtMs: NOW - MINUTE });

    expect(findReconcileCandidates([restarted], NOW)).toEqual([]);
  });

  it('falls back to the schedule when a record has no startedAt', () => {
    const legacy = record({ scheduledAtMs: NOW - 11 * MINUTE, startedAtMs: null });
    const legacyInsideMargin = record({
      id: 'recent',
      roomName: 'b',
      scheduledAtMs: NOW - 9 * MINUTE,
      startedAtMs: null,
    });

    expect(idsOf(findReconcileCandidates([legacy, legacyInsideMargin], NOW))).toEqual(['class-1']);
  });

  it('does not call a record old when it has neither time', () => {
    expect(findReconcileCandidates([record({ scheduledAtMs: null, startedAtMs: null })], NOW)).toEqual([]);
  });

  it.each(['started', 'completed'])('takes a record superseded by a later %s record of the same room', status => {
    const older = record({ id: 'older', scheduledAtMs: NOW - 2 * MINUTE });
    const newer = record({ id: 'newer', scheduledAtMs: NOW - MINUTE, status });

    expect(idsOf(findReconcileCandidates([older, newer], NOW))).toEqual(['older']);
  });

  it('does not count a scheduled record, or another room, as superseding', () => {
    const older = record({ id: 'older', scheduledAtMs: NOW - 2 * MINUTE });
    const scheduled = record({ id: 'scheduled', scheduledAtMs: NOW, status: 'scheduled' });
    const otherRoom = record({ id: 'other', roomName: 'room-2', scheduledAtMs: NOW });

    expect(findReconcileCandidates([older, scheduled, otherRoom], NOW)).toEqual([]);
  });

  it('breaks a schedule tie by id, like the dashboard, whatever the input order', () => {
    const low = record({ id: 'a' });
    const high = record({ id: 'b' });

    expect(idsOf(findReconcileCandidates([low, high], NOW))).toEqual(['a']);
    expect(idsOf(findReconcileCandidates([high, low], NOW))).toEqual(['a']);
  });

  it('never returns a record that is not started', () => {
    const old = { scheduledAtMs: NOW - 30 * DAY, startedAtMs: NOW - 30 * DAY };

    expect(findReconcileCandidates([record({ ...old, status: 'completed' })], NOW)).toEqual([]);
    expect(findReconcileCandidates([record({ ...old, status: 'scheduled' })], NOW)).toEqual([]);
  });

  it('orders the candidates oldest first', () => {
    const records = [10, 30, 20].map(days =>
      record({ id: `d${days}`, roomName: `r${days}`, startedAtMs: NOW - days * DAY })
    );

    expect(idsOf(findReconcileCandidates(records, NOW))).toEqual(['d30', 'd20', 'd10']);
  });
});

describe('selectRoomsToCheck', () => {
  it('lists each room once and stops at the per-call limit, keeping the oldest', () => {
    const candidates = Array.from({ length: MAX_ROOMS_CHECKED_PER_CALL + 2 }, (_, index) =>
      record({ id: `c${index}`, roomName: `r${index}` })
    );

    const rooms = selectRoomsToCheck([record({ id: 'dup', roomName: 'r0' }), ...candidates]);

    expect(MAX_ROOMS_CHECKED_PER_CALL).toBe(10);
    expect(rooms).toHaveLength(10);
    expect(rooms[0]).toBe('r0');
    expect(rooms).not.toContain('r10');
  });
});

describe('createReconcileClassesHandler', () => {
  const millis = (ms: number) => ({ toMillis: () => ms });
  const startedDoc = (roomName: string, daysAgo: number, extra: { [key: string]: unknown } = {}) => ({
    roomName,
    status: 'started',
    scheduledAt: millis(NOW - daysAgo * DAY),
    startedAt: millis(NOW - daysAgo * DAY),
    ...extra,
  });

  const makeRes = (uid: string | null = 'uid-1') => {
    const res: any = { locals: uid ? { firebaseUser: { uid } } : {} };
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    res.send = jest.fn(() => res);
    return res;
  };

  /** An in-memory users/{uid}/classes: `changedInTransaction` is what a transaction re-read sees instead. */
  const makeDb = (
    docs: { [id: string]: { [key: string]: unknown } },
    { role = 'teacher', changedInTransaction = {} as { [id: string]: { [key: string]: unknown } } } = {}
  ) => {
    const updates: { id: string; data: { [key: string]: unknown } }[] = [];
    const orderBy = jest.fn();
    const limit = jest.fn();
    const snapshotOf = (id: string, data?: { [key: string]: unknown }) => ({
      id,
      exists: data !== undefined,
      data: () => data,
    });
    const classDoc = (id: string) => ({ id });
    const runTransaction = jest.fn(async (work: any) =>
      work({
        get: async (ref: { id: string }) => snapshotOf(ref.id, changedInTransaction[ref.id] || docs[ref.id]),
        update: (ref: { id: string }, data: { [key: string]: unknown }) => updates.push({ id: ref.id, data }),
      })
    );
    const collection = () => ({
      doc: (id: string) => classDoc(id),
      orderBy: (field: string, direction: string) => {
        orderBy(field, direction);
        return {
          limit: (count: number) => {
            limit(count);
            return { get: async () => ({ docs: Object.keys(docs).map(id => snapshotOf(id, docs[id])) }) };
          },
        };
      },
    });
    const db = ({
      collection: () => ({
        doc: () => ({ get: async () => ({ exists: true, data: () => ({ role }) }), collection }),
      }),
      runTransaction,
    } as unknown) as ClassesDatabase;
    return { db, updates, orderBy, limit, runTransaction };
  };

  const serverTimestamp = () => 'server-timestamp';

  const run = async (db: ClassesDatabase, roomExists: jest.Mock = jest.fn(async () => false), res: any = makeRes()) => {
    await createReconcileClassesHandler(db, roomExists, serverTimestamp, () => NOW)({} as any, res, jest.fn());
    return { res, roomExists };
  };

  afterEach(() => jest.restoreAllMocks());

  it('answers 401 without a verified user and 403 to a non-teacher, checking no room', async () => {
    const roomExists = jest.fn(async () => false);
    const unauthenticated = await run(makeDb({ a: startedDoc('r', 8) }).db, roomExists, makeRes(null));
    const student = await run(makeDb({ a: startedDoc('r', 8) }, { role: 'student' }).db, roomExists);

    expect(unauthenticated.res.status).toHaveBeenCalledWith(401);
    expect(student.res.status).toHaveBeenCalledWith(403);
    expect(roomExists).not.toHaveBeenCalled();
  });

  it('reads the same bounded newest-first listing as GET /classes', async () => {
    const { db, orderBy, limit } = makeDb({});

    await run(db);

    expect(orderBy).toHaveBeenCalledWith('scheduledAt', 'desc');
    expect(limit).toHaveBeenCalledWith(200);
  });

  it('completes a stale record whose room is closed', async () => {
    const { db, updates } = makeDb({ old: startedDoc('r', 8) });

    const { res } = await run(db);

    expect(updates).toEqual([{ id: 'old', data: { status: 'completed', completedAt: 'server-timestamp' } }]);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ completed: 1 });
  });

  it('completes a closed room as soon as the record is past the margin', async () => {
    const { db, updates } = makeDb({ ended: startedDoc('r', 11 / (24 * 60)) });

    const { res } = await run(db);

    expect(updates.map(update => update.id)).toEqual(['ended']);
    expect(res.json).toHaveBeenCalledWith({ completed: 1 });
  });

  it('leaves a single record inside the margin alone, without a lookup', async () => {
    const { db, updates } = makeDb({ recent: startedDoc('r', 5 / (24 * 60)) });

    const { res, roomExists } = await run(db);

    expect(roomExists).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
    expect(res.json).toHaveBeenCalledWith({ completed: 0 });
  });

  it('completes only the superseded record of a closed room', async () => {
    const { db, updates } = makeDb({ older: startedDoc('r', 2), newer: startedDoc('r', 5 / (24 * 60)) });

    const { res } = await run(db);

    expect(updates.map(update => update.id)).toEqual(['older']);
    expect(res.json).toHaveBeenCalledWith({ completed: 1 });
  });

  it('completes nothing for a room that is open', async () => {
    const { db, updates } = makeDb({ old: startedDoc('r', 8) });

    const { res } = await run(
      db,
      jest.fn(async () => true)
    );

    expect(updates).toEqual([]);
    expect(res.json).toHaveBeenCalledWith({ completed: 0 });
  });

  it('skips a room whose lookup fails, logs it, and still handles the others', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { db, updates } = makeDb({ broken: startedDoc('broken', 9), fine: startedDoc('fine', 8) });
    const roomExists = jest.fn(async (room: string) => {
      if (room === 'broken') throw new Error('twilio down');
      return false;
    });

    const { res } = await run(db, roomExists);

    expect(updates.map(update => update.id)).toEqual(['fine']);
    expect(res.json).toHaveBeenCalledWith({ completed: 1 });
    expect(log.mock.calls[0][0]).toContain('class_reconcile_lookup_failed');
  });

  it('checks each room once, at most 10 per call, oldest first so a backlog drains', async () => {
    const docs: { [id: string]: { [key: string]: unknown } } = { dup: startedDoc('r20', 20) };
    for (let days = 10; days <= 21; days++) docs[`d${days}`] = startedDoc(`r${days}`, days);
    const { db } = makeDb(docs);

    const { roomExists } = await run(db);

    const checked = roomExists.mock.calls.map(([room]) => room);
    expect(checked).toHaveLength(10);
    expect(new Set(checked).size).toBe(10);
    expect(checked[0]).toBe('r21');
    expect(checked).not.toContain('r11');
    expect(checked).not.toContain('r10');
  });

  it('writes nothing when the re-read shows the record is no longer started', async () => {
    const { db, updates } = makeDb(
      { old: startedDoc('r', 8) },
      { changedInTransaction: { old: startedDoc('r', 8, { status: 'completed' }) } }
    );

    const { res } = await run(db);

    expect(updates).toEqual([]);
    expect(res.json).toHaveBeenCalledWith({ completed: 0 });
  });

  it('writes nothing when the re-read shows the class was started again meanwhile', async () => {
    const { db, updates } = makeDb(
      { old: startedDoc('r', 8) },
      { changedInTransaction: { old: startedDoc('r', 8, { startedAt: millis(NOW) }) } }
    );

    const { res } = await run(db);

    expect(updates).toEqual([]);
    expect(res.json).toHaveBeenCalledWith({ completed: 0 });
  });

  it('writes nothing when the record was deleted meanwhile', async () => {
    const database = makeDb({ old: startedDoc('r', 8) });
    database.runTransaction.mockImplementationOnce(async (work: any) =>
      work({ get: async () => ({ id: 'old', exists: false, data: () => undefined }), update: jest.fn() })
    );

    const { res } = await run(database.db);

    expect(res.json).toHaveBeenCalledWith({ completed: 0 });
  });

  it('logs a failed write and answers the usual 503 error shape', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const database = makeDb({ old: startedDoc('r', 8) });
    database.runTransaction.mockRejectedValueOnce(new Error('firestore down'));

    const { res } = await run(database.db);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'class reconcile failed', explanation: expect.any(String) },
    });
    expect(log.mock.calls[0][0]).toContain('class_reconcile_failed');
  });
});
