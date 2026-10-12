import { ErrorRequestHandler, RequestHandler } from 'express';
import { logOperationalFailure } from './operationalEvents';
import { FileStorage } from './fileStorage';
import { deleteQuietly, withUploadCompensation } from './fileStorageGuards';
import { DocumentConverter } from './documentConverter';
import { createFileSizeLimitErrorHandler, sendBadRequest, sendError } from './http';
import { teacherHandler } from './teacherHandler';

/*
 * Teacher "Recursos" (class materials): the file bytes live in Appwrite Storage (a
 * private, non-public-read bucket); Firestore only keeps metadata plus a `fileId`
 * pointer at users/{uid}/resources/{fileId} = { name, kind, roomLabel, sizeBytes,
 * contentType, fileId, createdAt }.
 *
 * This replaces an earlier approach that stored the file bytes base64-encoded
 * directly in the Firestore document (avoiding Firebase Storage's paid Blaze
 * requirement). That 1 MiB-per-document ceiling no longer applies now that bytes live
 * in Appwrite — see appwriteFileStorage.ts for the storage implementation and
 * fileStorage.ts for the storage-agnostic port these handlers program against.
 *
 * The resources bucket has no public read — content only ever leaves the server as
 * base64 JSON to an authenticated request (createDownloadResourceHandler), exactly
 * like before. Client contract is unchanged: fileId is a server-only pointer and is
 * never exposed to the client.
 *
 * Teacher enforcement happens HERE, server-side, same as attentionReports.ts: every
 * handler re-resolves role from users/{uid} (written by userProfiles.ts) using the
 * uid from the VERIFIED ID token. All four endpoints assume firebaseAuthMiddleware
 * already ran and attached the decoded token to res.locals.firebaseUser.
 *
 * Date/size formatting for display ("2.4 MB", "12 jul") is left to the client — this
 * module only returns raw sizeBytes/createdAtMs, mirroring how attentionReports.ts
 * returns endedAtMs instead of a formatted string.
 */

export type ResourceKind = 'pdf' | 'presentation' | 'word' | 'zip' | 'video';

// Enforced again here even though multer is configured with the same limit in
// index.ts — this module must not trust its wiring. No longer bounded by Firestore's
// 1 MiB document limit (file bytes live in Appwrite now, not in the document) —
// bounded instead by not wanting to buffer huge files in server memory via multer
// before forwarding them to Appwrite. The Appwrite bucket itself allows up to 100MB;
// the server deliberately enforces the tighter 25MB here.
export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const MAX_NAME_LENGTH = 200;
const MAX_ROOM_LABEL_LENGTH = 120;

// Temporary read-only bridge for documents written before Appwrite Storage. The
// old upload limit was 700 KiB, so this prevents an oversized Firestore field
// from being decoded while keeping the fallback straightforward to remove.
const LEGACY_CONTENT_MAX_BYTES = 700 * 1024;
const LEGACY_CONTENT_MAX_BASE64_LENGTH = Math.ceil(LEGACY_CONTENT_MAX_BYTES / 3) * 4;
const LEGACY_BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

// Max resources returned by GET /resources (newest first).
const MAX_RESOURCES_RETURNED = 200;

const PRESENTATION_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.oasis.opendocument.presentation',
]);

const WORD_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.oasis.opendocument.text',
]);

const ZIP_MIME_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
  'multipart/x-zip',
]);

// One rule per resource kind. `accepts` decides which kind an uploaded file is;
// `isSafeContentType` decides whether a stored content type may be echoed back as the
// download Content-Type. The two intentionally differ for video: uploads accept any
// `video/*`, but only a conservative charset is reflected into a response header.
interface KindRule {
  kind: ResourceKind;
  accepts(mimetype: string): boolean;
  isSafeContentType(contentType: string): boolean;
}

const exactMimeRule = (kind: ResourceKind, mimeTypes: Set<string> | string): KindRule => {
  const matches = (mimetype: string) =>
    typeof mimeTypes === 'string' ? mimetype === mimeTypes : mimeTypes.has(mimetype);
  return { kind, accepts: matches, isSafeContentType: matches };
};

