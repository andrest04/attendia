import { createGetProfileHandler, createPostProfileHandler, ProfileDatabase } from '../userProfiles';

const makeRes = () => {
  const res: any = { locals: { firebaseUser: { uid: 'uid-1', email: 'ana@example.com' } } };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
};

// Fake of the minimal Firestore surface the handlers use. Never touches the network.
const makeDb = () => {
  const get = jest.fn();
  const set = jest.fn(() => Promise.resolve());
  const doc = jest.fn(() => ({ get, set }));
  const collection = jest.fn(() => ({ doc }));
  const db = ({ collection } as unknown) as ProfileDatabase;
  return { db, collection, doc, get, set };
};

const storedProfile = { displayName: 'Ana García', email: 'ana@example.com', role: 'student', createdAt: 'ts' };

const serverTimestamp = jest.fn(() => 'server-timestamp');

describe('createGetProfileHandler', () => {
  afterEach(jest.clearAllMocks);

  it('returns 200 with the stored profile for the verified uid', async () => {
    const { db, collection, doc, get } = makeDb();
    get.mockResolvedValue({ exists: true, data: () => storedProfile });
    const handler = createGetProfileHandler(db);
    const res = makeRes();

    await handler({} as any, res, jest.fn());

    expect(collection).toHaveBeenCalledWith('users');
    expect(doc).toHaveBeenCalledWith('uid-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      displayName: 'Ana García',
      email: 'ana@example.com',
      role: 'student',
    });
  });

  it('returns 404 when there is no profile document', async () => {
    const { db, get } = makeDb();
    get.mockResolvedValue({ exists: false, data: () => undefined });
    const handler = createGetProfileHandler(db);
    const res = makeRes();

    await handler({} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ message: 'profile not found' }) })
    );
  });

  it('returns 503 when Firestore fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db, get } = makeDb();
    get.mockRejectedValue(new Error('firestore down'));
    const handler = createGetProfileHandler(db);
    const res = makeRes();

    await handler({} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ message: 'profile lookup failed' }) })
    );
    consoleError.mockRestore();
  });

  it('returns 401 when the middleware did not attach a verified user', async () => {
    const { db, get } = makeDb();
    const handler = createGetProfileHandler(db);
    const res = makeRes();
    res.locals = {};

    await handler({} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(get).not.toHaveBeenCalled();
  });
});

describe('createPostProfileHandler', () => {
  afterEach(jest.clearAllMocks);

  it('creates the profile with the token email and a server timestamp, returning 201', async () => {
    const { db, doc, get, set } = makeDb();
    get.mockResolvedValue({ exists: false, data: () => undefined });
    const handler = createPostProfileHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: { displayName: 'Ana García', role: 'teacher' } } as any, res, jest.fn());

    expect(doc).toHaveBeenCalledWith('uid-1');
    expect(set).toHaveBeenCalledWith({
      displayName: 'Ana García',
      email: 'ana@example.com',
      role: 'teacher',
      createdAt: 'server-timestamp',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      displayName: 'Ana García',
      email: 'ana@example.com',
      role: 'teacher',
    });
  });

  it('does not modify an existing profile (role is write-once) and returns it with 200', async () => {
    const { db, get, set } = makeDb();
    get.mockResolvedValue({ exists: true, data: () => storedProfile });
    const handler = createPostProfileHandler(db, serverTimestamp);
    const res = makeRes();

    // The caller tries to flip their role to teacher — the stored profile must win.
    await handler({ body: { displayName: 'Other Name', role: 'teacher' } } as any, res, jest.fn());

    expect(set).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      displayName: 'Ana García',
      email: 'ana@example.com',
      role: 'student',
    });
  });

  it('rejects an invalid role with 400', async () => {
    const { db, get, set } = makeDb();
    const handler = createPostProfileHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: { displayName: 'Ana', role: 'admin' } } as any, res, jest.fn());

    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ message: 'invalid role' }) })
    );
  });

  it('rejects a missing role with 400', async () => {
    const { db, set } = makeDb();
    const handler = createPostProfileHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: { displayName: 'Ana' } } as any, res, jest.fn());

    expect(set).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects an empty displayName with 400', async () => {
    const { db, set } = makeDb();
    const handler = createPostProfileHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: { displayName: '   ', role: 'student' } } as any, res, jest.fn());

    expect(set).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ message: 'invalid displayName' }) })
    );
  });

  it('returns 503 when the Firestore write fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db, get, set } = makeDb();
    get.mockResolvedValue({ exists: false, data: () => undefined });
    set.mockRejectedValue(new Error('firestore down'));
    const handler = createPostProfileHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: { displayName: 'Ana', role: 'student' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ message: 'profile save failed' }) })
    );
    consoleError.mockRestore();
  });

  it('returns 401 when the middleware did not attach a verified user', async () => {
    const { db, get } = makeDb();
    const handler = createPostProfileHandler(db, serverTimestamp);
    const res = makeRes();
    res.locals = {};

    await handler({ body: { displayName: 'Ana', role: 'student' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(get).not.toHaveBeenCalled();
  });
});
