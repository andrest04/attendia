import { createGetReportHandler, createGetReportsHandler, createPostReportHandler, ReportsDatabase } from '../attentionReports';

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
  const transaction = { get: transactionGet, set: transactionSet, update: transactionUpdate };
  const runTransaction = jest.fn(async callback => callback(transaction));
  const reportsGet = jest.fn();
  const limit = jest.fn(() => ({ get: reportsGet }));
  const orderBy = jest.fn(() => ({ limit }));
  const reportDoc = jest.fn(() => ({ set, get: reportGet }));
  const reportsCollection = jest.fn(() => ({ doc: reportDoc, orderBy }));
  const userDoc = jest.fn(() => ({ get: userGet, collection: reportsCollection }));
  const collection = jest.fn(() => ({ doc: userDoc }));
  const db = ({ collection, runTransaction } as unknown) as ReportsDatabase;
  return {
    db, collection, userDoc, userGet, reportsCollection, reportDoc, set, reportGet, orderBy, limit, reportsGet,
    runTransaction, transactionGet, transactionSet, transactionUpdate,
  };
};

const teacherProfile = { displayName: 'Ana García', email: 'ana@example.com', role: 'teacher' };
const studentProfile = { displayName: 'Beto Díaz', email: 'beto@example.com', role: 'student' };

const serverTimestamp = jest.fn(() => 'server-timestamp');

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
    const handler = createPostReportHandler(db, serverTimestamp);
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

  it('commits a class-bound report and completion in the same Firestore transaction', async () => {
    const { db, userGet, transactionGet, transactionSet, transactionUpdate } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    transactionGet.mockResolvedValue({ exists: true, data: () => ({ roomName: validReport.roomName }) });
    const res = makeRes();

    await createPostReportHandler(db, serverTimestamp)(
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
    const handler = createPostReportHandler(db, serverTimestamp);
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
    const handler = createPostReportHandler(db, serverTimestamp);
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
    const handler = createPostReportHandler(db, serverTimestamp);
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
    ['an oversized timeline', { timeline: new Array(201).fill({ time: 't', value: 1 }) }],
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
    const handler = createPostReportHandler(db, serverTimestamp);
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
    const handler = createPostReportHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: validReport } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ message: 'report save failed' }) })
    );
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
