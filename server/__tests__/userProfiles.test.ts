import {
  createGetProfileHandler,
  createPatchProfileHandler,
  createPostProfileHandler,
  createUploadAvatarHandler,
  createDeleteAvatarHandler,
  createAvatarUploadErrorHandler,
  AVATAR_UPLOAD_LIMITS,
  MAX_AVATAR_FILE_SIZE_BYTES,
  ProfileDatabase,
} from '../userProfiles';
import { createClientOperationalEventHandler } from '../operationalEvents';
import { FileStorage } from '../fileStorage';

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

// Fake FileStorage test double — no Appwrite import anywhere in this test file.
const makeFileStorage = () => {
  const upload = jest.fn(() => Promise.resolve({ fileId: 'avatar-file-1', url: 'https://appwrite.example/avatar-file-1' }));
  const download = jest.fn(() => Promise.resolve(Buffer.from('')));
  const del = jest.fn(() => Promise.resolve());
  const fileStorage = ({ upload, download, delete: del } as unknown) as FileStorage;
  return { fileStorage, upload, download, del };
};

const makeAvatarFile = (overrides: Partial<{ originalname: string; mimetype: string; size: number; buffer: Buffer }> = {}) => ({
  originalname: 'avatar.jpg',
  mimetype: 'image/jpeg',
  size: 1024,
  buffer: Buffer.from('image-bytes'),
  ...overrides,
});

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
      avatarRemoved: false,
    });
  });

  it('returns the Appwrite avatar URL when the profile has one', async () => {
    const { db, get } = makeDb();
    get.mockResolvedValue({
      exists: true,
      data: () => ({ ...storedProfile, avatarUrl: 'https://appwrite.example/avatar-1', avatarDataUrl: 'data:image/jpeg;base64,AA==' }),
    });
    const res = makeRes();

    await createGetProfileHandler(db)({} as any, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ avatarUrl: 'https://appwrite.example/avatar-1' }));
  });

  it('maps a validated PNG legacy avatarDataUrl to avatarUrl when there is no Appwrite URL', async () => {
    const { db, get } = makeDb();
    const avatarDataUrl = 'data:image/png;base64,AA==';
    get.mockResolvedValue({ exists: true, data: () => ({ ...storedProfile, avatarDataUrl }) });
    const res = makeRes();

    await createGetProfileHandler(db)({} as any, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ avatarUrl: avatarDataUrl }));
  });

  it.each([
    ['malformed base64', 'data:image/png;base64,AA*'],
    ['unsupported image format', 'data:image/gif;base64,AA=='],
    ['oversized data URL', `data:image/png;base64,${'A'.repeat(100000)}`],
  ])('omits a %s legacy avatarDataUrl', async (_description, avatarDataUrl) => {
    const { db, get } = makeDb();
    get.mockResolvedValue({ exists: true, data: () => ({ ...storedProfile, avatarDataUrl }) });
    const res = makeRes();

    await createGetProfileHandler(db)({} as any, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ avatarUrl: undefined }));
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
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('"failure":"profile_read_failed"'));
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

describe('createClientOperationalEventHandler', () => {
  afterEach(jest.clearAllMocks);

  it('logs a safe browser profile failure against the verified uid', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const handler = createClientOperationalEventHandler();
    const res = makeRes();

    handler({ body: { operation: 'profile_email_change_confirm', failure: 'auth/network-request-failed' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(204);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('"failure":"client_profile_failure"')
    );
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('"uid":"uid-1"'));
    consoleError.mockRestore();
  });
});

