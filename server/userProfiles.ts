import { ErrorRequestHandler, RequestHandler } from 'express';
import { logOperationalFailure } from './operationalEvents';
import { FileStorage } from './fileStorage';
import { deleteQuietly, withUploadCompensation } from './fileStorageGuards';
import {
  createFileSizeLimitErrorHandler,
  getVerifiedUser,
  ParseResult,
  parseFail,
  parseOk,
  sendBadRequest,
  sendError,
  sendParseError,
} from './http';

/*
 * Firestore-backed user profiles: users/{uid} = { displayName, email, role, createdAt }.
 *
 * Client registration can create either a teacher or a student profile — the
 * client sends the chosen role and the server trusts it at account-creation time
 * only. After that, role is write-once: this endpoint never modifies an existing
 * profile document, and every other handler (PATCH, avatar upload/delete) re-reads
 * the role from Firestore rather than trusting anything the browser sends.
 *
 * Both endpoints assume firebaseAuthMiddleware already ran and attached the
 * decoded token to res.locals.firebaseUser.
 */

export type UserRole = 'teacher' | 'student';

const STUDENT_ROLE: UserRole = 'student';
const TEACHER_ROLE: UserRole = 'teacher';

export interface UserProfile {
  displayName: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  // True once the user has explicitly removed their photo (see createDeleteAvatarHandler).
  // Distinct from simply having no avatarUrl: it tells the client to stop falling back to
  // the auth provider's photo (e.g. Google) too. Cleared back to false on the next upload.
  avatarRemoved?: boolean;
}

// Minimal structural slice of the Firestore API used below — keeps this unit
// decoupled from firebase-admin and trivially mockable in tests (same pattern as
// RoomCompletingClient in completeRoom.ts). The real admin Firestore instance
// satisfies it structurally.
export interface ProfileDocumentSnapshot {
  exists: boolean;
  data(): { [key: string]: any } | undefined;
}

export interface ProfileDocumentReference {
  get(): Promise<ProfileDocumentSnapshot>;
  set(data: { [key: string]: any }, options?: { merge: boolean }): Promise<unknown>;
}

export interface ProfileDatabase {
  collection(name: string): { doc(id: string): ProfileDocumentReference };
}

const MAX_DISPLAY_NAME_LENGTH = 100;

// Temporary read-only bridge for pre-Appwrite profile documents. The former
// PATCH validation capped this field at 96 kB; keep that bound so it can be
// removed safely after legacy avatars have been migrated or expired.
const MAX_LEGACY_AVATAR_DATA_URL_LENGTH = 96000;
const LEGACY_AVATAR_DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

function legacyAvatarUrl(data: { [key: string]: any }): string | undefined {
  const avatarDataUrl = data.avatarDataUrl;
  return typeof avatarDataUrl === 'string' &&
    avatarDataUrl.length <= MAX_LEGACY_AVATAR_DATA_URL_LENGTH &&
    LEGACY_AVATAR_DATA_URL.test(avatarDataUrl)
    ? avatarDataUrl
    : undefined;
}

function toProfileResponse(data: { [key: string]: any }): UserProfile {
  return {
    displayName: data.displayName,
    email: data.email,
    role: data.role,
    // Prefer Appwrite for every new profile; only expose the validated legacy
    // data URL when the document has no Appwrite URL yet.
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : legacyAvatarUrl(data),
    avatarRemoved: data.avatarRemoved === true,
  };
}

// Enforced again here even though multer is configured with the same limit in
// index.ts — this module must not trust its wiring (same convention as
// resources.ts's MAX_FILE_SIZE_BYTES). Client already resizes/compresses avatars to
// ~256px JPEG/WebP before upload, so 2 MB is comfortable headroom.
export const MAX_AVATAR_FILE_SIZE_BYTES = 2 * 1024 * 1024;
// multer limits for POST /profile/avatar (any profile may upload — no role gate).
export const AVATAR_UPLOAD_LIMITS = { fileSize: MAX_AVATAR_FILE_SIZE_BYTES, files: 1, fields: 10 };
const ALLOWED_AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/webp']);

