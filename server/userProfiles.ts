import { RequestHandler } from 'express';

/*
 * Firestore-backed user profiles: users/{uid} = { displayName, email, role, createdAt }.
 *
 * The role is self-declared at registration (accepted product decision for now),
 * BUT at request time the server always resolves the role by reading Firestore
 * with the uid from the VERIFIED ID token — nothing the browser sends is trusted.
 * Locking down who may hold role=teacher later only requires changing the write
 * path (createPostProfileHandler); every reader keeps working unchanged.
 *
 * Both endpoints assume firebaseAuthMiddleware already ran and attached the
 * decoded token to res.locals.firebaseUser.
 */

export type UserRole = 'teacher' | 'student';

const VALID_ROLES: UserRole[] = ['teacher', 'student'];

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
  set(data: { [key: string]: any }): Promise<unknown>;
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
  };
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
      console.error('userProfiles: could not read profile', err);
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
    const role = body.role;

    if (!VALID_ROLES.includes(role)) {
      res.status(400).json({
        error: {
          message: 'invalid role',
          explanation: 'El rol debe ser "teacher" o "student".',
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

      // Role is write-once through this endpoint: an existing profile is never
      // modified, we just echo it back. This is the single place to harden later
      // (e.g. requiring approval for role=teacher) without touching any reader.
      if (snapshot.exists) {
        res.status(200).json(toProfileResponse(snapshot.data() || {}));
        return;
      }

      // Email always comes from the verified token, never from the request body.
      const email = firebaseUser.email || '';
      await docRef.set({
        displayName,
        email,
        role,
        createdAt: serverTimestamp(),
      });

      res.status(201).json({ displayName, email, role });
    } catch (err) {
      console.error('userProfiles: could not save profile', err);
      res.status(503).json({
        error: {
          message: 'profile save failed',
          explanation: 'No pudimos guardar tu perfil. Intenta de nuevo en unos segundos.',
        },
      });
    }
  };
}
