import {
  createGetResourcesHandler,
  createUploadResourceHandler,
  createDownloadResourceHandler,
  createPreviewResourceHandler,
  createDeleteResourceHandler,
  createResourceUploadErrorHandler,
  ResourcesDatabase,
} from '../resources';
import { FileStorage } from '../fileStorage';
import { DocumentConverter } from '../documentConverter';

const makeRes = () => {
  const res: any = { locals: { firebaseUser: { uid: 'uid-1', email: 'ana@example.com' } } };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.type = jest.fn(() => res);
  res.attachment = jest.fn(() => res);
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
  return {
    db,
    collection,
    userDoc,
    userGet,
    resourcesCollection,
    resourceDoc,
    docGet,
    set,
    del,
    orderBy,
    limit,
    resourcesGet,
  };
};

const teacherProfile = { displayName: 'Ana García', email: 'ana@example.com', role: 'teacher' };
const studentProfile = { displayName: 'Beto Díaz', email: 'beto@example.com', role: 'student' };

const serverTimestamp = jest.fn(() => 'server-timestamp');

// Fake FileStorage test double — no Appwrite import anywhere in this test file.
const makeFileStorage = () => {
  const upload = jest.fn(() => Promise.resolve({ fileId: 'file-1', url: '' }));
  const download = jest.fn(() => Promise.resolve(Buffer.from('YmFzZTY0...', 'utf8')));
  const del = jest.fn(() => Promise.resolve());
  const fileStorage = ({ upload, download, delete: del } as unknown) as FileStorage;
  return { fileStorage, upload, download, del };
};

// Fake DocumentConverter test double — no libreoffice-convert import anywhere in this test file.
const makeDocumentConverter = () => {
  const convertToPdf = jest.fn(() => Promise.resolve(Buffer.from('pdf-bytes')));
  const documentConverter = ({ convertToPdf } as unknown) as DocumentConverter;
  return { documentConverter, convertToPdf };
};