function isProfileOwnerRole(data: { [key: string]: any } | undefined): boolean {
  return data?.role === 'teacher' || data?.role === 'student';
}

// multer's req.file shape — declared locally to avoid an @types/multer dependency on
// this leaf module's public surface. Duplicated from resources.ts's UploadedFile on
// purpose — each server unit stays independently deployable and testable.
export interface UploadedAvatarFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export function createGetProfileHandler(db: ProfileDatabase): RequestHandler {
  return async (_req, res) => {
    const firebaseUser = getVerifiedUser(res);

    // Defensive: the auth middleware always attaches the verified user; without it
    // there is no uid to resolve a profile for.
    if (!firebaseUser) {
      res.status(401).send();
      return;
    }

    try {
      const snapshot = await db
        .collection('users')
        .doc(firebaseUser.uid)
        .get();

      if (!snapshot.exists) {
        sendError(res, 404, 'profile not found', 'Todavía no existe un perfil para esta cuenta.');
        return;
      }

      res.status(200).json(toProfileResponse(snapshot.data() || {}));
    } catch (err) {
      logOperationalFailure({ event: 'profile_read_failed', operation: 'profile_read', uid: firebaseUser.uid, error: err });
      sendError(res, 503, 'profile lookup failed', 'No pudimos consultar tu perfil. Intenta de nuevo en unos segundos.');
    }
  };
}

export interface NewProfileInput {
  displayName: string;
  role: UserRole;
}

/** Validates the POST /profile body. Pure: no `res`, no I/O. */
export function parsePostProfileBody(rawBody: unknown): ParseResult<NewProfileInput> {
  const body = (rawBody ?? {}) as { [key: string]: any };
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const requestedRole = body.role;

  if (requestedRole !== STUDENT_ROLE && requestedRole !== TEACHER_ROLE) {
    return parseFail('invalid role', 'El rol debe ser profesor o estudiante.');
  }
  if (!displayName) return parseFail('invalid displayName', 'El nombre no puede estar vacío.');

  return parseOk({ displayName, role: requestedRole });
}

export function createPostProfileHandler(db: ProfileDatabase, serverTimestamp: () => unknown): RequestHandler {
  return async (req, res) => {
    const firebaseUser = getVerifiedUser(res);

    if (!firebaseUser) {
      res.status(401).send();
      return;
    }

    const parsed = parsePostProfileBody(req.body);
    if (!parsed.ok) {
      sendParseError(res, parsed);
      return;
    }
    const { displayName, role: requestedRole } = parsed.value;

    try {
      const docRef = db.collection('users').doc(firebaseUser.uid);
      const snapshot = await docRef.get();

      // Existing profiles are never modified through this public endpoint.
      if (snapshot.exists) {
        res.status(200).json(toProfileResponse(snapshot.data() || {}));
        return;
      }

      // Email always comes from the verified token, never from the request body.
      const email = firebaseUser.email || '';
      await docRef.set({
        displayName,
        email,
        role: requestedRole,
        createdAt: serverTimestamp(),
      });

      res.status(201).json({ displayName, email, role: requestedRole });
    } catch (err) {
      logOperationalFailure({ event: 'profile_save_failed', operation: 'profile_create', uid: firebaseUser.uid, error: err });
      sendError(res, 503, 'profile save failed', 'No pudimos guardar tu perfil. Intenta de nuevo en unos segundos.');
    }
  };
}

const PATCHABLE_PROFILE_FIELDS = ['displayName', 'syncEmail', 'restorePhoto'];

/**
 * Validates the PATCH /profile body and builds the Firestore update. Pure. The email is
 * never read from the body: `syncEmail` copies the one from the freshly verified token.
 */
