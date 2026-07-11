import { RequestHandler } from 'express';
import { logOperationalFailure } from './operationalEvents';

/*
 * Firestore-only teacher "Recursos" (class materials):
 * users/{uid}/resources/{fileId} = { name, kind, roomLabel, sizeBytes, contentType,
 * content, createdAt }, with the actual file bytes stored base64-encoded directly in
 * the `content` field of the Firestore document.
 *
 * Why not Cloud Storage: Firebase Storage requires the project to be on the paid
 * Blaze billing plan, which this project deliberately avoids. Firestore is on the
 * free Spark plan, so the bytes are embedded in the document instead.
 *
 * This is why MAX_FILE_SIZE_BYTES is small: Firestore caps a document at 1 MiB, and
 * base64 inflates raw bytes by ~4/3. 700 KB of raw bytes becomes ~933 KB of base64,
 * leaving headroom in the 1 MiB budget for the document's other fields (name, kind,
 * roomLabel, contentType, sizeBytes, createdAt).
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

export type ResourceKind = 'pdf' | 'presentation' | 'video';

// Enforced again here even though multer is configured with the same limit in
// index.ts — this module must not trust its wiring. Kept small: see the file header
// comment for why (Firestore's 1 MiB document limit plus base64 inflation).
export const MAX_FILE_SIZE_BYTES = 700 * 1024;

const MAX_NAME_LENGTH = 200;
const MAX_ROOM_LABEL_LENGTH = 120;

// Max resources returned by GET /resources (newest first).
const MAX_RESOURCES_RETURNED = 200;

const PRESENTATION_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.oasis.opendocument.presentation',
]);

function resolveKind(mimetype: string): ResourceKind | null {
  if (mimetype === 'application/pdf') return 'pdf';
  if (PRESENTATION_MIME_TYPES.has(mimetype)) return 'presentation';
  if (mimetype.startsWith('video/')) return 'video';
  return null;
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

export function createUploadResourceHandler(db: ResourcesDatabase, serverTimestamp: () => unknown): RequestHandler {
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

      const file = (req as any).file as UploadedFile | undefined;
      if (!file) {
        sendBadRequest(res, 'missing file', 'Debes seleccionar un archivo para subir.');
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        sendBadRequest(res, 'file too large', 'El archivo supera el tamaño máximo permitido (700 KB).');
        return;
      }

      const kind = resolveKind(file.mimetype);
      if (!kind) {
        sendBadRequest(res, 'unsupported file type', 'Solo se admiten PDFs, presentaciones (PPTX/ODP) y videos.');
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

      const name = (file.originalname || 'archivo').trim().slice(0, MAX_NAME_LENGTH) || 'archivo';

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
        content: file.buffer.toString('base64'),
        createdAt: serverTimestamp(),
      });

      res.status(201).json(
        toResourceResponse(docRef.id, {
          name,
          kind,
          roomLabel,
          classId,
          classTitle: roomLabel,
          roomName: classData.roomName,
          sizeBytes: file.size,
          contentType: file.mimetype,
        })
      );
    } catch (err) {
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

export function createDownloadResourceHandler(db: ResourcesDatabase): RequestHandler {
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

      res.status(200).json({ content: data.content, contentType: data.contentType, name: data.name });
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

export function createDeleteResourceHandler(db: ResourcesDatabase): RequestHandler {
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

      await docRef.delete();

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