const makeUploadedFile = (
  overrides: Partial<{ originalname: string; mimetype: string; size: number; buffer: Buffer }> = {}
) => ({
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

  it('uploads the file to storage and saves the Firestore doc with the returned fileId, returning 201', async () => {
    const { db, userGet, resourceDoc, docGet, set } = makeDb();
    const { fileStorage, upload } = makeFileStorage();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createUploadResourceHandler(db, serverTimestamp, fileStorage);
    const res = makeRes();
    const req: any = { body: { classId: 'class-1' }, file: makeUploadedFile() };
    docGet.mockResolvedValue({ exists: true, data: () => ({ title: 'Cálculo I', roomName: 'calculo-i' }) });

    await handler(req, res, jest.fn());

    expect(upload).toHaveBeenCalledWith({
      buffer: req.file.buffer,
      contentType: 'application/pdf',
      fileName: 'clase-1.pdf',
    });
    expect(resourceDoc).toHaveBeenCalledWith('class-1');
    expect(set).toHaveBeenCalledWith({
      name: 'clase-1.pdf',
      kind: 'pdf',
      roomLabel: 'Cálculo I',
      classId: 'class-1',
      classTitle: 'Cálculo I',
      roomName: 'calculo-i',
      sizeBytes: 1024,
      contentType: 'application/pdf',
      fileId: 'file-1',
      createdAt: 'server-timestamp',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'auto-id-1', name: 'clase-1.pdf', kind: 'pdf', classId: 'class-1' })
    );
    // fileId is a server-only pointer — never sent back to the client.
    expect(res.json).toHaveBeenCalledWith(expect.not.objectContaining({ fileId: expect.anything() }));
  });

  it('returns 401 when the middleware did not attach a verified user', async () => {
    const { db, set } = makeDb();
    const { fileStorage, upload } = makeFileStorage();
    const handler = createUploadResourceHandler(db, serverTimestamp, fileStorage);
    const res = makeRes();
    res.locals = {};

    await handler({ body: {}, file: makeUploadedFile() } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(upload).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('returns 403 without saving when the caller is a student', async () => {
    const { db, userGet, set } = makeDb();
    const { fileStorage, upload } = makeFileStorage();
    userGet.mockResolvedValue({ exists: true, data: () => studentProfile });
    const handler = createUploadResourceHandler(db, serverTimestamp, fileStorage);
    const res = makeRes();

    await handler({ body: { classId: 'class-1' }, file: makeUploadedFile() } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(upload).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('returns 400 when no file is attached', async () => {
    const { db, userGet, set } = makeDb();
    const { fileStorage, upload } = makeFileStorage();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createUploadResourceHandler(db, serverTimestamp, fileStorage);
    const res = makeRes();

    await handler({ body: { classId: 'class-1' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(upload).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('returns 400 when the file exceeds the max size', async () => {
    const { db, userGet, set } = makeDb();
    const { fileStorage, upload } = makeFileStorage();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createUploadResourceHandler(db, serverTimestamp, fileStorage);
    const res = makeRes();

    await handler(
      { body: { classId: 'class-1' }, file: makeUploadedFile({ size: 26 * 1024 * 1024 }) } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(upload).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('returns 400 for an unsupported mime type', async () => {
    const { db, userGet, set } = makeDb();
    const { fileStorage, upload } = makeFileStorage();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createUploadResourceHandler(db, serverTimestamp, fileStorage);
    const res = makeRes();

    await handler(
      { body: { classId: 'class-1' }, file: makeUploadedFile({ mimetype: 'application/x-msdownload' }) } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(upload).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('returns 400 when classId is missing', async () => {
    const { db, userGet, set } = makeDb();
    const { fileStorage, upload } = makeFileStorage();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createUploadResourceHandler(db, serverTimestamp, fileStorage);
    const res = makeRes();

    await handler({ body: {}, file: makeUploadedFile() } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(upload).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('returns 503 when the Firestore save fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db, userGet, docGet, set } = makeDb();
    const { fileStorage, del: storageDelete } = makeFileStorage();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    set.mockRejectedValue(new Error('firestore down'));
    const handler = createUploadResourceHandler(db, serverTimestamp, fileStorage);
    const res = makeRes();

    docGet.mockResolvedValue({ exists: true, data: () => ({ title: 'Cálculo I', roomName: 'calculo-i' }) });
    await handler({ body: { classId: 'class-1' }, file: makeUploadedFile() } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    expect(storageDelete).toHaveBeenCalledWith('file-1');
    consoleError.mockRestore();
  });

  it('returns 503 when the storage upload fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db, userGet, docGet, set } = makeDb();
    const { fileStorage, upload } = makeFileStorage();
    upload.mockRejectedValue(new Error('appwrite down'));
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const handler = createUploadResourceHandler(db, serverTimestamp, fileStorage);
    const res = makeRes();

    docGet.mockResolvedValue({ exists: true, data: () => ({ title: 'Cálculo I', roomName: 'calculo-i' }) });
    await handler({ body: { classId: 'class-1' }, file: makeUploadedFile() } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    expect(set).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe('createDownloadResourceHandler', () => {
  afterEach(jest.clearAllMocks);

  it('downloads the Appwrite file when a legacy content field is also present', async () => {
    const { db, userGet, docGet } = makeDb();
    const { fileStorage, download } = makeFileStorage();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({
      exists: true,
      data: () => ({
        fileId: 'file-1',
        content: Buffer.from('legacy bytes').toString('base64'),
        contentType: 'text/html',
        name: 'clase.pdf',
      }),
    });
    const handler = createDownloadResourceHandler(db, fileStorage);
    const res = makeRes();

    await handler({ params: { id: 'res-1' } } as any, res, jest.fn());

    expect(download).toHaveBeenCalledWith('file-1');
    expect(res.type).toHaveBeenCalledWith('application/octet-stream');
    expect(res.attachment).toHaveBeenCalledWith('clase.pdf');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(Buffer.from('YmFzZTY0...', 'utf8'));
    expect(res.json).not.toHaveBeenCalled();
  });

  it('falls back to bounded legacy base64 content when the document has no Appwrite fileId', async () => {
    const { db, userGet, docGet } = makeDb();
    const { fileStorage, download } = makeFileStorage();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({
      exists: true,
      data: () => ({ content: Buffer.from('legacy bytes').toString('base64'), contentType: 'application/pdf', name: 'guia.pdf' }),
    });
    const handler = createDownloadResourceHandler(db, fileStorage);
    const res = makeRes();

    await handler({ params: { id: 'legacy-res-1' } } as any, res, jest.fn());

    expect(download).not.toHaveBeenCalled();
    expect(res.type).toHaveBeenCalledWith('application/pdf');
    expect(res.attachment).toHaveBeenCalledWith('guia.pdf');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(Buffer.from('legacy bytes'));
  });

  it('returns 404 when the resource does not exist', async () => {
    const { db, userGet, docGet } = makeDb();
    const { fileStorage, download } = makeFileStorage();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({ exists: false, data: () => undefined });
    const handler = createDownloadResourceHandler(db, fileStorage);
    const res = makeRes();

    await handler({ params: { id: 'missing' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(download).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ content: expect.anything() }));
  });

  it('returns 403 without reading when the caller is a student', async () => {
    const { db, userGet, docGet } = makeDb();
    const { fileStorage } = makeFileStorage();
    userGet.mockResolvedValue({ exists: true, data: () => studentProfile });
    const handler = createDownloadResourceHandler(db, fileStorage);
    const res = makeRes();

    await handler({ params: { id: 'res-1' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(docGet).not.toHaveBeenCalled();
  });

  it('returns 503 when the storage download fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db, userGet, docGet } = makeDb();
    const { fileStorage, download } = makeFileStorage();
    download.mockRejectedValue(new Error('appwrite down'));
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({
      exists: true,
      data: () => ({ fileId: 'file-1', contentType: 'application/pdf', name: 'clase.pdf' }),
    });
    const handler = createDownloadResourceHandler(db, fileStorage);
    const res = makeRes();

    await handler({ params: { id: 'res-1' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    consoleError.mockRestore();
  });
});

describe('createPreviewResourceHandler', () => {
  afterEach(jest.clearAllMocks);

  it('converts a presentation to PDF, caches the result, and returns the PDF bytes', async () => {
    const { db, userGet, docGet, set } = makeDb();
    const { fileStorage, download, upload } = makeFileStorage();
    const { documentConverter, convertToPdf } = makeDocumentConverter();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({
      exists: true,
      data: () => ({ fileId: 'file-1', kind: 'presentation', name: 'derivadas.pptx' }),
    });
    const handler = createPreviewResourceHandler(db, fileStorage, documentConverter);
    const res = makeRes();

    await handler({ params: { id: 'res-1' } } as any, res, jest.fn());
    await Promise.resolve();
    await Promise.resolve();

    expect(download).toHaveBeenCalledWith('file-1');
    expect(convertToPdf).toHaveBeenCalledWith(Buffer.from('YmFzZTY0...', 'utf8'), 'derivadas.pptx');
    expect(res.type).toHaveBeenCalledWith('application/pdf');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(Buffer.from('pdf-bytes'));
    expect(upload).toHaveBeenCalledWith({
      buffer: Buffer.from('pdf-bytes'),
      contentType: 'application/pdf',
      fileName: 'derivadas.pptx.pdf',
    });
    expect(set).toHaveBeenCalledWith({ previewFileId: 'file-1' }, { merge: true });
  });

  it('serves the cached preview without reconverting when previewFileId is already set', async () => {
    const { db, userGet, docGet } = makeDb();
    const { fileStorage, download } = makeFileStorage();
    download.mockResolvedValue(Buffer.from('cached-pdf'));
    const { documentConverter, convertToPdf } = makeDocumentConverter();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({
      exists: true,
      data: () => ({ fileId: 'file-1', previewFileId: 'preview-1', kind: 'word', name: 'guia.docx' }),
    });
    const handler = createPreviewResourceHandler(db, fileStorage, documentConverter);
    const res = makeRes();

    await handler({ params: { id: 'res-1' } } as any, res, jest.fn());

    expect(download).toHaveBeenCalledWith('preview-1');
    expect(convertToPdf).not.toHaveBeenCalled();
    expect(res.type).toHaveBeenCalledWith('application/pdf');
    expect(res.send).toHaveBeenCalledWith(Buffer.from('cached-pdf'));
  });

  it('returns 400 for a kind with no preview support (e.g. zip)', async () => {
    const { db, userGet, docGet } = makeDb();
    const { fileStorage, download } = makeFileStorage();
    const { documentConverter, convertToPdf } = makeDocumentConverter();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({ exists: true, data: () => ({ fileId: 'file-1', kind: 'zip', name: 'materiales.zip' }) });
    const handler = createPreviewResourceHandler(db, fileStorage, documentConverter);
    const res = makeRes();

    await handler({ params: { id: 'res-1' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(download).not.toHaveBeenCalled();
    expect(convertToPdf).not.toHaveBeenCalled();
  });

  it('returns 404 when the resource does not exist', async () => {
    const { db, userGet, docGet } = makeDb();
    const { fileStorage } = makeFileStorage();
    const { documentConverter } = makeDocumentConverter();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({ exists: false, data: () => undefined });
    const handler = createPreviewResourceHandler(db, fileStorage, documentConverter);
    const res = makeRes();

    await handler({ params: { id: 'missing' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 403 without reading when the caller is a student', async () => {
    const { db, userGet, docGet } = makeDb();
    const { fileStorage } = makeFileStorage();
    const { documentConverter } = makeDocumentConverter();
    userGet.mockResolvedValue({ exists: true, data: () => studentProfile });
    const handler = createPreviewResourceHandler(db, fileStorage, documentConverter);
    const res = makeRes();

    await handler({ params: { id: 'res-1' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(docGet).not.toHaveBeenCalled();
  });

  it('returns 503 when the conversion fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db, userGet, docGet } = makeDb();
    const { fileStorage } = makeFileStorage();
    const { documentConverter, convertToPdf } = makeDocumentConverter();
    convertToPdf.mockRejectedValue(new Error('soffice crashed'));
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({ exists: true, data: () => ({ fileId: 'file-1', kind: 'word', name: 'guia.docx' }) });
    const handler = createPreviewResourceHandler(db, fileStorage, documentConverter);
    const res = makeRes();

    await handler({ params: { id: 'res-1' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    consoleError.mockRestore();
  });
});

describe('createDeleteResourceHandler', () => {
  afterEach(jest.clearAllMocks);

  it('also best-effort deletes the cached preview PDF when the doc has one', async () => {
    const { db, userGet, docGet } = makeDb();
    const { fileStorage, del: storageDelete } = makeFileStorage();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({ exists: true, data: () => ({ fileId: 'file-1', previewFileId: 'preview-1' }) });
    const handler = createDeleteResourceHandler(db, fileStorage);
    const res = makeRes();

    await handler({ params: { id: 'res-1' } } as any, res, jest.fn());
    await Promise.resolve();

    expect(storageDelete).toHaveBeenCalledWith('file-1');
    expect(storageDelete).toHaveBeenCalledWith('preview-1');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('deletes the Firestore doc and best-effort deletes the stored file, returning 200', async () => {
    const { db, userGet, docGet, del } = makeDb();
    const { fileStorage, del: storageDelete } = makeFileStorage();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({ exists: true, data: () => ({ fileId: 'file-1' }) });
    const handler = createDeleteResourceHandler(db, fileStorage);
    const res = makeRes();

    await handler({ params: { id: 'res-1' } } as any, res, jest.fn());
    await Promise.resolve();

    expect(del).toHaveBeenCalled();
    expect(storageDelete).toHaveBeenCalledWith('file-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ deleted: true });
  });

  it('logs a storage cleanup failure without changing the successful Firestore response', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db, userGet, docGet } = makeDb();
    const { fileStorage, del: storageDelete } = makeFileStorage();
    storageDelete.mockRejectedValue(new Error('appwrite down'));
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({ exists: true, data: () => ({ fileId: 'file-1' }) });
    const res = makeRes();

    await createDeleteResourceHandler(db, fileStorage)({ params: { id: 'res-1' } } as any, res, jest.fn());
    await Promise.resolve();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('resource_delete_storage_failed'));
    consoleError.mockRestore();
  });

  it('skips the storage delete when the doc has no fileId (legacy data)', async () => {
    const { db, userGet, docGet, del } = makeDb();
    const { fileStorage, del: storageDelete } = makeFileStorage();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({ exists: true, data: () => ({}) });
    const handler = createDeleteResourceHandler(db, fileStorage);
    const res = makeRes();

    await handler({ params: { id: 'res-1' } } as any, res, jest.fn());

    expect(del).toHaveBeenCalled();
    expect(storageDelete).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 404 when the resource does not exist', async () => {
    const { db, userGet, docGet, del } = makeDb();
    const { fileStorage } = makeFileStorage();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    docGet.mockResolvedValue({ exists: false, data: () => undefined });
    const handler = createDeleteResourceHandler(db, fileStorage);
    const res = makeRes();

    await handler({ params: { id: 'missing' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(del).not.toHaveBeenCalled();
  });

  it('returns 403 without reading when the caller is a student', async () => {
    const { db, userGet, docGet } = makeDb();
    const { fileStorage } = makeFileStorage();
    userGet.mockResolvedValue({ exists: true, data: () => studentProfile });
    const handler = createDeleteResourceHandler(db, fileStorage);
    const res = makeRes();

    await handler({ params: { id: 'res-1' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(docGet).not.toHaveBeenCalled();
  });
});

describe('createResourceUploadErrorHandler', () => {
  it('maps multer file-size failures to the resource JSON error contract', () => {
    const res = makeRes();
    const next = jest.fn();

    createResourceUploadErrorHandler()({ code: 'LIMIT_FILE_SIZE' } as any, {} as any, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'file too large', explanation: 'El archivo supera el tamaño máximo permitido (25 MB).' },
    });
    expect(next).not.toHaveBeenCalled();
  });
});