export function parsePatchProfileBody(
  rawBody: unknown,
  verifiedEmail: string | undefined
): ParseResult<{ [key: string]: any }> {
  const body = (rawBody ?? {}) as { [key: string]: any };
  const fields = Object.keys(body);
  if (!fields.length || fields.some(field => PATCHABLE_PROFILE_FIELDS.indexOf(field) === -1)) {
    return parseFail('invalid profile fields', 'Los datos del perfil no son válidos.');
  }

  const update: { [key: string]: any } = {};
  if ('displayName' in body) {
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    if (!displayName || displayName.length > MAX_DISPLAY_NAME_LENGTH) {
      return parseFail('invalid displayName', 'El nombre debe tener entre 1 y 100 caracteres.');
    }
    update.displayName = displayName;
  }
  if ('syncEmail' in body && body.syncEmail !== true) {
    return parseFail('invalid email sync', 'No pudimos sincronizar el correo.');
  }
  if (body.syncEmail === true) update.email = verifiedEmail || '';
  // Clears the "I don't want a photo" flag set by DELETE /profile/avatar, so the
  // client falls back to the auth provider's photo (e.g. Google) again.
  if ('restorePhoto' in body && body.restorePhoto !== true) {
    return parseFail('invalid restorePhoto', 'No pudimos restaurar la foto.');
  }
  if (body.restorePhoto === true) update.avatarRemoved = false;

  return parseOk(update);
}

// Updates only a verified user's own presentation fields. Email is never accepted
// from the request: syncEmail copies it from a freshly verified Firebase ID token.
export function createPatchProfileHandler(db: ProfileDatabase): RequestHandler {
  return async (req, res) => {
    const firebaseUser = getVerifiedUser(res);
    if (!firebaseUser) {
      res.status(401).send();
      return;
    }

    const parsed = parsePatchProfileBody(req.body, firebaseUser.email);
    if (!parsed.ok) {
      sendParseError(res, parsed);
      return;
    }
    const update = parsed.value;

    try {
      const docRef = db.collection('users').doc(firebaseUser.uid);
      const snapshot = await docRef.get();
      const profile = snapshot.data();
      if (!snapshot.exists || !isProfileOwnerRole(profile)) {
        sendError(res, 403, 'profile role required', 'No tienes permiso para modificar este perfil.');
        return;
      }

      await docRef.set(update, { merge: true });
      res.status(200).json(toProfileResponse({ ...profile, ...update }));
    } catch (err) {
      logOperationalFailure({ event: 'profile_update_failed', operation: 'profile_update', uid: firebaseUser.uid, error: err });
      sendError(res, 503, 'profile update failed', 'No pudimos actualizar tu perfil. Intenta de nuevo.');
    }
  };
}

