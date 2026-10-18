import {
  createGetClassesHandler,
  createCreateClassHandler,
  createDeleteClassHandler,
  createStartClassHandler,
  ClassesDatabase,
} from '../classes';
import { canonicalNotificationId } from '../notifications';

const makeRes = () => {
  const res: any = { locals: { firebaseUser: { uid: 'uid-1', email: 'ana@example.com' } } };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
};

// Fake of the minimal Firestore surface the handlers use (users/{uid} profile doc +
// its "classes" subcollection with doc()/orderBy().limit().get()).
const makeDb = () => {
  const userGet = jest.fn();
  const docGet = jest.fn(() => Promise.resolve({ exists: false, data: () => undefined }));
  const set = jest.fn(() => Promise.resolve());
  const update = jest.fn(() => Promise.resolve());
  const del = jest.fn(() => Promise.resolve());
  const tombstoneGet = jest.fn(() => Promise.resolve({ exists: false, data: () => undefined }));
  const tombstoneSet = jest.fn(() => Promise.resolve());
  const classesGet = jest.fn();
  const limit = jest.fn(() => ({ get: classesGet }));
  const orderBy = jest.fn(() => ({ limit }));
  const classDoc = jest.fn((id?: string) => ({ id: id || 'auto-id-1', get: docGet, set, update, delete: del }));
  const tombstoneDoc = jest.fn((id?: string) => ({ id: id || 'auto-id-1', get: tombstoneGet, set: tombstoneSet }));

  // Fakes the users/{uid}/notificationState/inbox and
  // notificationGenerations/{n}/items/{id} surface createDeleteClassHandler reaches
  // into to clean up a canceled class's notification (mirrors the real recursive
  // ClassDocumentReference.collection()). Defaults to "nothing exists" so tests that
  // don't care about notifications are unaffected.
  const notificationStateGet = jest.fn(() => Promise.resolve({ exists: false, data: () => undefined }));
  const notificationStateUpdate = jest.fn(() => Promise.resolve());
  const notificationStateDoc = jest.fn((id?: string) => ({
    id: id || 'inbox', get: notificationStateGet, update: notificationStateUpdate,
  }));
  const notificationItemGet = jest.fn(() => Promise.resolve({ exists: false, data: () => undefined }));
  const notificationItemDelete = jest.fn(() => Promise.resolve());
  const notificationItemDoc = jest.fn((id?: string) => ({
    id: id || 'item-id', get: notificationItemGet, delete: notificationItemDelete,
  }));
  const notificationItemsCollection = jest.fn(() => ({ doc: notificationItemDoc }));
  const notificationGenerationDoc = jest.fn((id?: string) => ({
    id: id || 'generation-id', collection: notificationItemsCollection,
  }));

  const classesCollection = jest.fn((name: string) => {
    if (name === 'classOccurrenceTombstones') return { doc: tombstoneDoc, orderBy };
    if (name === 'notificationState') return { doc: notificationStateDoc, orderBy };
    if (name === 'notificationGenerations') return { doc: notificationGenerationDoc, orderBy };
    return { doc: classDoc, orderBy };
  });
  const userDoc = jest.fn(() => ({ get: userGet, collection: classesCollection }));
  const collection = jest.fn(() => ({ doc: userDoc }));
  const transaction = {
    get: jest.fn((ref: any) => ref.get()),
    set: jest.fn((ref: any, data: any) => ref.set(data)),
    update: jest.fn((ref: any, data: any) => ref.update(data)),
    delete: jest.fn((ref: any) => ref.delete()),
  };
  const runTransaction = jest.fn(async (callback: any) => callback(transaction));
  const db = ({ collection, runTransaction } as unknown) as ClassesDatabase;
  return {
    db,
    collection,
    userDoc,
    userGet,
    classesCollection,
    classDoc,
    docGet,
    set,
    update,
    del,
    tombstoneDoc,
    tombstoneGet,
    tombstoneSet,
    transaction,
    runTransaction,
    orderBy,
    limit,
    classesGet,
    notificationStateGet,
    notificationStateUpdate,
    notificationStateDoc,
    notificationItemGet,
    notificationItemDelete,
    notificationItemDoc,
    notificationGenerationDoc,
  };
};

const teacherProfile = { displayName: 'Ana García', email: 'ana@example.com', role: 'teacher' };
const studentProfile = { displayName: 'Beto Díaz', email: 'beto@example.com', role: 'student' };

const serverTimestamp = jest.fn(() => 'server-timestamp');

