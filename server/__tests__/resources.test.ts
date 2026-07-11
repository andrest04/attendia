import {
  createGetResourcesHandler,
  createUploadResourceHandler,
  createDownloadResourceHandler,
  createDeleteResourceHandler,
  ResourcesDatabase,
} from '../resources';

const makeRes = () => {
  const res: any = { locals: { firebaseUser: { uid: 'uid-1', email: 'ana@example.com' } } };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
};

// Fake of the minimal Firestore surface the handlers use (users/{uid} profile doc +
// its "resources" subcollection with doc()/orderBy().limit().get()).
const makeDb = () => {
  const userGet = jest.fn();
  const docGet = jest.fn();
  const set = jest.fn(() => Promise.resolve());
  const del = jest.fn(() => Promise.resolve());
  const resourcesGet = jest.fn();
  const limit = jest.fn(() => ({ get: resourcesGet }));
  const orderBy = jest.fn(() => ({ limit }));
  const resourceDoc = jest.fn((id?: string) => ({ id: id || 'auto-id-1', get: docGet, set, delete: del }));
  const resourcesCollection = jest.fn(() => ({ doc: resourceDoc, orderBy }));
  const userDoc = jest.fn(() => ({ get: userGet, collection: resourcesCollection }));
  const collection = jest.fn(() => ({ doc: userDoc }));
  const db = ({ collection } as unknown) as ResourcesDatabase;
  return { db, collection, userDoc, userGet, resourcesCollection, resourceDoc, docGet, set, del, orderBy, limit, resourcesGet };
};

const teacherProfile = { displayName: 'Ana García', email: 'ana@example.com', role: 'teacher' };
const studentProfile = { displayName: 'Beto Díaz', email: 'beto@example.com', role: 'student' };

const serverTimestamp = jest.fn(() => 'server-timestamp');

const makeUploadedFile = (overrides: Partial<{ originalname: string; mimetype: string; size: number; buffer: Buffer }> = {}) => ({
  originalname: 'clase-1.pdf',
  mimetype: 'application/pdf',
  size: 1024,
  buffer: Buffer.from('data'),
  ...overrides,
});

describe('createGetResourcesHandler', () => {
  afterEach(jest.clearAllMocks);

  it('returns the stored resources newest first, mapping the doc id and the server timestamp', async () => {
    const { db, userGet, orderBy, limit, resourcesGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    resourcesGet.mockResolvedValue({
      docs: [
        {
          id: 'res-2',
          data: () => ({
            name: 'clase-2.pdf',
            kind: 'pdf',
            roomLabel: 'Cálculo I',
            sizeBytes: 2048,
            contentType: 'application/pdf',
            createdAt: { toMillis: () => 1751554800000 },
          }),
        },
        {
          id: 'res-1',
          data: () => ({
            name: 'clase-1.pdf',
            kind: 'pdf',
            roomLabel: 'Cálculo I',
            sizeBytes: 1024,
            contentType: 'application/pdf',
            createdAt: undefined,
          }),
        },
      ],
    });
    const handler = createGetResourcesHandler(db);
    const res = makeRes();

    await handler({} as any, res, jest.fn());

    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(limit).toHaveBeenCalledWith(200);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      {
        id: 'res-2',
        name: 'clase-2.pdf',
        kind: 'pdf',
        roomLabel: 'Cálculo I',
        sizeBytes: 2048,
        contentType: 'application/pdf',
        createdAtMs: 1751554800000,
      },
      {
        id: 'res-1',
        name: 'clase-1.pdf',
        kind: 'pdf',
        roomLabel: 'Cálculo I',
        sizeBytes: 1024,
        contentType: 'application/pdf',
        createdAtMs: null,
      },
    ]);
  });

  it('returns 401 when the middleware did not attach a verified user', async () => {
    const { db, userGet } = makeDb();
    const handler = createGetResourcesHandler(db);
    const res = makeRes();
    res.locals = {};

    await handler({} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(userGet).not.toHaveBeenCalled();
  });

  it('returns 403 without querying when the caller is a student', async () => {
    const { db, userGet, resourcesGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => studentProfile });
    const handler = createGetResourcesHandler(db);
    const res = makeRes();

    await handler({} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(resourcesGet).not.toHaveBeenCalled();
  });

  it('returns 503 when the Firestore query fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db, userGet, resourcesGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    resourcesGet.mockRejectedValue(new Error('firestore down'));
    const handler = createGetResourcesHandler(db);
    const res = makeRes();

    await handler({} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    consoleError.mockRestore();
  });
});

