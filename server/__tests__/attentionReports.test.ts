import {
  createGetReportHandler,
  createGetReportsHandler,
  createPostReportHandler,
  ingestReportFailureEpisodes,
  ReportsDatabase,
} from '../attentionReports';

const makeRes = () => {
  const res: any = { locals: { firebaseUser: { uid: 'uid-1', email: 'ana@example.com' } } };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
};

// Fake of the minimal Firestore surface the handlers use (users/{uid} profile doc +
// its "reports" subcollection with doc().set() and orderBy().limit().get()).
const makeDb = () => {
  const userGet = jest.fn();
  const set = jest.fn(() => Promise.resolve());
  const reportGet = jest.fn();
  const transactionGet = jest.fn();
  const transactionSet = jest.fn();
  const transactionUpdate = jest.fn();
  const transactionDelete = jest.fn();
  const transaction = {
    get: transactionGet, set: transactionSet, update: transactionUpdate, delete: transactionDelete,
  };
  const runTransaction = jest.fn(async callback => callback(transaction));
  const reportsGet = jest.fn();
  const limit = jest.fn(() => ({ get: reportsGet }));
  const orderBy = jest.fn(() => ({ limit }));
  const reportDoc = jest.fn(() => ({ set, get: reportGet, collection: reportsCollection }));
  const reportsCollection = jest.fn(() => ({ doc: reportDoc, orderBy }));
  const userDoc = jest.fn(() => ({ get: userGet, collection: reportsCollection }));
  const collection = jest.fn(() => ({ doc: userDoc }));
  const db = ({ collection, runTransaction } as unknown) as ReportsDatabase;
  return {
    db, collection, userDoc, userGet, reportsCollection, reportDoc, set, reportGet, orderBy, limit, reportsGet,
    runTransaction, transactionGet, transactionSet, transactionUpdate, transactionDelete,
  };
};

const teacherProfile = { displayName: 'Ana García', email: 'ana@example.com', role: 'teacher' };
const studentProfile = { displayName: 'Beto Díaz', email: 'beto@example.com', role: 'student' };

const serverTimestamp = jest.fn(() => 'server-timestamp');
// The room session is already bound to uid-1 (roomOwnership.ts owns that logic and its tests).
const boundSession = jest.fn(async () => 'bound' as const);

const VALID_ROOM_SID = 'RM00000000000000000000000000000abc';

const validReport = {
  roomSid: VALID_ROOM_SID,
  roomName: 'matematicas-2a',
  endReason: 'ended-for-all',
  source: 'live',
  studentCount: 3,
  attentionThreshold: 60,
  ranges: { lowMax: 40, mediumMax: 70 },
  groupAverage: 72,
  percentAboveThreshold: 80,
  timeline: [{ time: '10:00:00', value: 72 }],
  participants: [{ identity: 'Ana', indexAvg: 72, indexMin: 60, indexMax: 90, level: 'high', alertCount: 0 }],
  proctoringAlerts: [{ identity: 'Ana', kind: 'multiface', detectedAt: '10:02' }],
  endedAtIso: '2026-07-03T15:00:00.000Z',
  startedAtIso: '2026-07-03T14:00:00.000Z',
  durationMs: 3600000,
  recordingWasActiveAtEnd: true,
};

