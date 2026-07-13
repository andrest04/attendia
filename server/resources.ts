import { ErrorRequestHandler, RequestHandler } from 'express';
import { logOperationalFailure } from './operationalEvents';
import { FileStorage } from './fileStorage';

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

function resolveKind(mimetype: string): ResourceKind | null {
  if (mimetype === 'application/pdf') return 'pdf';
  if (PRESENTATION_MIME_TYPES.has(mimetype)) return 'presentation';
  if (WORD_MIME_TYPES.has(mimetype)) return 'word';
  if (ZIP_MIME_TYPES.has(mimetype)) return 'zip';
  if (mimetype.startsWith('video/')) return 'video';
  return null;
}

function safeContentType(contentType: unknown): string {
  if (
    contentType === 'application/pdf' ||
    PRESENTATION_MIME_TYPES.has(contentType as string) ||
    WORD_MIME_TYPES.has(contentType as string) ||
    ZIP_MIME_TYPES.has(contentType as string)
  ) {
    return contentType as string;
  }
  return typeof contentType === 'string' && /^video\/[a-z0-9!#$&^_.+-]+$/i.test(contentType)
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

// Decoded Firebase identity attached by firebaseAuthMiddleware. Duplicated from
// userProfiles.ts/attentionReports.ts on purpose — each server unit stays
// independently deployable and testable.
export interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
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
  set(data: { [key: string]: any }): Promise<unknown>;
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

function getVerifiedUser(res: Parameters<RequestHandler>[1]): VerifiedFirebaseUser | undefined {
  const firebaseUser = res.locals && res.locals.firebaseUser;
  if (firebaseUser && typeof firebaseUser.uid === 'string' && firebaseUser.uid.length > 0) {
    return firebaseUser as VerifiedFirebaseUser;
  }
  return undefined;
}

function sendTeacherOnly(res: Parameters<RequestHandler>[1]) {
  res.status(403).json({
    error: {
      message: 'teacher role required',
      explanation: 'Los recursos de clase solo están disponibles para profesores.',
    },
  });
}

function sendBadRequest(res: Parameters<RequestHandler>[1], message: string, explanation: string) {
  res.status(400).json({ error: { message, explanation } });
}

/**
 * Resolves whether the verified uid holds role=teacher in Firestore, mirroring
 * attentionReports.ts. Throws on Firestore failure (caller maps it to 503).
 */
async function resolveIsTeacher(db: ResourcesDatabase, uid: string): Promise<boolean> {
  const snapshot = await db
    .collection('users')
    .doc(uid)
    .get();
  if (!snapshot.exists) return false;
  const data = snapshot.data() || {};
  return data.role === 'teacher';
}

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
  return async (_req, res) => {
    const firebaseUser = getVerifiedUser(res);

    if (!firebaseUser) {
      res.status(401).send();
      return;
    }

    try {
      if (!(await resolveIsTeacher(db, firebaseUser.uid))) {
        sendTeacherOnly(res);
        return;
      }

      // Single-field orderBy on a subcollection — no composite index required.
      const snapshot = await db
        .collection('users')
        .doc(firebaseUser.uid)
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
    } catch (err) {
      logOperationalFailure({ event: 'resource_lookup_failed', operation: 'GET /resources', uid: firebaseUser.uid, error: err });
      res.status(503).json({
        error: {
          message: 'resource lookup failed',
          explanation: 'No pudimos consultar los recursos de la clase. Intenta de nuevo en unos segundos.',
        },
      });
    }
  };
}

export function createUploadResourceHandler(
  db: ResourcesDatabase,
  serverTimestamp: () => unknown,
  fileStorage: FileStorage
): RequestHandler {
  return async (req, res) => {
    const firebaseUser = getVerifiedUser(res);

    if (!firebaseUser) {
      res.status(401).send();
      return;
    }

    let uploadedFileId: string | undefined;
    try {
      if (!(await resolveIsTeacher(db, firebaseUser.uid))) {
        sendTeacherOnly(res);
        return;
      }

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
        .doc(firebaseUser.uid)
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
      uploadedFileId = stored.fileId;

      const docRef = db
        .collection('users')
        .doc(firebaseUser.uid)
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
      uploadedFileId = undefined;

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
    } catch (err) {
      if (uploadedFileId) {
        fileStorage.delete(uploadedFileId).catch(cleanupError =>
          logOperationalFailure({
            event: 'resource_upload_cleanup_failed',
            operation: 'POST /resources',
            uid: firebaseUser.uid,
            error: cleanupError,
          })
        );
      }
      logOperationalFailure({ event: 'resource_save_failed', operation: 'POST /resources', uid: firebaseUser.uid, error: err });
      res.status(503).json({
        error: {
          message: 'resource save failed',
          explanation: 'No pudimos subir el archivo. Intenta de nuevo en unos segundos.',
        },
      });
    }
  };
}

export function createDownloadResourceHandler(db: ResourcesDatabase, fileStorage: FileStorage): RequestHandler {
  return async (req, res) => {
    const firebaseUser = getVerifiedUser(res);

    if (!firebaseUser) {
      res.status(401).send();
      return;
    }

    try {
      if (!(await resolveIsTeacher(db, firebaseUser.uid))) {
        sendTeacherOnly(res);
        return;
      }

      const docRef = db
        .collection('users')
        .doc(firebaseUser.uid)
        .collection('resources')
        .doc(req.params.id);
      const snapshot = await docRef.get();

      if (!snapshot.exists) {
        res.status(404).json({
          error: { message: 'resource not found', explanation: 'El recurso solicitado no existe.' },
        });
        return;
      }

      const data = snapshot.data() || {};

      // Read legacy base64 only when this document has no Appwrite pointer. New
      // writes always carry fileId, so this bridge can be removed after migration.
      const fileId = typeof data.fileId === 'string' && data.fileId.trim() ? data.fileId : undefined;
      const buffer = fileId ? await fileStorage.download(fileId) : decodeLegacyContent(data.content);
      const name = typeof data.name === 'string' && data.name ? data.name : 'archivo';

      res.type(safeContentType(data.contentType)).attachment(name).status(200).send(buffer);
    } catch (err) {
      logOperationalFailure({ event: 'resource_download_failed', operation: 'GET /resources/:id/download', uid: firebaseUser.uid, error: err });
      res.status(503).json({
        error: {
          message: 'resource download failed',
          explanation: 'No pudimos preparar la descarga. Intenta de nuevo en unos segundos.',
        },
      });
    }
  };
}

export function createDeleteResourceHandler(db: ResourcesDatabase, fileStorage: FileStorage): RequestHandler {
  return async (req, res) => {
    const firebaseUser = getVerifiedUser(res);

    if (!firebaseUser) {
      res.status(401).send();
      return;
    }

    try {
      if (!(await resolveIsTeacher(db, firebaseUser.uid))) {
        sendTeacherOnly(res);
        return;
      }

      const docRef = db
        .collection('users')
        .doc(firebaseUser.uid)
        .collection('resources')
        .doc(req.params.id);
      const snapshot = await docRef.get();

      if (!snapshot.exists) {
        res.status(404).json({
          error: { message: 'resource not found', explanation: 'El recurso solicitado no existe.' },
        });
        return;
      }

      const data = snapshot.data() || {};
      const fileId = typeof data.fileId === 'string' ? data.fileId : undefined;

      await docRef.delete();

      if (fileId) {
        fileStorage.delete(fileId).catch(error =>
          logOperationalFailure({
            event: 'resource_delete_storage_failed',
            operation: 'DELETE /resources/:id',
            uid: firebaseUser.uid,
            error,
          })
        );
      }

      res.status(200).json({ deleted: true });
    } catch (err) {
      logOperationalFailure({ event: 'resource_delete_failed', operation: 'DELETE /resources/:id', uid: firebaseUser.uid, error: err });
      res.status(503).json({
        error: {
          message: 'resource delete failed',
          explanation: 'No pudimos eliminar el recurso. Intenta de nuevo en unos segundos.',
        },
      });
    }
  };
}

export const createResourceUploadErrorHandler = (): ErrorRequestHandler => (err, _req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    sendBadRequest(res, 'file too large', 'El archivo supera el tamaño máximo permitido (25 MB).');
    return;
  }
  next(err);
};
