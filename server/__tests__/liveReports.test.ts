import { ReportsDatabase } from '../attentionReports';
import { createGetLiveReportHandler, createPutLiveReportHandler } from '../liveReports';

const makeRes = () => {
  const res: any = { locals: { firebaseUser: { uid: 'uid-1', email: 'ana@example.com' } } };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
};

// Fake of the Firestore slice used: users/{uid} (profile) with the "reports" and "liveReports"
// subcollections; the PUT reads the final report inside a transaction and writes the live doc.
const makeDb = () => {
  const userGet = jest.fn();
  const docsByCollection: { [name: string]: { [id: string]: { get: jest.Mock } } } = {};
  const collectionDoc = (name: string) =>
    jest.fn((id: string) => {
      docsByCollection[name] = docsByCollection[name] || {};
      docsByCollection[name][id] = docsByCollection[name][id] || { get: jest.fn(), ...{ path: `${name}/${id}` } } as any;
      return docsByCollection[name][id];
    });
  const subcollections: { [name: string]: jest.Mock } = {};
  const userCollection = jest.fn((name: string) => {
    subcollections[name] = subcollections[name] || collectionDoc(name);
    return { doc: subcollections[name] };
  });
  const userDoc = jest.fn(() => ({ get: userGet, collection: userCollection }));
  const collection = jest.fn(() => ({ doc: userDoc }));
  const transactionGet = jest.fn();
  const transactionSet = jest.fn();
  const runTransaction = jest.fn(async callback => callback({ get: transactionGet, set: transactionSet }));
  const db = ({ collection, runTransaction } as unknown) as ReportsDatabase;
  return { db, userGet, userCollection, docsByCollection, transactionGet, transactionSet, runTransaction };
};

const teacherProfile = { displayName: 'Ana García', email: 'ana@example.com', role: 'teacher' };
const studentProfile = { displayName: 'Beto Díaz', email: 'beto@example.com', role: 'student' };
const serverTimestamp = jest.fn(() => 'server-timestamp');
const boundSession = jest.fn(async () => 'bound' as const);

const SID = 'RM00000000000000000000000000000abc';

const liveReport = {
  roomSid: SID,
  roomName: 'matematicas-2a',
  endReason: 'left',
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
  recordingWasActiveAtEnd: false,
};

