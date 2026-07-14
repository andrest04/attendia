import { ErrorRequestHandler, RequestHandler } from 'express';
import { logOperationalFailure } from './operationalEvents';
import { FileStorage } from './fileStorage';

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

// Decoded Firebase identity attached by firebaseAuthMiddleware. Lives here (a leaf
// module with no runtime deps) so the middleware and the handlers share one type
// without import cycles.
export interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
}

export interface UserProfile {
  displayName: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
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

function getVerifiedUser(res: Parameters<RequestHandler>[1]): VerifiedFirebaseUser | undefined {
  const firebaseUser = res.locals && res.locals.firebaseUser;
  if (firebaseUser && typeof firebaseUser.uid === 'string' && firebaseUser.uid.length > 0) {
    return firebaseUser as VerifiedFirebaseUser;
  }
  return undefined;
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
  };
}

// Enforced again here even though multer is configured with the same limit in
// index.ts — this module must not trust its wiring (same convention as
// resources.ts's MAX_FILE_SIZE_BYTES). Client already resizes/compresses avatars to
// ~256px JPEG/WebP before upload, so 2 MB is comfortable headroom.
export const MAX_AVATAR_FILE_SIZE_BYTES = 2 * 1024 * 1024;
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
        res.status(404).json({
          error: {
            message: 'profile not found',
            explanation: 'Todavía no existe un perfil para esta cuenta.',
          },
        });
        return;
      }

      res.status(200).json(toProfileResponse(snapshot.data() || {}));
    } catch (err) {
      logOperationalFailure({ event: 'profile_read_failed', operation: 'profile_read', uid: firebaseUser.uid, error: err });
      res.status(503).json({
        error: {
          message: 'profile lookup failed',
          explanation: 'No pudimos consultar tu perfil. Intenta de nuevo en unos segundos.',
        },
      });
    }
  };
}