// POST /profile/avatar (multipart). Uploads the file to Appwrite Storage (public-read
// bucket) and stores the resulting view URL + fileId on the profile doc. Same role guard
// as the PATCH handler.
export function createUploadAvatarHandler(db: ProfileDatabase, fileStorage: FileStorage): RequestHandler {
  return async (req, res) => {
    const firebaseUser = getVerifiedUser(res);
    if (!firebaseUser) {
      res.status(401).send();
      return;
    }

    try {
      await withUploadCompensation(
        fileStorage,
        { event: 'avatar_upload_cleanup_failed', operation: 'avatar_upload', uid: firebaseUser.uid },
        async upload => {
          const docRef = db.collection('users').doc(firebaseUser.uid);
          const snapshot = await docRef.get();
          const profile = snapshot.data();
          if (!snapshot.exists || !isProfileOwnerRole(profile)) {
            sendError(res, 403, 'profile role required', 'No tienes permiso para modificar este perfil.');
            return;
          }

          const file = (req as any).file as UploadedAvatarFile | undefined;
          if (!file) {
            sendBadRequest(res, 'missing file', 'Debes seleccionar una imagen para subir.');
            return;
          }
          if (!ALLOWED_AVATAR_MIME_TYPES.has(file.mimetype)) {
            sendBadRequest(res, 'unsupported file type', 'La foto debe ser una imagen JPEG o WebP.');
            return;
          }
          if (file.size > MAX_AVATAR_FILE_SIZE_BYTES) {
            sendBadRequest(res, 'file too large', 'La foto supera el tamaño máximo permitido (2 MB).');
            return;
          }

          const previousFileId = typeof profile?.avatarFileId === 'string' ? profile.avatarFileId : undefined;

          const stored = await fileStorage.upload({
            buffer: file.buffer,
            contentType: file.mimetype,
            fileName: `${firebaseUser.uid}-avatar-${Date.now()}`,
          });
          upload.track(stored.fileId);

          await docRef.set({ avatarUrl: stored.url, avatarFileId: stored.fileId, avatarRemoved: false }, { merge: true });
          upload.commit();

          if (previousFileId && previousFileId !== stored.fileId) {
            deleteQuietly(fileStorage, previousFileId, {
              event: 'avatar_replace_cleanup_failed',
              operation: 'avatar_upload',
              uid: firebaseUser.uid,
            });
          }

          res.status(200).json(toProfileResponse({ ...profile, avatarUrl: stored.url, avatarRemoved: false }));
        }
      );
    } catch (err) {
      logOperationalFailure({ event: 'avatar_upload_failed', operation: 'avatar_upload', uid: firebaseUser.uid, error: err });
      sendError(res, 503, 'avatar upload failed', 'No pudimos subir la foto. Intenta de nuevo en unos segundos.');
    }
  };
}

export const createAvatarUploadErrorHandler = (): ErrorRequestHandler => {
  const fileSizeHandler = createFileSizeLimitErrorHandler({
    message: 'file too large',
    explanation: 'La foto supera el tamaño máximo permitido (2 MB).',
  });
  // Any other multer limit (file/field count, unexpected field) is also the client's fault.
  return (err, req, res, next) =>
    fileSizeHandler(err, req, res, (rest?: any) => {
      if (rest && typeof rest.code === 'string' && rest.code.startsWith('LIMIT_')) {
        sendBadRequest(res, 'invalid upload', 'Sube una sola foto por vez.');
        return;
      }
      next(rest);
    });
};

// DELETE /profile/avatar. Deletes the stored file before clearing its profile fields, and
// marks avatarRemoved so the client stops falling back to the auth provider's photo too
// (an explicit "I don't want a photo" state, not just "no custom avatar uploaded").
// Same role guard as the PATCH handler.
export function createDeleteAvatarHandler(db: ProfileDatabase, fileStorage: FileStorage): RequestHandler {
  return async (_req, res) => {
    const firebaseUser = getVerifiedUser(res);
    if (!firebaseUser) {
      res.status(401).send();
      return;
    }

    try {
      const docRef = db.collection('users').doc(firebaseUser.uid);
      const snapshot = await docRef.get();
      const profile = snapshot.data();
      if (!snapshot.exists || !isProfileOwnerRole(profile)) {
        sendError(res, 403, 'profile role required', 'No tienes permiso para modificar este perfil.');
        return;
      }

      const fileId = typeof profile?.avatarFileId === 'string' ? profile.avatarFileId : undefined;

      if (fileId) {
        await fileStorage.delete(fileId);
      }

      await docRef.set({ avatarUrl: null, avatarFileId: null, avatarDataUrl: null, avatarRemoved: true }, { merge: true });
      res
        .status(200)
        .json(toProfileResponse({ ...profile, avatarUrl: undefined, avatarDataUrl: undefined, avatarRemoved: true }));
    } catch (err) {
      logOperationalFailure({ event: 'avatar_delete_failed', operation: 'avatar_delete', uid: firebaseUser.uid, error: err });
      sendError(res, 503, 'avatar delete failed', 'No pudimos eliminar la foto. Intenta de nuevo en unos segundos.');
    }
  };
}