describe('createPostReportHandler', () => {
  afterEach(jest.clearAllMocks);

  it('saves the sanitized report under users/{uid}/reports/{roomSid} with a server timestamp and returns 201', async () => {
    const { db, collection, userDoc, userGet, reportsCollection, reportDoc, transactionSet, runTransaction } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createPostReportHandler(db, serverTimestamp, boundSession);
    const res = makeRes();

    await handler({ body: { ...validReport, extraneous: 'nope' } } as any, res, jest.fn());

    expect(collection).toHaveBeenCalledWith('users');
    expect(userDoc).toHaveBeenCalledWith('uid-1');
    expect(reportsCollection).toHaveBeenCalledWith('reports');
    expect(reportDoc).toHaveBeenCalledWith(VALID_ROOM_SID);
    expect(runTransaction).toHaveBeenCalled();
    expect(transactionSet).toHaveBeenCalledWith(
      expect.anything(),
      { ...validReport, endedAt: 'server-timestamp' },
      { merge: true }
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ saved: true, roomSid: VALID_ROOM_SID });
  });

  it('atomically resolves the matching failure episode without trusting client time', async () => {
    const { db, userGet, transactionGet, transactionSet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    transactionGet.mockResolvedValue({
      data: () => ({ status: 'unresolved', observedAt: 'original-server-time' }),
    });
    const res = makeRes();

    await createPostReportHandler(db, serverTimestamp, boundSession)(
      { body: { ...validReport, failureEpisodeId: 'episode_12345678', firstFailedAtMs: 999999999 } } as any,
      res,
      jest.fn()
    );

    expect(transactionSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'resolved', observedAt: 'original-server-time', resolvedAt: 'server-timestamp' }),
      { merge: true }
    );
    expect(transactionSet).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ observedAt: 999999999 }),
      expect.anything()
    );
    expect(res.json).toHaveBeenCalledWith({ saved: true, roomSid: VALID_ROOM_SID });
  });

  it('removes the matching unread inbox notification in the same recovery transaction', async () => {
    const { db, userGet, transactionGet, transactionUpdate, transactionDelete } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    transactionGet
      .mockResolvedValueOnce({ exists: true, data: () => ({
        reportId: VALID_ROOM_SID, failureEpisodeId: 'episode_12345678', status: 'unresolved',
        observedAt: 'original-server-time',
      }) })
      .mockResolvedValueOnce({ exists: true, data: () => ({
        currentGeneration: 3, unreadCount: 4, readBefore: null,
      }) })
      .mockResolvedValueOnce({ exists: true, data: () => ({
        createdAt: { toMillis: () => 100 }, readAt: null,
      }) });
    const res = makeRes();

    await createPostReportHandler(db, serverTimestamp, boundSession)(
      { body: { ...validReport, failureEpisodeId: 'episode_12345678' } } as any,
      res,
      jest.fn()
    );

    expect(transactionDelete).toHaveBeenCalledTimes(1);
    expect(transactionUpdate).toHaveBeenCalledWith(expect.anything(), { unreadCount: 3 });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('removes a confirmed recovered notification idempotently without decrementing an already-read item', async () => {
    const { db, userGet, transactionGet, transactionUpdate, transactionDelete } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    transactionGet
      .mockResolvedValueOnce({ exists: true, data: () => ({
        reportId: VALID_ROOM_SID, failureEpisodeId: 'episode_12345678', status: 'resolved',
        observedAt: 'original-server-time',
      }) })
      .mockResolvedValueOnce({ exists: true, data: () => ({
        currentGeneration: 3, unreadCount: 4, readBefore: { toMillis: () => 200 },
      }) })
      .mockResolvedValueOnce({ exists: true, data: () => ({
        createdAt: { toMillis: () => 100 }, readAt: null,
      }) });

    await createPostReportHandler(db, serverTimestamp, boundSession)(
      { body: { ...validReport, failureEpisodeId: 'episode_12345678' } } as any,
      makeRes(),
      jest.fn()
    );

    expect(transactionDelete).toHaveBeenCalledTimes(1);
    expect(transactionUpdate).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ unreadCount: 3 }));
  });

  it('replays a lost success response without reopening its resolved tombstone', async () => {
    const { db, userGet, transactionGet, transactionSet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    transactionGet.mockResolvedValue({ data: () => ({ status: 'resolved', observedAt: 'original-server-time' }) });
    const res = makeRes();

    await createPostReportHandler(db, serverTimestamp, boundSession)(
      { body: { ...validReport, failureEpisodeId: 'episode_12345678' } } as any,
      res,
      jest.fn()
    );

    expect(transactionSet).toHaveBeenCalledTimes(1);
    expect(transactionSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ roomSid: VALID_ROOM_SID }),
      { merge: true }
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rejects an unbounded failure episode id before writing', async () => {
    const { db, userGet, runTransaction } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const res = makeRes();

    await createPostReportHandler(db, serverTimestamp, boundSession)(
      { body: { ...validReport, failureEpisodeId: '../invalid' } } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('commits a class-bound report and completion in the same Firestore transaction', async () => {
    const { db, userGet, transactionGet, transactionSet, transactionUpdate } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    transactionGet.mockResolvedValue({ exists: true, data: () => ({ roomName: validReport.roomName }) });
    const res = makeRes();

    await createPostReportHandler(db, serverTimestamp, boundSession)(
      { body: { ...validReport, classId: 'class-1' } } as any,
      res,
      jest.fn()
    );

    expect(transactionGet).toHaveBeenCalled();
    expect(transactionSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ roomSid: VALID_ROOM_SID }),
      { merge: true }
    );
    expect(transactionUpdate).toHaveBeenCalledWith(
      expect.anything(),
      { status: 'completed', completedAt: 'server-timestamp' }
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 401 when the middleware did not attach a verified user', async () => {
    const { db, transactionSet, userGet } = makeDb();
    const handler = createPostReportHandler(db, serverTimestamp, boundSession);
    const res = makeRes();
    res.locals = {};

    await handler({ body: validReport } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(userGet).not.toHaveBeenCalled();
    expect(transactionSet).not.toHaveBeenCalled();
  });

  it('returns 403 without writing when the caller has no profile document', async () => {
    const { db, userGet, transactionSet } = makeDb();
    userGet.mockResolvedValue({ exists: false, data: () => undefined });
    const handler = createPostReportHandler(db, serverTimestamp, boundSession);
    const res = makeRes();

    await handler({ body: validReport } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ message: 'teacher role required' }) })
    );
    expect(transactionSet).not.toHaveBeenCalled();
  });

  it('returns 403 without writing when the caller is a student', async () => {
    const { db, userGet, transactionSet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => studentProfile });
    const handler = createPostReportHandler(db, serverTimestamp, boundSession);
    const res = makeRes();

    await handler({ body: validReport } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(transactionSet).not.toHaveBeenCalled();
  });

  it.each([
    ['a malformed roomSid', { roomSid: 'not-a-sid' }],
    ['a missing roomName', { roomName: '   ' }],
    ['an unknown endReason', { endReason: 'crashed' }],
    ['a non-array timeline', { timeline: 'nope' }],
    ['an oversized timeline', { timeline: new Array(10801).fill({ time: 't', value: 1 }) }],
    ['a non-array participants', { participants: 42 }],
    ['oversized proctoringAlerts', { proctoringAlerts: new Array(11).fill({ identity: 'x' }) }],
    ['a non-numeric groupAverage', { groupAverage: 'high' }],
    ['a non-numeric duration', { durationMs: 'one hour' }],
    ['a negative duration', { durationMs: -1 }],
    ['an invalid session start', { startedAtIso: 'not-a-date' }],
    ['a session ending before it starts', { startedAtIso: '2026-07-03T16:00:00.000Z' }],
  ])('rejects %s with 400 and does not write', async (_label, override) => {
    const { db, userGet, transactionSet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createPostReportHandler(db, serverTimestamp, boundSession);
    const res = makeRes();

    await handler({ body: { ...validReport, ...override } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(transactionSet).not.toHaveBeenCalled();
  });

  it('returns 503 when the Firestore write fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db, userGet, transactionSet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    transactionSet.mockImplementation(() => {
      throw new Error('firestore down');
    });
    const handler = createPostReportHandler(db, serverTimestamp, boundSession);
    const res = makeRes();

    await handler({ body: validReport } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ message: 'report save failed' }) })
    );
    consoleError.mockRestore();
  });
});