describe('createPutLiveReportHandler', () => {
  afterEach(jest.clearAllMocks);

  it('stores the sanitized snapshot at users/{uid}/liveReports/{roomSid} as status live and answers 200', async () => {
    const { db, userGet, userCollection, docsByCollection, transactionGet, transactionSet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    transactionGet.mockResolvedValue({ data: () => undefined });
    const res = makeRes();

    await createPutLiveReportHandler(db, serverTimestamp, boundSession)(
      { params: { roomSid: SID }, body: { ...liveReport, extraneous: 'nope' } } as any,
      res,
      jest.fn()
    );

    expect(boundSession).toHaveBeenCalledWith({ roomSid: SID, roomName: 'matematicas-2a', uid: 'uid-1' });
    expect(userCollection).toHaveBeenCalledWith('liveReports');
    expect(docsByCollection.liveReports[SID]).toBeDefined();
    expect(transactionSet).toHaveBeenCalledWith(docsByCollection.liveReports[SID], {
      ...liveReport,
      status: 'live',
      updatedAt: 'server-timestamp',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ saved: true, roomSid: SID });
  });

  it('never writes over the reports collection (a final report cannot be downgraded)', async () => {
    const { db, userGet, docsByCollection, transactionGet, transactionSet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    transactionGet.mockResolvedValue({ data: () => ({ endReason: 'left' }) });

    await createPutLiveReportHandler(db, serverTimestamp, boundSession)(
      { params: { roomSid: SID }, body: liveReport } as any,
      makeRes(),
      jest.fn()
    );

    expect(transactionSet).toHaveBeenCalledTimes(1);
    expect(transactionSet.mock.calls[0][0]).toBe(docsByCollection.liveReports[SID]);
    expect(docsByCollection.reports[SID]).toBeDefined();
    expect(transactionSet).not.toHaveBeenCalledWith(docsByCollection.reports[SID], expect.anything(), expect.anything());
  });

  it('refuses with 409 and writes nothing once the class was ended for all', async () => {
    const { db, userGet, transactionGet, transactionSet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    transactionGet.mockResolvedValue({ data: () => ({ endReason: 'ended-for-all' }) });
    const res = makeRes();

    await createPutLiveReportHandler(db, serverTimestamp, boundSession)(
      { params: { roomSid: SID }, body: liveReport } as any,
      res,
      jest.fn()
    );

    expect(transactionSet).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('rejects a body whose roomSid differs from the URL with 400', async () => {
    const { db, userGet, runTransaction } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const res = makeRes();

    await createPutLiveReportHandler(db, serverTimestamp, boundSession)(
      { params: { roomSid: SID }, body: { ...liveReport, roomSid: 'RM11111111111111111111111111111111' } } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('reuses the report validators: an invalid payload is a 400', async () => {
    const { db, userGet, runTransaction } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const res = makeRes();

    await createPutLiveReportHandler(db, serverTimestamp, boundSession)(
      { params: { roomSid: SID }, body: { ...liveReport, timeline: 'nope' } } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('rejects a malformed roomSid param with 400 before the role lookup', async () => {
    const { db, userGet } = makeDb();
    const res = makeRes();

    await createPutLiveReportHandler(db, serverTimestamp, boundSession)(
      { params: { roomSid: 'nope' }, body: liveReport } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(userGet).not.toHaveBeenCalled();
  });

  it('refuses a student with 403', async () => {
    const { db, userGet, runTransaction } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => studentProfile });
    const res = makeRes();

    await createPutLiveReportHandler(db, serverTimestamp, boundSession)(
      { params: { roomSid: SID }, body: liveReport } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('refuses a co-teacher (session not owned) with 403 and writes nothing', async () => {
    const { db, userGet, runTransaction } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const res = makeRes();

    await createPutLiveReportHandler(db, serverTimestamp, jest.fn(async () => 'foreign-session' as const))(
      { params: { roomSid: SID }, body: liveReport } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('answers 404 when the room does not exist', async () => {
    const { db, userGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const res = makeRes();

    await createPutLiveReportHandler(db, serverTimestamp, jest.fn(async () => 'room-not-found' as const))(
      { params: { roomSid: SID }, body: liveReport } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('fails closed with 503 when the session binder is not configured', async () => {
    const { db, userGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const res = makeRes();

    await createPutLiveReportHandler(db, serverTimestamp)(
      { params: { roomSid: SID }, body: liveReport } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(503);
  });
});

describe('createGetLiveReportHandler', () => {
  afterEach(jest.clearAllMocks);

  const setup = (live: any, final: any) => {
    const parts = makeDb();
    parts.userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    // Both docs are resolved lazily by the handler: prime them through the collections.
    const primed = parts.userCollection;
    primed('liveReports').doc(SID).get.mockResolvedValue({ id: SID, data: () => live });
    primed('reports').doc(SID).get.mockResolvedValue({ id: SID, data: () => final });
    return parts;
  };

  const get = async (live: any, final: any) => {
    const { db } = setup(live, final);
    const res = makeRes();
    await createGetLiveReportHandler(db)({ params: { roomSid: SID } } as any, res, jest.fn());
    return res;
  };

  it('returns the live snapshot without server-only fields', async () => {
    const res = await get({ ...liveReport, status: 'live', updatedAt: 'ts' }, undefined);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ...liveReport, snapshot: 'live' });
  });

  it('answers 404 when nothing was stored', async () => {
    const res = await get(undefined, undefined);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('answers 404 once the class was ended for all (the live snapshot is superseded)', async () => {
    const res = await get(
      { ...liveReport, status: 'live' },
      { ...liveReport, endReason: 'ended-for-all', endedAt: { toMillis: () => 1 } }
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('prefers a newer "left" report over an older live snapshot', async () => {
    const left = { ...liveReport, endReason: 'left', endedAtIso: '2026-07-03T15:10:00.000Z', recording: { status: 'enqueued' } };
    const res = await get({ ...liveReport, status: 'live' }, { ...left, endedAt: { toMillis: () => 1 } });

    expect(res.json).toHaveBeenCalledWith({
      ...liveReport,
      endedAtIso: '2026-07-03T15:10:00.000Z',
      snapshot: 'left',
    });
  });

  it('prefers the live snapshot when it is newer than the "left" report', async () => {
    const res = await get(
      { ...liveReport, status: 'live', endedAtIso: '2026-07-03T15:30:00.000Z' },
      { ...liveReport, endedAt: { toMillis: () => 1 } }
    );

    expect(res.json).toHaveBeenCalledWith({
      ...liveReport,
      endedAtIso: '2026-07-03T15:30:00.000Z',
      snapshot: 'live',
    });
  });

  it('refuses a student with 403', async () => {
    const { db, userGet } = setup(undefined, undefined);
    userGet.mockResolvedValue({ exists: true, data: () => studentProfile });
    const res = makeRes();

    await createGetLiveReportHandler(db)({ params: { roomSid: SID } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects a malformed roomSid with 400', async () => {
    const { db } = setup(undefined, undefined);
    const res = makeRes();

    await createGetLiveReportHandler(db)({ params: { roomSid: 'nope' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