describe('createGetClassesHandler', () => {
  afterEach(jest.clearAllMocks);

  it('returns the classes in ascending display order, mapping the doc id and the timestamp', async () => {
    const { db, userGet, orderBy, limit, classesGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    classesGet.mockResolvedValue({
      docs: [
        {
          id: 'class-2',
          data: () => ({
            title: 'Álgebra Lineal',
            roomName: 'algebra-lineal',
            studentCount: 32,
            status: 'scheduled',
            scheduledAt: undefined,
          }),
        },
        {
          id: 'class-1',
          data: () => ({
            title: 'Matemáticas — Grupo A',
            roomName: 'matematicas-grupo-a',
            studentCount: 28,
            status: 'scheduled',
            scheduledAt: { toMillis: () => 1751554800000 },
          }),
        },
      ],
    });
    const handler = createGetClassesHandler(db);
    const res = makeRes();

    await handler({} as any, res, jest.fn());

    expect(orderBy).toHaveBeenCalledWith('scheduledAt', 'desc');
    expect(limit).toHaveBeenCalledWith(200);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      {
        id: 'class-1',
        title: 'Matemáticas — Grupo A',
        roomName: 'matematicas-grupo-a',
        scheduledAtMs: 1751554800000,
        studentCount: 28,
        durationMinutes: 60,
        status: 'scheduled',
      },
      {
        id: 'class-2',
        title: 'Álgebra Lineal',
        roomName: 'algebra-lineal',
        scheduledAtMs: null,
        studentCount: 32,
        durationMinutes: 60,
        status: 'scheduled',
      },
    ]);
  });

  it('keeps the NEWEST 200 classes (started/completed docs stay), shown oldest to newest', async () => {
    const { db, userGet, orderBy, limit, classesGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const doc = (id: string, ms: number, status: string) => ({
      id,
      data: () => ({ title: id, roomName: id, studentCount: 1, status, scheduledAt: { toMillis: () => ms } }),
    });
    // Firestore answers newest first because of orderBy('scheduledAt', 'desc').
    classesGet.mockResolvedValue({
      docs: [doc('next-week', 3000, 'scheduled'), doc('today', 2000, 'started'), doc('last-month', 1000, 'completed')],
    });
    const res = makeRes();

    await createGetClassesHandler(db)({} as any, res, jest.fn());

    expect(orderBy).toHaveBeenCalledWith('scheduledAt', 'desc');
    expect(limit).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].map((value: any) => value.id)).toEqual(['last-month', 'today', 'next-week']);
  });

  it('reads a persisted durationMinutes instead of the default', async () => {
    const { db, userGet, classesGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    classesGet.mockResolvedValue({
      docs: [
        {
          id: 'class-1',
          data: () => ({
            title: 'Matemáticas — Grupo A',
            roomName: 'matematicas-grupo-a',
            studentCount: 28,
            durationMinutes: 90,
            status: 'scheduled',
            scheduledAt: { toMillis: () => 1751554800000 },
          }),
        },
      ],
    });
    const handler = createGetClassesHandler(db);
    const res = makeRes();

    await handler({} as any, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ durationMinutes: 90 })]);
  });

  it('returns 401 when the middleware did not attach a verified user', async () => {
    const { db, userGet } = makeDb();
    const handler = createGetClassesHandler(db);
    const res = makeRes();
    res.locals = {};

    await handler({} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(userGet).not.toHaveBeenCalled();
  });

  it('returns 403 without querying when the caller is a student', async () => {
    const { db, userGet, classesGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => studentProfile });
    const handler = createGetClassesHandler(db);
    const res = makeRes();

    await handler({} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(classesGet).not.toHaveBeenCalled();
  });

  it('returns 503 when the Firestore query fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db, userGet, classesGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    classesGet.mockRejectedValue(new Error('firestore down'));
    const handler = createGetClassesHandler(db);
    const res = makeRes();

    await handler({} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    consoleError.mockRestore();
  });
});