describe('ingestReportFailureEpisodes', () => {
  afterEach(jest.clearAllMocks);

  const claim = {
    reportId: VALID_ROOM_SID,
    failureEpisodeId: 'episode_12345678',
    firstFailedAtMs: 123,
  };

  it('creates an unresolved episode with immutable server-owned observedAt', async () => {
    const { db, transactionGet, transactionSet } = makeDb();
    transactionGet.mockResolvedValue({ data: () => undefined });

    await ingestReportFailureEpisodes(db, 'uid-1', [claim], serverTimestamp);

    expect(transactionSet).toHaveBeenCalledWith(expect.anything(), {
      reportId: VALID_ROOM_SID,
      failureEpisodeId: 'episode_12345678',
      status: 'unresolved',
      observedAt: 'server-timestamp',
    });
    expect(transactionSet).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ observedAt: 123 }));
  });

  it.each(['unresolved', 'resolved'])('never rewrites an existing %s episode tombstone', async status => {
    const { db, transactionGet, transactionSet } = makeDb();
    transactionGet.mockResolvedValue({ data: () => ({ status, observedAt: 'original-server-time' }) });

    await ingestReportFailureEpisodes(db, 'uid-1', [claim], serverTimestamp);

    expect(transactionSet).not.toHaveBeenCalled();
  });

  it('keeps a later distinct episode independent after recovery', async () => {
    const { db, transactionGet, transactionSet } = makeDb();
    transactionGet
      .mockResolvedValueOnce({ data: () => ({ status: 'resolved', observedAt: 'first-server-time' }) })
      .mockResolvedValueOnce({ data: () => undefined });

    await ingestReportFailureEpisodes(
      db,
      'uid-1',
      [claim, { ...claim, failureEpisodeId: 'episode_87654321', firstFailedAtMs: 1 }],
      serverTimestamp
    );

    expect(transactionSet).toHaveBeenCalledTimes(1);
    expect(transactionSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ failureEpisodeId: 'episode_87654321', observedAt: 'server-timestamp' })
    );
  });

  it('rejects malformed and bulk claims before opening a transaction', async () => {
    const malformed = { ...claim, failureEpisodeId: '../bad' };
    const { db, runTransaction } = makeDb();

    await expect(ingestReportFailureEpisodes(db, 'uid-1', [malformed], serverTimestamp)).rejects.toThrow(
      'invalid report failure claim'
    );
    await expect(
      ingestReportFailureEpisodes(db, 'uid-1', new Array(21).fill(claim), serverTimestamp)
    ).rejects.toThrow('too many report failure claims');
    expect(runTransaction).not.toHaveBeenCalled();
  });
});