const KIND_RULES: KindRule[] = [
  exactMimeRule('pdf', 'application/pdf'),
  exactMimeRule('presentation', PRESENTATION_MIME_TYPES),
  exactMimeRule('word', WORD_MIME_TYPES),
  exactMimeRule('zip', ZIP_MIME_TYPES),
  {
    kind: 'video',
    accepts: mimetype => mimetype.startsWith('video/'),
    isSafeContentType: contentType => /^video\/[a-z0-9!#$&^_.+-]+$/i.test(contentType),
  },
];

function resolveKind(mimetype: string): ResourceKind | null {
  const rule = KIND_RULES.find(candidate => candidate.accepts(mimetype));
  return rule ? rule.kind : null;
}

function safeContentType(contentType: unknown): string {
  return typeof contentType === 'string' && KIND_RULES.some(rule => rule.isSafeContentType(contentType))
    ? contentType
    : 'application/octet-stream';
}

function decodeLegacyContent(content: unknown): Buffer {
  if (
    typeof content !== 'string' ||
    content.length === 0 ||
    content.length > LEGACY_CONTENT_MAX_BASE64_LENGTH ||
    !LEGACY_BASE64_PATTERN.test(content)
  ) {
    throw new Error('invalid legacy resource content');
  }

  const buffer = Buffer.from(content, 'base64');
  if (buffer.length > LEGACY_CONTENT_MAX_BYTES) {
    throw new Error('legacy resource content exceeds size limit');
  }
  return buffer;
}

// ─── Structural Firestore slice ────────────────────────────────────────────────
// Minimal surface used below; the real firebase-admin Firestore satisfies all of
// these structurally (same pattern as ReportsDatabase in attentionReports.ts).

export interface ResourceDocumentSnapshot {
  id: string;
  exists: boolean;
  data(): { [key: string]: any } | undefined;
}

export interface ResourceDocumentReference {
  id: string;
  get(): Promise<ResourceDocumentSnapshot>;
  set(data: { [key: string]: any }, options?: { merge?: boolean }): Promise<unknown>;
  delete(): Promise<unknown>;
}

export interface ResourceQuerySnapshot {
  docs: ResourceDocumentSnapshot[];
}

export interface ResourcesQuery {
  get(): Promise<ResourceQuerySnapshot>;
}

export interface ResourcesCollection {
  doc(id?: string): ResourceDocumentReference;
  orderBy(field: string, direction: 'asc' | 'desc'): { limit(n: number): ResourcesQuery };
}

export interface UserDocumentSnapshot {
  exists: boolean;
  data(): { [key: string]: any } | undefined;
}

export interface UserDocumentReference {
  get(): Promise<UserDocumentSnapshot>;
  collection(name: string): ResourcesCollection;
}

export interface ResourcesDatabase {
  collection(name: string): { doc(id: string): UserDocumentReference };
}

// multer's req.file shape — declared locally to avoid an @types/multer dependency
// on this leaf module's public surface.
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const TEACHER_ONLY_EXPLANATION = 'Los recursos de clase solo están disponibles para profesores.';

function toResourceResponse(id: string, data: { [key: string]: any }) {
  return {
    id,
    name: data.name,
    kind: data.kind,
    roomLabel: data.roomLabel,
    classId: typeof data.classId === 'string' ? data.classId : undefined,
    classTitle: typeof data.classTitle === 'string' ? data.classTitle : undefined,
    roomName: typeof data.roomName === 'string' ? data.roomName : undefined,
    sizeBytes: data.sizeBytes,
    contentType: data.contentType,
  };
}

export function createGetResourcesHandler(db: ResourcesDatabase): RequestHandler {
  return teacherHandler(
    db,
    {
      forbiddenExplanation: TEACHER_ONLY_EXPLANATION,
      failure: {
        event: 'resource_lookup_failed',
        operation: 'GET /resources',
        message: 'resource lookup failed',
        explanation: 'No pudimos consultar los recursos de la clase. Intenta de nuevo en unos segundos.',
      },
    },
    async ({ uid, res }) => {
      // Single-field orderBy on a subcollection — no composite index required.
      const snapshot = await db
        .collection('users')
        .doc(uid)
        .collection('resources')
        .orderBy('createdAt', 'desc')
        .limit(MAX_RESOURCES_RETURNED)
        .get();

      const resources = snapshot.docs.map(doc => {
        const data = doc.data() || {};
        return {
          ...toResourceResponse(doc.id, data),
          createdAtMs:
            data.createdAt && typeof data.createdAt.toMillis === 'function' ? data.createdAt.toMillis() : null,
        };
      });

      res.status(200).json(resources);
    }
  );
}

export function createUploadResourceHandler(
  db: ResourcesDatabase,
  serverTimestamp: () => unknown,
  fileStorage: FileStorage
): RequestHandler {
  return teacherHandler(
    db,
    {
      forbiddenExplanation: TEACHER_ONLY_EXPLANATION,
      failure: {
        event: 'resource_save_failed',
        operation: 'POST /resources',
        message: 'resource save failed',
        explanation: 'No pudimos subir el archivo. Intenta de nuevo en unos segundos.',
      },
    },
    ({ uid, req, res }) =>
      withUploadCompensation(
        fileStorage,
        { event: 'resource_upload_cleanup_failed', operation: 'POST /resources', uid },
        async upload => {
          const file = (req as any).file as UploadedFile | undefined;
          if (!file) {
            sendBadRequest(res, 'missing file', 'Debes seleccionar un archivo para subir.');
            return;
          }

          if (file.size > MAX_FILE_SIZE_BYTES) {
            sendBadRequest(res, 'file too large', 'El archivo supera el tamaño máximo permitido (25 MB).');
            return;
          }

          const kind = resolveKind(file.mimetype);
          if (!kind) {
            sendBadRequest(
              res,
              'unsupported file type',
              'Solo se admiten PDFs, presentaciones (PPTX/ODP), documentos de Word (DOCX/ODT), archivos comprimidos (ZIP) y videos.'
            );
            return;
          }

          const body = req.body ?? {};
          const classId = typeof body.classId === 'string' ? body.classId.trim() : '';
          if (!classId) {
            sendBadRequest(res, 'invalid classId', 'Debes seleccionar una clase programada para el archivo.');
            return;
          }

          const classSnapshot = await db
            .collection('users')
            .doc(uid)
            .collection('classes')
            .doc(classId)
            .get();
          const classData = classSnapshot.data();
          if (
            !classSnapshot.exists ||
            !classData ||
            typeof classData.title !== 'string' ||
            typeof classData.roomName !== 'string'
          ) {
            sendBadRequest(res, 'invalid classId', 'La clase seleccionada no existe o no te pertenece.');
            return;
          }
          const roomLabel = classData.title.trim().slice(0, MAX_ROOM_LABEL_LENGTH);

          // multer/busboy decode multipart headers as latin1 regardless of the actual
          // encoding, so a UTF-8 filename (e.g. "Andrés") arrives mojibake'd. Re-decode
          // to recover the original bytes as UTF-8.
          const decodedOriginalName = Buffer.from(file.originalname || '', 'latin1').toString('utf8');
          const name = (decodedOriginalName || 'archivo').trim().slice(0, MAX_NAME_LENGTH) || 'archivo';

          const stored = await fileStorage.upload({
            buffer: file.buffer,
            contentType: file.mimetype,
            fileName: name,
          });
          upload.track(stored.fileId);

          const docRef = db
            .collection('users')
            .doc(uid)
            .collection('resources')
            .doc();

          await docRef.set({
            name,
            kind,
            roomLabel,
            classId,
            classTitle: roomLabel,
            roomName: classData.roomName,
            sizeBytes: file.size,
            contentType: file.mimetype,
            fileId: stored.fileId,
            createdAt: serverTimestamp(),
          });
          upload.commit();

          res.status(201).json({
            ...toResourceResponse(docRef.id, {
              name,
              kind,
              roomLabel,
              classId,
              classTitle: roomLabel,
              roomName: classData.roomName,
              sizeBytes: file.size,
              contentType: file.mimetype,
            }),
            // serverTimestamp() resolves once Firestore commits it — not known here — so
            // the immediate response approximates it with the current time, same as the
            // real value will be to millisecond precision.
            createdAtMs: Date.now(),
          });
        }
      )
  );
}

const sendResourceNotFound = (res: Parameters<RequestHandler>[1]) =>
  sendError(res, 404, 'resource not found', 'El recurso solicitado no existe.');

export function createDownloadResourceHandler(db: ResourcesDatabase, fileStorage: FileStorage): RequestHandler {
  return teacherHandler(
    db,
    {
      forbiddenExplanation: TEACHER_ONLY_EXPLANATION,
      failure: {
        event: 'resource_download_failed',
        operation: 'GET /resources/:id/download',
        message: 'resource download failed',
        explanation: 'No pudimos preparar la descarga. Intenta de nuevo en unos segundos.',
      },
    },
    async ({ uid, req, res }) => {
      const docRef = db
        .collection('users')
        .doc(uid)
        .collection('resources')
        .doc(req.params.id);
      const snapshot = await docRef.get();

      if (!snapshot.exists) {
        sendResourceNotFound(res);
        return;
      }

      const data = snapshot.data() || {};

      // Read legacy base64 only when this document has no Appwrite pointer. New
      // writes always carry fileId, so this bridge can be removed after migration.
      const fileId = typeof data.fileId === 'string' && data.fileId.trim() ? data.fileId : undefined;
      const buffer = fileId ? await fileStorage.download(fileId) : decodeLegacyContent(data.content);
      const name = typeof data.name === 'string' && data.name ? data.name : 'archivo';

      res.type(safeContentType(data.contentType)).attachment(name).status(200).send(buffer);
    }
  );
}

// GET /resources/:id/preview — presentations and Word docs have no native in-browser
// renderer, so this returns a PDF rendition instead of the original bytes. The
// original itself is never touched: GET /resources/:id/download keeps returning it
// unchanged, same as a virtual classroom that previews a converted PDF but downloads
// the source file. The first request converts via LibreOffice and caches the result
// (previewFileId) on the resource doc so later "Ver" clicks are instant.
export function createPreviewResourceHandler(
  db: ResourcesDatabase,
  fileStorage: FileStorage,
  documentConverter: DocumentConverter
): RequestHandler {
  return teacherHandler(
    db,
    {
      forbiddenExplanation: TEACHER_ONLY_EXPLANATION,
      failure: {
        event: 'resource_preview_failed',
        operation: 'GET /resources/:id/preview',
        message: 'resource preview failed',
        explanation: 'No pudimos preparar la vista previa. Intenta de nuevo en unos segundos.',
      },
    },
    async ({ uid, req, res }) => {
      const docRef = db
        .collection('users')
        .doc(uid)
        .collection('resources')
        .doc(req.params.id);
      const snapshot = await docRef.get();

      if (!snapshot.exists) {
        sendResourceNotFound(res);
        return;
      }

      const data = snapshot.data() || {};

      if (data.kind !== 'presentation' && data.kind !== 'word') {
        sendBadRequest(res, 'not previewable', 'Este tipo de archivo no admite vista previa.');
        return;
      }

      const cachedPreviewFileId =
        typeof data.previewFileId === 'string' && data.previewFileId.trim() ? data.previewFileId : undefined;
      if (cachedPreviewFileId) {
        const cachedPdf = await fileStorage.download(cachedPreviewFileId);
        res.type('application/pdf').status(200).send(cachedPdf);
        return;
      }

      const fileId = typeof data.fileId === 'string' && data.fileId.trim() ? data.fileId : undefined;
      if (!fileId) {
        sendBadRequest(res, 'not previewable', 'Este archivo no admite vista previa.');
        return;
      }

      const original = await fileStorage.download(fileId);
      const originalName = typeof data.name === 'string' && data.name ? data.name : 'documento';
      const pdfBuffer = await documentConverter.convertToPdf(original, originalName);

      // Caching is best-effort: a failed cache write must not fail the preview the
      // teacher is already waiting on — it just means the next "Ver" reconverts.
      fileStorage
        .upload({ buffer: pdfBuffer, contentType: 'application/pdf', fileName: `${data.name || 'documento'}.pdf` })
        .then(stored => docRef.set({ previewFileId: stored.fileId }, { merge: true }))
        .catch(err =>
          logOperationalFailure({
            event: 'resource_preview_cache_failed',
            operation: 'GET /resources/:id/preview',
            uid,
            error: err,
          })
        );

      res.type('application/pdf').status(200).send(pdfBuffer);
    }
  );
}

export function createDeleteResourceHandler(db: ResourcesDatabase, fileStorage: FileStorage): RequestHandler {
  return teacherHandler(
    db,
    {
      forbiddenExplanation: TEACHER_ONLY_EXPLANATION,
      failure: {
        event: 'resource_delete_failed',
        operation: 'DELETE /resources/:id',
        message: 'resource delete failed',
        explanation: 'No pudimos eliminar el recurso. Intenta de nuevo en unos segundos.',
      },
    },
    async ({ uid, req, res }) => {
      const docRef = db
        .collection('users')
        .doc(uid)
        .collection('resources')
        .doc(req.params.id);
      const snapshot = await docRef.get();

      if (!snapshot.exists) {
        sendResourceNotFound(res);
        return;
      }

      const data = snapshot.data() || {};
      const fileId = typeof data.fileId === 'string' ? data.fileId : undefined;
      const previewFileId = typeof data.previewFileId === 'string' ? data.previewFileId : undefined;

      await docRef.delete();

      if (fileId) {
        deleteQuietly(fileStorage, fileId, {
          event: 'resource_delete_storage_failed',
          operation: 'DELETE /resources/:id',
          uid,
        });
      }

      if (previewFileId) {
        deleteQuietly(fileStorage, previewFileId, {
          event: 'resource_delete_preview_storage_failed',
          operation: 'DELETE /resources/:id',
          uid,
        });
      }

      res.status(200).json({ deleted: true });
    }
  );
}

export const createResourceUploadErrorHandler = (): ErrorRequestHandler =>
  createFileSizeLimitErrorHandler({
    message: 'file too large',
    explanation: 'El archivo supera el tamaño máximo permitido (25 MB).',
  });