describe('createPostProfileHandler', () => {
  afterEach(jest.clearAllMocks);

  it('creates only a student profile with the token email and a server timestamp, returning 201', async () => {
    const { db, doc, get, set } = makeDb();
    get.mockResolvedValue({ exists: false, data: () => undefined });
    const handler = createPostProfileHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: { displayName: 'Ana García', role: 'student' } } as any, res, jest.fn());

    expect(doc).toHaveBeenCalledWith('uid-1');
    expect(set).toHaveBeenCalledWith({
      displayName: 'Ana García',
      email: 'ana@example.com',
      role: 'student',
      createdAt: 'server-timestamp',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      displayName: 'Ana García',
      email: 'ana@example.com',
      role: 'student',
    });
  });

  it('does not modify an existing profile when the request remains a student registration', async () => {
    const { db, get, set } = makeDb();
    get.mockResolvedValue({ exists: true, data: () => storedProfile });
    const handler = createPostProfileHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: { displayName: 'Other Name', role: 'student' } } as any, res, jest.fn());

    expect(set).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      displayName: 'Ana García',
      email: 'ana@example.com',
      role: 'student',
      avatarRemoved: false,
    });
  });

  it('creates a teacher profile when the client requests the teacher role', async () => {
    const { db, get, set } = makeDb();
    get.mockResolvedValue({ exists: false, data: () => undefined });
    const handler = createPostProfileHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: { displayName: 'Ana', role: 'teacher' } } as any, res, jest.fn());

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ role: 'teacher' }));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ role: 'teacher' }));
  });

  it('rejects a missing role with 400 before reading or writing', async () => {
    const { db, get, set } = makeDb();
    const handler = createPostProfileHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: { displayName: 'Ana' } } as any, res, jest.fn());

    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ message: 'invalid role' }) })
    );
  });

  it('rejects an invalid role with 400', async () => {
    const { db, get, set } = makeDb();
    const handler = createPostProfileHandler(db, serverTimestamp);
    const res = makeRes();

    await handler({ body: { displayName: 'Ana', role: 'admin' } } as any, res, jest.fn());

    expect(get).not.toHaveBeenCalled();
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

describe('createPatchProfileHandler', () => {
  afterEach(jest.clearAllMocks);

  it('updates only the verified teacher own name', async () => {
    const { db, doc, get, set } = makeDb();
    const teacher = { ...storedProfile, role: 'teacher' };
    get.mockResolvedValue({ exists: true, data: () => teacher });
    const handler = createPatchProfileHandler(db);
    const res = makeRes();

    await handler({ body: { displayName: 'Ana docente' } } as any, res, jest.fn());

    expect(doc).toHaveBeenCalledWith('uid-1');
    expect(set).toHaveBeenCalledWith({ displayName: 'Ana docente' }, { merge: true });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ role: 'teacher', displayName: 'Ana docente' }));
  });

  it('rejects uid, role, arbitrary email and the removed avatarDataUrl field before touching Firestore', async () => {
    const { db, get, set } = makeDb();
    const handler = createPatchProfileHandler(db);
    const res = makeRes();

    await handler({ body: { uid: 'other-user', role: 'teacher', email: 'other@example.com' } } as any, res, jest.fn());

    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects avatarDataUrl now that avatars are handled by /profile/avatar', async () => {
    const { db, get, set } = makeDb();
    const handler = createPatchProfileHandler(db);
    const res = makeRes();

    await handler({ body: { avatarDataUrl: 'data:image/jpeg;base64,AA==' } } as any, res, jest.fn());

    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('uses the verified token email when syncing after Firebase verification', async () => {
    const { db, get, set } = makeDb();
    get.mockResolvedValue({ exists: true, data: () => ({ ...storedProfile, role: 'teacher' }) });
    const handler = createPatchProfileHandler(db);
    const res = makeRes();

    await handler({ body: { syncEmail: true } } as any, res, jest.fn());

    expect(set).toHaveBeenCalledWith({ email: 'ana@example.com' }, { merge: true });
  });

  it('updates the verified student own name', async () => {
    const { db, get, set } = makeDb();
    get.mockResolvedValue({ exists: true, data: () => storedProfile });
    const handler = createPatchProfileHandler(db);
    const res = makeRes();

    await handler({ body: { displayName: 'Ana docente' } } as any, res, jest.fn());

    expect(set).toHaveBeenCalledWith({ displayName: 'Ana docente' }, { merge: true });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('clears avatarRemoved when restorePhoto is true', async () => {
    const { db, get, set } = makeDb();
    get.mockResolvedValue({ exists: true, data: () => ({ ...storedProfile, role: 'teacher', avatarRemoved: true }) });
    const handler = createPatchProfileHandler(db);
    const res = makeRes();

    await handler({ body: { restorePhoto: true } } as any, res, jest.fn());

    expect(set).toHaveBeenCalledWith({ avatarRemoved: false }, { merge: true });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ avatarRemoved: false }));
  });

  it('rejects a falsy restorePhoto value before touching Firestore', async () => {
    const { db, get, set } = makeDb();
    const handler = createPatchProfileHandler(db);
    const res = makeRes();

    await handler({ body: { restorePhoto: false } } as any, res, jest.fn());

    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('createUploadAvatarHandler', () => {
  afterEach(jest.clearAllMocks);

  it('uploads the file to storage and saves avatarUrl/avatarFileId, returning 200', async () => {
    const { db, doc, get, set } = makeDb();
    const { fileStorage, upload } = makeFileStorage();
    const teacher = { ...storedProfile, role: 'teacher' };
    get.mockResolvedValue({ exists: true, data: () => teacher });
    const handler = createUploadAvatarHandler(db, fileStorage);
    const res = makeRes();
    const file = makeAvatarFile();

    await handler({ file } as any, res, jest.fn());

    expect(doc).toHaveBeenCalledWith('uid-1');
    expect(upload).toHaveBeenCalledWith({
      buffer: file.buffer,
      contentType: 'image/jpeg',
      fileName: expect.stringContaining('uid-1-avatar-'),
    });
    expect(set).toHaveBeenCalledWith(
      { avatarUrl: 'https://appwrite.example/avatar-file-1', avatarFileId: 'avatar-file-1', avatarRemoved: false },
      { merge: true }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ avatarUrl: 'https://appwrite.example/avatar-file-1' })
    );
  });

  it('logs a failed previous-avatar cleanup without changing the successful response', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db, get, set } = makeDb();
    const { fileStorage, del } = makeFileStorage();
    del.mockRejectedValue(new Error('appwrite down'));
    const teacher = { ...storedProfile, role: 'teacher', avatarFileId: 'old-file' };
    get.mockResolvedValue({ exists: true, data: () => teacher });
    const handler = createUploadAvatarHandler(db, fileStorage);
    const res = makeRes();

    await handler({ file: makeAvatarFile() } as any, res, jest.fn());
    await Promise.resolve();

    expect(set).toHaveBeenCalled();
    expect(del).toHaveBeenCalledWith('old-file');
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('avatar_replace_cleanup_failed'));
    consoleError.mockRestore();
  });

  it('returns 401 when the middleware did not attach a verified user', async () => {
    const { db, get } = makeDb();
    const { fileStorage } = makeFileStorage();
    const handler = createUploadAvatarHandler(db, fileStorage);
    const res = makeRes();
    res.locals = {};

    await handler({ file: makeAvatarFile() } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(get).not.toHaveBeenCalled();
  });

  it('uploads a verified student avatar to their own profile', async () => {
    const { db, get } = makeDb();
    const { fileStorage, upload } = makeFileStorage();
    get.mockResolvedValue({ exists: true, data: () => storedProfile });
    const handler = createUploadAvatarHandler(db, fileStorage);
    const res = makeRes();

    await handler({ file: makeAvatarFile() } as any, res, jest.fn());

    expect(upload).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 400 when no file is attached', async () => {
    const { db, get } = makeDb();
    const { fileStorage, upload } = makeFileStorage();
    get.mockResolvedValue({ exists: true, data: () => ({ ...storedProfile, role: 'teacher' }) });
    const handler = createUploadAvatarHandler(db, fileStorage);
    const res = makeRes();

    await handler({} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it('returns 400 for an unsupported mime type', async () => {
    const { db, get } = makeDb();
    const { fileStorage, upload } = makeFileStorage();
    get.mockResolvedValue({ exists: true, data: () => ({ ...storedProfile, role: 'teacher' }) });
    const handler = createUploadAvatarHandler(db, fileStorage);
    const res = makeRes();

    await handler({ file: makeAvatarFile({ mimetype: 'image/gif' }) } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it('returns 400 when the file exceeds the max size', async () => {
    const { db, get } = makeDb();
    const { fileStorage, upload } = makeFileStorage();
    get.mockResolvedValue({ exists: true, data: () => ({ ...storedProfile, role: 'teacher' }) });
    const handler = createUploadAvatarHandler(db, fileStorage);
    const res = makeRes();

    await handler({ file: makeAvatarFile({ size: 3 * 1024 * 1024 }) } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it('returns 503 when the storage upload fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db, get, set } = makeDb();
    const { fileStorage, upload } = makeFileStorage();
    upload.mockRejectedValue(new Error('appwrite down'));
    get.mockResolvedValue({ exists: true, data: () => ({ ...storedProfile, role: 'teacher' }) });
    const handler = createUploadAvatarHandler(db, fileStorage);
    const res = makeRes();

    await handler({ file: makeAvatarFile() } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    expect(set).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('cleans up the uploaded avatar when Firestore persistence fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db, get, set } = makeDb();
    const { fileStorage, del } = makeFileStorage();
    set.mockRejectedValue(new Error('firestore down'));
    get.mockResolvedValue({ exists: true, data: () => ({ ...storedProfile, role: 'teacher' }) });
    const res = makeRes();

    await createUploadAvatarHandler(db, fileStorage)({ file: makeAvatarFile() } as any, res, jest.fn());

    expect(del).toHaveBeenCalledWith('avatar-file-1');
    expect(res.status).toHaveBeenCalledWith(503);
    consoleError.mockRestore();
  });
});

describe('createDeleteAvatarHandler', () => {
  afterEach(jest.clearAllMocks);

  it('clears Appwrite and legacy avatar fields so the deleted avatar cannot reappear', async () => {
    const { db, doc, get, set } = makeDb();
    const { fileStorage, del } = makeFileStorage();
    const teacher = {
      ...storedProfile,
      role: 'teacher',
      avatarUrl: 'https://appwrite.example/x',
      avatarFileId: 'file-x',
      avatarDataUrl: 'data:image/jpeg;base64,AA==',
    };
    get.mockResolvedValue({ exists: true, data: () => teacher });
    const handler = createDeleteAvatarHandler(db, fileStorage);
    const res = makeRes();

    await handler({} as any, res, jest.fn());
    await Promise.resolve();

    expect(doc).toHaveBeenCalledWith('uid-1');
    expect(set).toHaveBeenCalledWith(
      { avatarUrl: null, avatarFileId: null, avatarDataUrl: null, avatarRemoved: true },
      { merge: true }
    );
    expect(del).toHaveBeenCalledWith('file-x');
    expect(del.mock.invocationCallOrder[0]).toBeLessThan(set.mock.invocationCallOrder[0]);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ avatarUrl: undefined, avatarRemoved: true }));
  });

  it('does not clear the profile when Appwrite avatar deletion fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db, get, set } = makeDb();
    const { fileStorage, del } = makeFileStorage();
    del.mockRejectedValue(new Error('appwrite down'));
    get.mockResolvedValue({ exists: true, data: () => ({ ...storedProfile, role: 'teacher', avatarFileId: 'file-x' }) });
    const res = makeRes();

    await createDeleteAvatarHandler(db, fileStorage)({} as any, res, jest.fn());

    expect(set).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('avatar_delete_failed'));
    consoleError.mockRestore();
  });

  it('skips the storage delete when there was no avatarFileId', async () => {
    const { db, get, set } = makeDb();
    const { fileStorage, del } = makeFileStorage();
    const teacher = { ...storedProfile, role: 'teacher' };
    get.mockResolvedValue({ exists: true, data: () => teacher });
    const handler = createDeleteAvatarHandler(db, fileStorage);
    const res = makeRes();

    await handler({} as any, res, jest.fn());

    expect(set).toHaveBeenCalledWith(
      { avatarUrl: null, avatarFileId: null, avatarDataUrl: null, avatarRemoved: true },
      { merge: true }
    );
    expect(del).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 401 when the middleware did not attach a verified user', async () => {
    const { db, get } = makeDb();
    const { fileStorage } = makeFileStorage();
    const handler = createDeleteAvatarHandler(db, fileStorage);
    const res = makeRes();
    res.locals = {};

    await handler({} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(get).not.toHaveBeenCalled();
  });

  it('deletes a verified student avatar from their own profile', async () => {
    const { db, get } = makeDb();
    const { fileStorage } = makeFileStorage();
    get.mockResolvedValue({ exists: true, data: () => storedProfile });
    const handler = createDeleteAvatarHandler(db, fileStorage);
    const res = makeRes();

    await handler({} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 503 when Firestore fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db, get, set } = makeDb();
    const { fileStorage } = makeFileStorage();
    set.mockRejectedValue(new Error('firestore down'));
    get.mockResolvedValue({ exists: true, data: () => ({ ...storedProfile, role: 'teacher' }) });
    const handler = createDeleteAvatarHandler(db, fileStorage);
    const res = makeRes();

    await handler({} as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    consoleError.mockRestore();
  });
});

describe('createAvatarUploadErrorHandler', () => {
  it('maps multer file-size failures to the avatar JSON error contract', () => {
    const res = makeRes();
    const next = jest.fn();
    const err = { code: 'LIMIT_FILE_SIZE' };
    const req = {} as any;

    createAvatarUploadErrorHandler()(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'file too large', explanation: 'La foto supera el tamaño máximo permitido (2 MB).' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('passes non-multer errors through to the next middleware', () => {
    const res = makeRes();
    const next = jest.fn();
    const err = new Error('unexpected');
    const req = {} as any;
    res.status.mockClear();
    res.json.mockClear();

    createAvatarUploadErrorHandler()(err, req, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('avatar upload hardening', () => {
  it('caps multipart uploads at one file and ten fields', () => {
    expect(AVATAR_UPLOAD_LIMITS).toEqual({ fileSize: MAX_AVATAR_FILE_SIZE_BYTES, files: 1, fields: 10 });
  });

  it('maps the other multer limit failures to a JSON 400', () => {
    const res = makeRes();
    const next = jest.fn();

    createAvatarUploadErrorHandler()({ code: 'LIMIT_FIELD_COUNT' } as any, {} as any, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error.message).toBe('invalid upload');
    expect(next).not.toHaveBeenCalled();
  });
});