describe('createPostReportHandler room-session binding', () => {
  afterEach(jest.clearAllMocks);

  const save = async (bindSession?: any) => {
    const fake = makeDb();
    fake.userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const res = makeRes();
    await createPostReportHandler(fake.db, serverTimestamp, bindSession)({ body: validReport } as any, res, jest.fn());
    return { ...fake, res };
  };

  it('binds the session for the verified uid and the report room before saving', async () => {
    const bindSession = jest.fn(async () => 'bound' as const);
    const { res, runTransaction } = await save(bindSession);

    expect(bindSession).toHaveBeenCalledWith({ roomSid: VALID_ROOM_SID, roomName: 'matematicas-2a', uid: 'uid-1' });
    expect(runTransaction).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it.each(['foreign-session', 'not-room-owner', 'room-mismatch'])(
    'answers 403 and saves nothing when the binder says %s',
    async verdict => {
      const { res, runTransaction } = await save(jest.fn(async () => verdict));

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: { message: 'room session not owned', explanation: expect.any(String) },
      });
      expect(runTransaction).not.toHaveBeenCalled();
    }
  );

  it('answers 404 and saves nothing when Twilio does not know the room SID', async () => {
    const { res, runTransaction } = await save(jest.fn(async () => 'room-not-found' as const));

    expect(res.status).toHaveBeenCalledWith(404);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('answers 503 when the binding lookup fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { res, runTransaction } = await save(jest.fn().mockRejectedValue(new Error('twilio down')));

    expect(res.status).toHaveBeenCalledWith(503);
    expect(runTransaction).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('fails closed (503) when no session binder is wired', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { res, runTransaction } = await save(undefined);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(runTransaction).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe('createGetReportsHandler', () => {
  afterEach(jest.clearAllMocks);

  it('returns the stored reports newest first, mapping the doc id and the server timestamp', async () => {
    const { db, userGet, orderBy, limit, reportsGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportsGet.mockResolvedValue({
      docs: [
        {
          id: 'RM11111111111111111111111111111111',
          data: () => ({ roomName: 'clase-b', endedAt: { toMillis: () => 1751554800000 } }),
        },
        {
          id: 'RM22222222222222222222222222222222',
          data: () => ({ roomName: 'clase-a', endedAt: undefined }),
        },
      ],
    });
    const handler = createGetReportsHandler(db);
    const res = makeRes();

    await handler({} as any, res, jest.fn());

    expect(orderBy).toHaveBeenCalledWith('endedAt', 'desc');
    expect(limit).toHaveBeenCalledWith(50);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      { roomName: 'clase-b', roomSid: 'RM11111111111111111111111111111111', endedAtMs: 1751554800000 },
      { roomName: 'clase-a', roomSid: 'RM22222222222222222222222222222222', endedAtMs: null },
    ]);
  });

  it('returns 401 when the middleware did not attach a verified user', async () => {
    const { db, userGet } = makeDb();
    const handler = createGetReportsHandler(db);
    const res = makeRes();
    res.locals = {};

    await handler({} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(userGet).not.toHaveBeenCalled();
  });

  it('returns 403 without querying when the caller is a student', async () => {
    const { db, userGet, reportsGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => studentProfile });
    const handler = createGetReportsHandler(db);
    const res = makeRes();

    await handler({} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(reportsGet).not.toHaveBeenCalled();
  });

  it('returns 503 when the Firestore query fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db, userGet, reportsGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportsGet.mockRejectedValue(new Error('firestore down'));
    const handler = createGetReportsHandler(db);
    const res = makeRes();

    await handler({} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ message: 'report lookup failed' }) })
    );
    consoleError.mockRestore();
  });
});

describe('createGetReportHandler', () => {
  afterEach(jest.clearAllMocks);

  it('returns only the verified teacher\'s own report', async () => {
    const { db, userGet, reportDoc, reportGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportGet.mockResolvedValue({
      id: VALID_ROOM_SID,
      data: () => ({ roomName: 'clase-a', endedAt: { toMillis: () => 1751554800000 } }),
    });
    const res = makeRes();

    await createGetReportHandler(db)({ params: { roomSid: VALID_ROOM_SID } } as any, res, jest.fn());

    expect(reportDoc).toHaveBeenCalledWith(VALID_ROOM_SID);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ roomName: 'clase-a', roomSid: VALID_ROOM_SID, endedAtMs: 1751554800000 });
  });

  it('returns 403 before reading a report for a student', async () => {
    const { db, userGet, reportGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => studentProfile });
    const res = makeRes();

    await createGetReportHandler(db)({ params: { roomSid: VALID_ROOM_SID } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(reportGet).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing report in the verified teacher\'s own collection', async () => {
    const { db, userGet, reportGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportGet.mockResolvedValue({ id: VALID_ROOM_SID, data: () => undefined });
    const res = makeRes();

    await createGetReportHandler(db)({ params: { roomSid: VALID_ROOM_SID } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