describe('createUploadResourceHandler', () => {
  afterEach(jest.clearAllMocks);

  it('saves the Firestore doc with the base64-encoded content and returns 201', async () => {
    const { db, userGet, resourceDoc, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createUploadResourceHandler(db, serverTimestamp);
    const res = makeRes();
    const req: any = { body: { roomLabel: 'Cálculo I' }, file: makeUploadedFile() };

    await handler(req, res, jest.fn());

    expect(resourceDoc).toHaveBeenCalledWith();
    expect(set).toHaveBeenCalledWith({
      name: 'clase-1.pdf',
      kind: 'pdf',
      roomLabel: 'Cálculo I',
      sizeBytes: 1024,
      contentType: 'application/pdf',
      content: req.file.buffer.toString('base64'),
      createdAt: 'server-timestamp',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'auto-id-1', name: 'clase-1.pdf', kind: 'pdf', roomLabel: 'Cálculo I' })
    );
  });

  it('returns 401 when the middleware did not attach a verified user', async () => {
    const { db, set } = makeDb();
    const handler = createUploadResourceHandler(db, serverTimestamp);
    const res = makeRes();
    res.locals = {};

    await handler({ body: {}, file: makeUploadedFile() } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(set).not.toHaveBeenCalled();
  });

  it('returns 403 without saving when the caller is a student', async () => {
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => studentProfile });
    const handler = createUploadResourceHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: { roomLabel: 'x' }, file: makeUploadedFile() } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(set).not.toHaveBeenCalled();
  });

  it('returns 400 when no file is attached', async () => {
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createUploadResourceHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: { roomLabel: 'x' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(set).not.toHaveBeenCalled();
  });

  it('returns 400 when the file exceeds the max size', async () => {
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createUploadResourceHandler(db, serverTimestamp);
    const res = makeRes();

    await handler(
      { body: { roomLabel: 'x' }, file: makeUploadedFile({ size: 701 * 1024 }) } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(set).not.toHaveBeenCalled();
  });

  it('returns 400 for an unsupported mime type', async () => {
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createUploadResourceHandler(db, serverTimestamp);
    const res = makeRes();

    await handler(
      { body: { roomLabel: 'x' }, file: makeUploadedFile({ mimetype: 'application/zip' }) } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(set).not.toHaveBeenCalled();
  });

  it('returns 400 when roomLabel is missing', async () => {
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createUploadResourceHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: { roomLabel: '   ' }, file: makeUploadedFile() } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(set).not.toHaveBeenCalled();
  });

  it('returns 503 when the Firestore save fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db, userGet, set } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    set.mockRejectedValue(new Error('firestore down'));
    const handler = createUploadResourceHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: { roomLabel: 'x' }, file: makeUploadedFile() } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    consoleError.mockRestore();
  });
});

describe('createDownloadResourceHandler', () => {
  afterEach(jest.clearAllMocks);

  it('returns the base64 content, contentType and name for an existing resource', async () => {
    const { db, userGet, docGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({
      exists: true,
      data: () => ({ content: 'YmFzZTY0...', contentType: 'application/pdf', name: 'clase.pdf' }),
    });
    const handler = createDownloadResourceHandler(db);
    const res = makeRes();

    await handler({ params: { id: 'res-1' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      content: 'YmFzZTY0...',
      contentType: 'application/pdf',
      name: 'clase.pdf',
    });
  });

  it('returns 404 when the resource does not exist', async () => {
    const { db, userGet, docGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({ exists: false, data: () => undefined });
    const handler = createDownloadResourceHandler(db);
    const res = makeRes();

    await handler({ params: { id: 'missing' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ content: expect.anything() }));
  });

  it('returns 403 without reading when the caller is a student', async () => {
    const { db, userGet, docGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => studentProfile });
    const handler = createDownloadResourceHandler(db);
    const res = makeRes();

    await handler({ params: { id: 'res-1' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(docGet).not.toHaveBeenCalled();
  });
});

describe('createDeleteResourceHandler', () => {
  afterEach(jest.clearAllMocks);

  it('deletes the Firestore doc and returns 200', async () => {
    const { db, userGet, docGet, del } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({ exists: true, data: () => ({ content: 'YmFzZTY0...' }) });
    const handler = createDeleteResourceHandler(db);
    const res = makeRes();

    await handler({ params: { id: 'res-1' } } as any, res, jest.fn());

    expect(del).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ deleted: true });
  });

  it('returns 404 when the resource does not exist', async () => {
    const { db, userGet, docGet, del } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({ exists: false, data: () => undefined });
    const handler = createDeleteResourceHandler(db);
    const res = makeRes();

    await handler({ params: { id: 'missing' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(del).not.toHaveBeenCalled();
  });

  it('returns 403 without reading when the caller is a student', async () => {
    const { db, userGet, docGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => studentProfile });
    const handler = createDeleteResourceHandler(db);
    const res = makeRes();

    await handler({ params: { id: 'res-1' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(docGet).not.toHaveBeenCalled();
  });
});
