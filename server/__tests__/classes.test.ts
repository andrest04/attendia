import { createGetClassesHandler, createCreateClassHandler, createDeleteClassHandler, ClassesDatabase } from '../classes';

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
  const docGet = jest.fn();
  const set = jest.fn(() => Promise.resolve());
  const del = jest.fn(() => Promise.resolve());
  const classesGet = jest.fn();
  const limit = jest.fn(() => ({ get: classesGet }));
  const orderBy = jest.fn(() => ({ limit }));
  const classDoc = jest.fn((id?: string) => ({ id: id || 'auto-id-1', get: docGet, set, delete: del }));
  const classesCollection = jest.fn(() => ({ doc: classDoc, orderBy }));
  const userDoc = jest.fn(() => ({ get: userGet, collection: classesCollection }));
  const collection = jest.fn(() => ({ doc: userDoc }));
  const db = ({ collection } as unknown) as ClassesDatabase;
  return { db, collection, userDoc, userGet, classesCollection, classDoc, docGet, set, del, orderBy, limit, classesGet };
};

const teacherProfile = { displayName: 'Ana García', email: 'ana@example.com', role: 'teacher' };
const studentProfile = { displayName: 'Beto Díaz', email: 'beto@example.com', role: 'student' };

const serverTimestamp = jest.fn(() => 'server-timestamp');

describe('createGetClassesHandler', () => {
  afterEach(jest.clearAllMocks);

  it('returns the scheduled classes soonest first, mapping the doc id and the timestamp', async () => {
    const { db, userGet, orderBy, limit, classesGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    classesGet.mockResolvedValue({
      docs: [
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
      ],
    });
    const handler = createGetClassesHandler(db);
    const res = makeRes();

    await handler({} as any, res, jest.fn());

    expect(orderBy).toHaveBeenCalledWith('scheduledAt', 'asc');
    expect(limit).toHaveBeenCalledWith(200);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      {
        id: 'class-1',
        title: 'Matemáticas — Grupo A',
        roomName: 'matematicas-grupo-a',
        scheduledAtMs: 1751554800000,
        studentCount: 28,
      },
      {
        id: 'class-2',
        title: 'Álgebra Lineal',
        roomName: 'algebra-lineal',
        scheduledAtMs: null,
        studentCount: 32,
      },
    ]);
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
  afterEach(jest.clearAllMocks);

  it('creates the class doc with a slugified roomName and returns 201', async () => {
    const { db, userGet, classDoc, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createCreateClassHandler(db, serverTimestamp);
    const res = makeRes();
    const req: any = { body: { title: 'Matemáticas — Grupo A', scheduledAtMs: 1751554800000, studentCount: 28 } };

    await handler(req, res, jest.fn());

    expect(classDoc).toHaveBeenCalledWith();
    expect(set).toHaveBeenCalledWith({
      title: 'Matemáticas — Grupo A',
      roomName: 'matematicas-grupo-a',
      scheduledAt: new Date(1751554800000),
      studentCount: 28,
      status: 'scheduled',
      createdAt: 'server-timestamp',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      id: 'auto-id-1',
      title: 'Matemáticas — Grupo A',
      roomName: 'matematicas-grupo-a',
      scheduledAtMs: 1751554800000,
      studentCount: 28,
    });
  });

  it('defaults studentCount to 0 when omitted', async () => {
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createCreateClassHandler(db, serverTimestamp);
    const res = makeRes();
    const req: any = { body: { title: 'Cálculo III', scheduledAtMs: 1751554800000 } };

    await handler(req, res, jest.fn());

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ studentCount: 0 }));
    expect(res.status).toHaveBeenCalledWith(201);
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

  it('returns 400 when studentCount is provided but invalid', async () => {
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createCreateClassHandler(db, serverTimestamp);
    const res = makeRes();

    await handler(
      { body: { title: 'x', scheduledAtMs: 1751554800000, studentCount: -1 } } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(set).not.toHaveBeenCalled();
  });

  it('returns 400 when studentCount exceeds the max', async () => {
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createCreateClassHandler(db, serverTimestamp);
    const res = makeRes();

    await handler(
      { body: { title: 'x', scheduledAtMs: 1751554800000, studentCount: 501 } } as any,
      res,
      jest.fn()
    );

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

    await handler({ body: { title: 'x', scheduledAtMs: 1751554800000 } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    consoleError.mockRestore();
  });
});

describe('createDeleteClassHandler', () => {
  afterEach(jest.clearAllMocks);

  it('deletes the Firestore doc and returns 200', async () => {
    const { db, userGet, docGet, del } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({ exists: true, data: () => ({ title: 'x' }) });
    const handler = createDeleteClassHandler(db);
    const res = makeRes();

    await handler({ params: { id: 'class-1' } } as any, res, jest.fn());

    expect(del).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ deleted: true });
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
