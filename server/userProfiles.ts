import { RequestHandler } from 'express';
import { logOperationalFailure } from './operationalEvents';

/*
 * Firestore-backed user profiles: users/{uid} = { displayName, email, role, createdAt }.
 *
 * Client registration can only create student profiles. Teacher profiles are
 * provisioned by an administrator with the documented bootstrap command, so a
 * verified Firebase identity alone can never grant teacher access.
 *
 * Both endpoints assume firebaseAuthMiddleware already ran and attached the
 * decoded token to res.locals.firebaseUser.
 */

export type UserRole = 'teacher' | 'student';

const STUDENT_ROLE: UserRole = 'student';

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
  avatarDataUrl?: string;
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

function toProfileResponse(data: { [key: string]: any }): UserProfile {
  return {
    displayName: data.displayName,
    email: data.email,
    role: data.role,
    avatarDataUrl: typeof data.avatarDataUrl === 'string' ? data.avatarDataUrl : undefined,
  };
}

const MAX_DISPLAY_NAME_LENGTH = 100;
const MAX_AVATAR_DATA_URL_LENGTH = 96000;
const AVATAR_DATA_URL = /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

function isTeacherProfile(data: { [key: string]: any } | undefined): boolean {
  return data?.role === 'teacher';
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

    if (requestedRole !== STUDENT_ROLE) {
      res.status(400).json({
        error: {
          message: 'teacher provisioning required',
          explanation: 'Las cuentas docentes deben ser habilitadas por un administrador.',
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
        role: STUDENT_ROLE,
        createdAt: serverTimestamp(),
      });

      res.status(201).json({ displayName, email, role: STUDENT_ROLE });
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

// Updates only a verified teacher's own presentation fields. Email is never accepted
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
    const allowedFields = ['displayName', 'avatarDataUrl', 'syncEmail'];
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
    if ('avatarDataUrl' in body) {
      const avatarDataUrl = body.avatarDataUrl;
      if (
        avatarDataUrl !== null &&
        (typeof avatarDataUrl !== 'string' || avatarDataUrl.length > MAX_AVATAR_DATA_URL_LENGTH || !AVATAR_DATA_URL.test(avatarDataUrl))
      ) {
        res.status(400).json({ error: { message: 'invalid avatar', explanation: 'La foto debe ser una imagen JPEG o WebP válida y pequeña.' } });
        return;
      }
      update.avatarDataUrl = avatarDataUrl;
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
      if (!snapshot.exists || !isTeacherProfile(profile)) {
        res.status(403).json({ error: { message: 'teacher role required', explanation: 'Esta sección es exclusiva para docentes.' } });
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
