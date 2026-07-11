import { RequestHandler } from 'express';

/*
 * Firestore-backed teacher "Clases" (scheduled sessions):
 * users/{uid}/classes/{classId} = { title, roomName, scheduledAt, studentCount,
 * status, createdAt }.
 *
 * Teacher enforcement happens HERE, server-side, same as resources.ts: every
 * handler re-resolves role from users/{uid} (written by userProfiles.ts) using the
 * uid from the VERIFIED ID token. All three endpoints assume firebaseAuthMiddleware
 * already ran and attached the decoded token to res.locals.firebaseUser.
 *
 * roomName is a slug derived from title, computed HERE (server-side) rather than
 * imported from src/ — this codebase's convention (see roomAccessGuard.ts) is that
 * server and client independently duplicate small pure helpers so each server unit
 * stays independently deployable. Mirrors toClassSessionRoomName in
 * src/components/PreJoinScreens/classSessionTypes.ts.
 */

const MAX_TITLE_LENGTH = 200;
const MAX_STUDENT_COUNT = 500;

// Max scheduled classes returned by GET /classes (soonest first).
const MAX_CLASSES_RETURNED = 200;

const FALLBACK_ROOM_NAME = 'class-session';

function slugifyTitle(title: string): string {
  const asciiValue = title
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return asciiValue || FALLBACK_ROOM_NAME;
}

// Decoded Firebase identity attached by firebaseAuthMiddleware. Duplicated from
// resources.ts/userProfiles.ts on purpose — each server unit stays independently
// deployable and testable.
export interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
}

// ─── Structural Firestore slice ────────────────────────────────────────────────
// Minimal surface used below; the real firebase-admin Firestore satisfies all of
// these structurally (same pattern as ResourcesDatabase in resources.ts).

export interface ClassDocumentSnapshot {
  id: string;
  exists: boolean;
  data(): { [key: string]: any } | undefined;
}

export interface ClassDocumentReference {
  id: string;
  get(): Promise<ClassDocumentSnapshot>;
  set(data: { [key: string]: any }): Promise<unknown>;
  delete(): Promise<unknown>;
}

export interface ClassQuerySnapshot {
  docs: ClassDocumentSnapshot[];
}

export interface ClassesQuery {
  get(): Promise<ClassQuerySnapshot>;
}

export interface ClassesCollection {
  doc(id?: string): ClassDocumentReference;
  orderBy(field: string, direction: 'asc' | 'desc'): { limit(n: number): ClassesQuery };
}

export interface ClassesUserDocumentSnapshot {
  exists: boolean;
  data(): { [key: string]: any } | undefined;
}

export interface ClassesUserDocumentReference {
  get(): Promise<ClassesUserDocumentSnapshot>;
  collection(name: string): ClassesCollection;
}

export interface ClassesDatabase {
  collection(name: string): { doc(id: string): ClassesUserDocumentReference };
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
      explanation: 'Las clases programadas solo están disponibles para profesores.',
    },
  });
}

function sendBadRequest(res: Parameters<RequestHandler>[1], message: string, explanation: string) {
  res.status(400).json({ error: { message, explanation } });
}

/**
 * Resolves whether the verified uid holds role=teacher in Firestore, mirroring
 * resources.ts. Throws on Firestore failure (caller maps it to 503).
 */
async function resolveIsTeacher(db: ClassesDatabase, uid: string): Promise<boolean> {
  const snapshot = await db
    .collection('users')
    .doc(uid)
    .get();
  if (!snapshot.exists) return false;
  const data = snapshot.data() || {};
  return data.role === 'teacher';
}

function toClassResponse(id: string, data: { [key: string]: any }, scheduledAtMs: number | null) {
  return {
    id,
    title: data.title,
    roomName: data.roomName,
    scheduledAtMs,
    studentCount: data.studentCount,
  };
}

export function createGetClassesHandler(db: ClassesDatabase): RequestHandler {
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

      // Single-field orderBy on a subcollection — no composite index required. `status`
      // is not filtered here on purpose: cancelling a class hard-deletes its doc (see
      // createDeleteClassHandler), so every remaining doc is implicitly 'scheduled'.
      const snapshot = await db
        .collection('users')
        .doc(firebaseUser.uid)
        .collection('classes')
        .orderBy('scheduledAt', 'asc')
        .limit(MAX_CLASSES_RETURNED)
        .get();

      const classes = snapshot.docs.map(doc => {
        const data = doc.data() || {};
        const scheduledAtMs =
          data.scheduledAt && typeof data.scheduledAt.toMillis === 'function' ? data.scheduledAt.toMillis() : null;
        return toClassResponse(doc.id, data, scheduledAtMs);
      });

      res.status(200).json(classes);
    } catch (err) {
      console.error('classes: could not list classes', err);
      res.status(503).json({
        error: {
          message: 'class lookup failed',
          explanation: 'No pudimos consultar las clases programadas. Intenta de nuevo en unos segundos.',
        },
      });
    }
  };
}

export function createCreateClassHandler(db: ClassesDatabase, serverTimestamp: () => unknown): RequestHandler {
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

      const body = req.body ?? {};

      const title = typeof body.title === 'string' ? body.title.trim().slice(0, MAX_TITLE_LENGTH) : '';
      if (!title) {
        sendBadRequest(res, 'invalid title', 'Debes indicar un título para la clase.');
        return;
      }

      const scheduledAtMs = body.scheduledAtMs;
      if (typeof scheduledAtMs !== 'number' || !Number.isFinite(scheduledAtMs) || isNaN(new Date(scheduledAtMs).getTime())) {
        sendBadRequest(res, 'invalid scheduledAtMs', 'Debes indicar una fecha y hora válidas para la clase.');
        return;
      }

      let studentCount = 0;
      if (body.studentCount !== undefined) {
        if (
          typeof body.studentCount !== 'number' ||
          !Number.isInteger(body.studentCount) ||
          body.studentCount < 0 ||
          body.studentCount > MAX_STUDENT_COUNT
        ) {
          sendBadRequest(res, 'invalid studentCount', 'La cantidad de alumnos esperados no es válida.');
          return;
        }
        studentCount = body.studentCount;
      }

      const roomName = slugifyTitle(title);

      const docRef = db
        .collection('users')
        .doc(firebaseUser.uid)
        .collection('classes')
        .doc();

      await docRef.set({
        title,
        roomName,
        scheduledAt: new Date(scheduledAtMs),
        studentCount,
        status: 'scheduled',
        createdAt: serverTimestamp(),
      });

      res.status(201).json(toClassResponse(docRef.id, { title, roomName, studentCount }, scheduledAtMs));
    } catch (err) {
      console.error('classes: could not save the class', err);
      res.status(503).json({
        error: {
          message: 'class save failed',
          explanation: 'No pudimos crear la clase. Intenta de nuevo en unos segundos.',
        },
      });
    }
  };
}

export function createDeleteClassHandler(db: ClassesDatabase): RequestHandler {
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
        .collection('classes')
        .doc(req.params.id);
      const snapshot = await docRef.get();

      if (!snapshot.exists) {
        res.status(404).json({
          error: { message: 'class not found', explanation: 'La clase solicitada no existe.' },
        });
        return;
      }

      await docRef.delete();

      res.status(200).json({ deleted: true });
    } catch (err) {
      console.error('classes: could not delete the class', err);
      res.status(503).json({
        error: {
          message: 'class delete failed',
          explanation: 'No pudimos cancelar la clase. Intenta de nuevo en unos segundos.',
        },
      });
    }
  };
}