export function createPostProfileHandler(db: ProfileDatabase, serverTimestamp: () => unknown): RequestHandler {
  return async (req, res) => {
    const firebaseUser = getVerifiedUser(res);

    if (!firebaseUser) {
      res.status(401).send();
      return;
    }

    const body = req.body ?? {};
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    const requestedRole = body.role;

    if (requestedRole !== STUDENT_ROLE && requestedRole !== TEACHER_ROLE) {
      res.status(400).json({
        error: {
          message: 'invalid role',
          explanation: 'El rol debe ser profesor o estudiante.',
        },
      });
      return;
    }

    if (!displayName) {
      res.status(400).json({
        error: {
          message: 'invalid displayName',
          explanation: 'El nombre no puede estar vacío.',
        },
      });
      return;
    }

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
      res.status(503).json({
        error: {
          message: 'profile save failed',
          explanation: 'No pudimos guardar tu perfil. Intenta de nuevo en unos segundos.',
        },
      });
    }
  };
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

    const body = req.body ?? {};
    const fields = Object.keys(body);
    const allowedFields = ['displayName', 'syncEmail'];
    if (!fields.length || fields.some(field => allowedFields.indexOf(field) === -1)) {
      res.status(400).json({ error: { message: 'invalid profile fields', explanation: 'Los datos del perfil no son válidos.' } });
      return;
    }

    const update: { [key: string]: any } = {};
    if ('displayName' in body) {
      const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
      if (!displayName || displayName.length > MAX_DISPLAY_NAME_LENGTH) {
        res.status(400).json({ error: { message: 'invalid displayName', explanation: 'El nombre debe tener entre 1 y 100 caracteres.' } });
        return;
      }
      update.displayName = displayName;
    }
    if ('syncEmail' in body && body.syncEmail !== true) {
      res.status(400).json({ error: { message: 'invalid email sync', explanation: 'No pudimos sincronizar el correo.' } });
      return;
    }
    if (body.syncEmail === true) update.email = firebaseUser.email || '';

    try {
      const docRef = db.collection('users').doc(firebaseUser.uid);
      const snapshot = await docRef.get();
      const profile = snapshot.data();
      if (!snapshot.exists || !isProfileOwnerRole(profile)) {
        res.status(403).json({ error: { message: 'profile role required', explanation: 'No tienes permiso para modificar este perfil.' } });
        return;
      }

      await docRef.set(update, { merge: true });
      res.status(200).json(toProfileResponse({ ...profile, ...update }));
    } catch (err) {
      logOperationalFailure({ event: 'profile_update_failed', operation: 'profile_update', uid: firebaseUser.uid, error: err });
      res.status(503).json({ error: { message: 'profile update failed', explanation: 'No pudimos actualizar tu perfil. Intenta de nuevo.' } });
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

    let uploadedFileId: string | undefined;
    try {
      const docRef = db.collection('users').doc(firebaseUser.uid);
      const snapshot = await docRef.get();
      const profile = snapshot.data();
      if (!snapshot.exists || !isProfileOwnerRole(profile)) {
        res.status(403).json({ error: { message: 'profile role required', explanation: 'No tienes permiso para modificar este perfil.' } });
        return;
      }

      const file = (req as any).file as UploadedAvatarFile | undefined;
      if (!file) {
        res.status(400).json({ error: { message: 'missing file', explanation: 'Debes seleccionar una imagen para subir.' } });
        return;
      }
      if (!ALLOWED_AVATAR_MIME_TYPES.has(file.mimetype)) {
        res.status(400).json({ error: { message: 'unsupported file type', explanation: 'La foto debe ser una imagen JPEG o WebP.' } });
        return;
      }
      if (file.size > MAX_AVATAR_FILE_SIZE_BYTES) {
        res.status(400).json({ error: { message: 'file too large', explanation: 'La foto supera el tamaño máximo permitido (2 MB).' } });
        return;
      }

      const previousFileId = typeof profile?.avatarFileId === 'string' ? profile.avatarFileId : undefined;

      const stored = await fileStorage.upload({
        buffer: file.buffer,
        contentType: file.mimetype,
        fileName: `${firebaseUser.uid}-avatar-${Date.now()}`,
      });
      uploadedFileId = stored.fileId;

      await docRef.set({ avatarUrl: stored.url, avatarFileId: stored.fileId }, { merge: true });
      uploadedFileId = undefined;

      if (previousFileId && previousFileId !== stored.fileId) {
        fileStorage.delete(previousFileId).catch(error =>
          logOperationalFailure({ event: 'avatar_replace_cleanup_failed', operation: 'avatar_upload', uid: firebaseUser.uid, error })
        );
      }

      res.status(200).json(toProfileResponse({ ...profile, avatarUrl: stored.url }));
    } catch (err) {
      if (uploadedFileId) {
        fileStorage.delete(uploadedFileId).catch(cleanupError =>
          logOperationalFailure({ event: 'avatar_upload_cleanup_failed', operation: 'avatar_upload', uid: firebaseUser.uid, error: cleanupError })
        );
      }
      logOperationalFailure({ event: 'avatar_upload_failed', operation: 'avatar_upload', uid: firebaseUser.uid, error: err });
      res.status(503).json({ error: { message: 'avatar upload failed', explanation: 'No pudimos subir la foto. Intenta de nuevo en unos segundos.' } });
    }
  };
}

// DELETE /profile/avatar. Deletes the stored file before clearing its profile fields.
// Same role guard as the PATCH handler.
export const createAvatarUploadErrorHandler = (): ErrorRequestHandler => (err, _req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({
      error: {
        message: 'file too large',
        explanation: 'La foto supera el tamaño máximo permitido (2 MB).',
      },
    });
    return;
  }
  next(err);
};

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
        res.status(403).json({ error: { message: 'profile role required', explanation: 'No tienes permiso para modificar este perfil.' } });
        return;
      }

      const fileId = typeof profile?.avatarFileId === 'string' ? profile.avatarFileId : undefined;

      if (fileId) {
        await fileStorage.delete(fileId);
      }

      await docRef.set({ avatarUrl: null, avatarFileId: null, avatarDataUrl: null }, { merge: true });
      res.status(200).json(toProfileResponse({ ...profile, avatarUrl: undefined, avatarDataUrl: undefined }));
    } catch (err) {
      logOperationalFailure({ event: 'avatar_delete_failed', operation: 'avatar_delete', uid: firebaseUser.uid, error: err });
      res.status(503).json({ error: { message: 'avatar delete failed', explanation: 'No pudimos eliminar la foto. Intenta de nuevo en unos segundos.' } });
    }
  };
}