describe('createCreateClassHandler', () => {
  // Frozen an hour before the fixture scheduledAtMs values below so they read as
  // "in the future" regardless of when this suite actually runs.
  const FROZEN_NOW = 1751554800000 - 60 * 60 * 1000;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(FROZEN_NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('creates the class doc with a slugified roomName and returns 201', async () => {
    const { db, userGet, classDoc, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createCreateClassHandler(db, serverTimestamp);
    const res = makeRes();
    const req: any = {
      body: {
        title: 'Matemáticas — Grupo A',
        scheduledAtMs: 1751554800000,
        studentCount: 28,
        durationMinutes: 45,
        idempotencyKey: 'create-class-key-001',
      },
    };

    await handler(req, res, jest.fn());

    expect(classDoc).toHaveBeenCalledWith('create-class-key-001');
    expect(set).toHaveBeenCalledWith({
      title: 'Matemáticas — Grupo A',
      roomName: 'matematicas-grupo-a-sskey001',
      scheduledAt: new Date(1751554800000),
      studentCount: 28,
      durationMinutes: 45,
      status: 'scheduled',
      idempotencyKey: 'create-class-key-001',
      createdAt: 'server-timestamp',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      id: 'create-class-key-001',
      title: 'Matemáticas — Grupo A',
      roomName: 'matematicas-grupo-a-sskey001',
      scheduledAtMs: 1751554800000,
      studentCount: 28,
      durationMinutes: 45,
      status: 'scheduled',
    });
  });

  it('uses an explicit roomName verbatim instead of deriving one from the title', async () => {
    const { db, userGet, classDoc, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createCreateClassHandler(db, serverTimestamp);
    const res = makeRes();
    const req: any = {
      body: {
        title: 'Física 101',
        scheduledAtMs: 1751554800000,
        idempotencyKey: 'create-class-key-quick-1',
        roomName: 'fisica-101',
      },
    };

    await handler(req, res, jest.fn());

    expect(classDoc).toHaveBeenCalledWith('create-class-key-quick-1');
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ roomName: 'fisica-101' }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 400 when an explicit roomName is blank', async () => {
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createCreateClassHandler(db, serverTimestamp);
    const res = makeRes();

    await handler(
      {
        body: {
          title: 'Física 101',
          scheduledAtMs: 1751554800000,
          idempotencyKey: 'create-class-key-quick-2',
          roomName: '   ',
        },
      } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(set).not.toHaveBeenCalled();
  });

  it('gives two classes with the same title distinct room names', async () => {
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createCreateClassHandler(db, serverTimestamp);

    await handler(
      { body: { title: 'test', scheduledAtMs: 1751554800000, idempotencyKey: 'create-class-key-001' } } as any,
      makeRes(),
      jest.fn()
    );
    await handler(
      { body: { title: 'test', scheduledAtMs: 1751558400000, idempotencyKey: 'create-class-key-002' } } as any,
      makeRes(),
      jest.fn()
    );

    const [firstCall, secondCall] = set.mock.calls;
    expect(firstCall[0].roomName).not.toEqual(secondCall[0].roomName);
  });

  it('defaults studentCount to 0 when omitted', async () => {
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createCreateClassHandler(db, serverTimestamp);
    const res = makeRes();
    const req: any = { body: { title: 'Cálculo III', scheduledAtMs: 1751554800000 } };

    await handler({ ...req, body: { ...req.body, idempotencyKey: 'create-class-key-002' } }, res, jest.fn());

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ studentCount: 0 }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('defaults durationMinutes to 60 when omitted', async () => {
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createCreateClassHandler(db, serverTimestamp);
    const res = makeRes();
    const req: any = { body: { title: 'Cálculo III', scheduledAtMs: 1751554800000, idempotencyKey: 'create-class-key-002' } };

    await handler(req, res, jest.fn());

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ durationMinutes: 60 }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 400 when durationMinutes is provided but invalid', async () => {
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createCreateClassHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: { title: 'x', scheduledAtMs: 1751554800000, durationMinutes: 0 } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(set).not.toHaveBeenCalled();
  });

  it('returns 400 when durationMinutes exceeds the max', async () => {
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createCreateClassHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: { title: 'x', scheduledAtMs: 1751554800000, durationMinutes: 481 } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(set).not.toHaveBeenCalled();
  });

  it('returns the existing class for a repeated idempotency key without writing another class', async () => {
    const { db, userGet, docGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({
      exists: true,
      data: () => ({
        title: 'Cálculo III', roomName: 'calculo-iii', scheduledAt: { toMillis: () => 1751554800000 }, studentCount: 0,
      }),
    });
    const res = makeRes();

    await createCreateClassHandler(db, serverTimestamp)(
      { body: { title: 'Cálculo III', scheduledAtMs: 1751554800000, idempotencyKey: 'create-class-key-004' } } as any,
      res,
      jest.fn()
    );

    expect(set).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 'create-class-key-004', title: 'Cálculo III' }));
  });

  it('rejects reuse of an occurrence id that has a cancellation tombstone', async () => {
    const { db, userGet, tombstoneGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    tombstoneGet.mockResolvedValue({
      exists: true,
      data: () => ({ reason: 'canceled', canceledAt: { toMillis: () => 1751550000000 } }),
    });
    const res = makeRes();

    await createCreateClassHandler(db, serverTimestamp)(
      {
        body: { title: 'Cálculo III', scheduledAtMs: 1751554800000, idempotencyKey: 'create-class-key-tombstone' },
      } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        message: 'class occurrence canceled',
        explanation: 'Esta ocurrencia de clase ya fue cancelada y no puede volver a crearse.',
      },
    });
    expect(set).not.toHaveBeenCalled();
  });

  it('reads the owned source and tombstone in one transaction so create/delete races cannot resurrect the id', async () => {
    const { db, userGet, transaction, classDoc, tombstoneDoc } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const res = makeRes();

    await createCreateClassHandler(db, serverTimestamp)(
      {
        body: { title: 'Física', scheduledAtMs: 1751554800000, idempotencyKey: 'create-class-key-race' },
      } as any,
      res,
      jest.fn()
    );

    expect(transaction.get.mock.calls.map(call => call[0])).toEqual([
      classDoc.mock.results[0].value,
      tombstoneDoc.mock.results[0].value,
    ]);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('scopes tombstone checks to the verified uid instead of a request uid', async () => {
    const { db, userGet, userDoc } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });

    await createCreateClassHandler(db, serverTimestamp)(
      {
        body: {
          uid: 'uid-2',
          title: 'Física',
          scheduledAtMs: 1751554800000,
          idempotencyKey: 'create-class-key-owned',
        },
      } as any,
      makeRes(),
      jest.fn()
    );

    expect(userDoc).toHaveBeenCalledWith('uid-1');
    expect(userDoc).not.toHaveBeenCalledWith('uid-2');
  });

  it('returns 401 when the middleware did not attach a verified user', async () => {
    const { db, set } = makeDb();
    const handler = createCreateClassHandler(db, serverTimestamp);
    const res = makeRes();
    res.locals = {};

    await handler({ body: {} } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(set).not.toHaveBeenCalled();
  });

  it('returns 403 without saving when the caller is a student', async () => {
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => studentProfile });
    const handler = createCreateClassHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: { title: 'x', scheduledAtMs: 1 } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(set).not.toHaveBeenCalled();
  });

  it('returns 400 when title is missing', async () => {
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createCreateClassHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: { title: '   ', scheduledAtMs: 1751554800000 } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(set).not.toHaveBeenCalled();
  });

  it('returns 400 when scheduledAtMs is missing', async () => {
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createCreateClassHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: { title: 'x' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(set).not.toHaveBeenCalled();
  });

  it('returns 400 when scheduledAtMs is not a finite number', async () => {
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createCreateClassHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: { title: 'x', scheduledAtMs: Infinity } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(set).not.toHaveBeenCalled();
  });

  it('returns 400 when scheduledAtMs is more than a minute in the past', async () => {
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createCreateClassHandler(db, serverTimestamp);
    const res = makeRes();

    await handler(
      {
        body: {
          title: 'x',
          scheduledAtMs: FROZEN_NOW - 2 * 60 * 1000,
          idempotencyKey: 'create-class-key-past',
        },
      } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(set).not.toHaveBeenCalled();
  });

  it('allows scheduledAtMs within the 1 minute clock-skew tolerance', async () => {
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createCreateClassHandler(db, serverTimestamp);
    const res = makeRes();

    await handler(
      {
        body: {
          title: 'x',
          scheduledAtMs: FROZEN_NOW - 30 * 1000,
          idempotencyKey: 'create-class-key-skew',
        },
      } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(set).toHaveBeenCalled();
  });

  it('returns the existing class for a repeated idempotency key even if its scheduledAtMs is now in the past', async () => {
    const { db, userGet, docGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({
      exists: true,
      data: () => ({ title: 'x', roomName: 'x-abc12345', scheduledAt: { toMillis: () => FROZEN_NOW - 2 * 60 * 1000 } }),
    });
    const handler = createCreateClassHandler(db, serverTimestamp);
    const res = makeRes();

    await handler(
      {
        body: { title: 'x', scheduledAtMs: FROZEN_NOW - 2 * 60 * 1000, idempotencyKey: 'create-class-key-retry' },
      } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(set).not.toHaveBeenCalled();
  });

  it('returns 400 when studentCount is provided but invalid', async () => {
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createCreateClassHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: { title: 'x', scheduledAtMs: 1751554800000, studentCount: -1 } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(set).not.toHaveBeenCalled();
  });

  it('returns 400 when studentCount exceeds the max', async () => {
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createCreateClassHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: { title: 'x', scheduledAtMs: 1751554800000, studentCount: 501 } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(set).not.toHaveBeenCalled();
  });

  it('returns 503 when the Firestore save fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    set.mockRejectedValue(new Error('firestore down'));
    const handler = createCreateClassHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: { title: 'x', scheduledAtMs: 1751554800000, idempotencyKey: 'create-class-key-003' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    consoleError.mockRestore();
  });
});

describe('createStartClassHandler', () => {
  afterEach(jest.clearAllMocks);

  it('marks only the verified teacher-owned class with its persisted roomName as started', async () => {
    const { db, userGet, docGet, update } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({ exists: true, data: () => ({ roomName: 'algebra-lineal', status: 'scheduled' }) });
    const handler = createStartClassHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ params: { id: 'class-1' }, body: { roomName: 'algebra-lineal' } } as any, res, jest.fn());

    expect(update).toHaveBeenCalledWith({ status: 'started', startedAt: 'server-timestamp' });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects a roomName that does not match the scheduled class', async () => {
    const { db, userGet, docGet, update } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({ exists: true, data: () => ({ roomName: 'algebra-lineal' }) });
    const res = makeRes();

    await createStartClassHandler(db, serverTimestamp)(
      { params: { id: 'class-1' }, body: { roomName: 'otro-room' } } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('createDeleteClassHandler', () => {
  afterEach(jest.clearAllMocks);

  it('transactionally tombstones and deletes an unstarted occurrence with a trusted timestamp', async () => {
    const { db, userGet, docGet, tombstoneSet, del, transaction } = makeDb();
    const scheduledAt = { toMillis: () => 1751554800000 };
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({ exists: true, data: () => ({ title: 'x', status: 'scheduled', scheduledAt }) });
    const handler = createDeleteClassHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ params: { id: 'class-1' }, body: { reason: 'canceled' } } as any, res, jest.fn());

    // docRef + tombstoneRef, then the notification cleanup reads: notificationState
    // + one get per candidate class notification (class.upcoming, class.not_started).
    expect(transaction.get).toHaveBeenCalledTimes(5);
    expect(tombstoneSet).toHaveBeenCalledWith({
      scheduledAt,
      canceledAt: 'server-timestamp',
      reason: 'canceled',
      wasStarted: false,
    });
    expect(del).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ deleted: true });
  });

  it('deletes a matching stale class.upcoming notification and decrements the unread count', async () => {
    const {
      db, userGet, docGet, notificationStateGet, notificationStateUpdate, notificationItemGet, notificationItemDelete,
    } = makeDb();
    const scheduledAt = { toMillis: () => 1751554800000 };
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({ exists: true, data: () => ({ title: 'x', status: 'scheduled', scheduledAt }) });
    notificationStateGet.mockResolvedValue({ exists: true, data: () => ({ currentGeneration: 3, unreadCount: 2, readBefore: null }) });
    const upcomingId = canonicalNotificationId('class.upcoming', 'class:class-1:upcoming');
    const notStartedId = canonicalNotificationId('class.not_started', 'class:class-1:not-started');
    notificationItemGet.mockImplementation(async () => ({ exists: false, data: () => undefined }));
    notificationItemGet.mockImplementationOnce(async () => ({
      exists: true, data: () => ({ createdAt: { toMillis: () => 100 }, readAt: null }),
    }));
    const res = makeRes();

    await createDeleteClassHandler(db, serverTimestamp)(
      { params: { id: 'class-1' }, body: { reason: 'canceled' } } as any,
      res,
      jest.fn()
    );

    expect(notificationItemDelete).toHaveBeenCalledTimes(1);
    expect(notificationStateUpdate).toHaveBeenCalledWith({ unreadCount: 1 });
    expect(res.status).toHaveBeenCalledWith(200);
    // sanity: both canonical class-notification ids were considered (order-independent).
    expect([upcomingId, notStartedId].length).toBe(2);
  });

  it('does not decrement unread count for a notification the teacher already read', async () => {
    const { db, userGet, docGet, notificationStateGet, notificationStateUpdate, notificationItemGet, notificationItemDelete } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({ exists: true, data: () => ({ title: 'x', status: 'scheduled', scheduledAt: 'ts' }) });
    notificationStateGet.mockResolvedValue({ exists: true, data: () => ({ currentGeneration: 0, unreadCount: 1, readBefore: null }) });
    notificationItemGet.mockImplementation(async () => ({ exists: false, data: () => undefined }));
    notificationItemGet.mockImplementationOnce(async () => ({
      exists: true, data: () => ({ createdAt: { toMillis: () => 100 }, readAt: { toMillis: () => 150 } }),
    }));
    const res = makeRes();

    await createDeleteClassHandler(db, serverTimestamp)({ params: { id: 'class-1' } } as any, res, jest.fn());

    expect(notificationItemDelete).toHaveBeenCalledTimes(1);
    expect(notificationStateUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('does not touch notification state when no matching notification exists', async () => {
    const { db, userGet, docGet, notificationStateGet, notificationStateUpdate, notificationItemDelete } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({ exists: true, data: () => ({ title: 'x', status: 'scheduled', scheduledAt: 'ts' }) });
    notificationStateGet.mockResolvedValue({ exists: true, data: () => ({ currentGeneration: 0, unreadCount: 1, readBefore: null }) });
    const res = makeRes();

    await createDeleteClassHandler(db, serverTimestamp)({ params: { id: 'class-1' } } as any, res, jest.fn());

    expect(notificationItemDelete).not.toHaveBeenCalled();
    expect(notificationStateUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('replays an already tombstoned deletion without overwriting its trusted timestamp', async () => {
    const { db, userGet, tombstoneGet, tombstoneSet, del } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    tombstoneGet.mockResolvedValue({ exists: true, data: () => ({ canceledAt: 'original-server-timestamp' }) });
    const res = makeRes();

    await createDeleteClassHandler(db, serverTimestamp)(
      { params: { id: 'class-1' }, body: { reason: 'deleted' } } as any,
      res,
      jest.fn()
    );

    expect(tombstoneSet).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ deleted: true });
  });

  it.each(['started', 'completed'])('deletes a %s occurrence without creating an unstarted tombstone', async status => {
    const { db, userGet, docGet, tombstoneSet, del } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({ exists: true, data: () => ({ title: 'x', status }) });
    const res = makeRes();

    await createDeleteClassHandler(db, serverTimestamp)({ params: { id: 'class-1' } } as any, res, jest.fn());

    expect(del).toHaveBeenCalled();
    expect(tombstoneSet).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('deletes a stale scheduled source when its tombstone already exists without rewriting the tombstone', async () => {
    const { db, userGet, docGet, tombstoneGet, tombstoneSet, del } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({ exists: true, data: () => ({ status: 'scheduled', scheduledAt: 'old-schedule' }) });
    tombstoneGet.mockResolvedValue({ exists: true, data: () => ({ canceledAt: 'trusted-original' }) });
    const res = makeRes();

    await createDeleteClassHandler(db, serverTimestamp)(
      { params: { id: 'class-1' }, body: { canceledAt: 'client-time', uid: 'uid-2' } } as any,
      res,
      jest.fn()
    );

    expect(del).toHaveBeenCalled();
    expect(tombstoneSet).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 401 when the middleware did not attach a verified user', async () => {
    const { db, del } = makeDb();
    const handler = createDeleteClassHandler(db);
    const res = makeRes();
    res.locals = {};

    await handler({ params: { id: 'class-1' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(del).not.toHaveBeenCalled();
  });

  it('returns 403 without reading when the caller is a student', async () => {
    const { db, userGet, docGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => studentProfile });
    const handler = createDeleteClassHandler(db);
    const res = makeRes();

    await handler({ params: { id: 'class-1' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(docGet).not.toHaveBeenCalled();
  });

  it('returns 404 when the class does not exist', async () => {
    const { db, userGet, docGet, del } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({ exists: false, data: () => undefined });
    const handler = createDeleteClassHandler(db);
    const res = makeRes();

    await handler({ params: { id: 'missing' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(del).not.toHaveBeenCalled();
  });

  it('returns 503 when the Firestore delete fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db, userGet, docGet, del } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({ exists: true, data: () => ({ title: 'x' }) });
    del.mockRejectedValue(new Error('firestore down'));
    const handler = createDeleteClassHandler(db);
    const res = makeRes();

    await handler({ params: { id: 'class-1' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    consoleError.mockRestore();
  });
});
