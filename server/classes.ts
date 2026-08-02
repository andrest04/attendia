import { RequestHandler } from 'express';
import { logOperationalFailure } from './operationalEvents';
import { canonicalNotificationId } from './notifications';

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
// Duration is optional on create (mirrors studentCount's default-to-0 pattern) —
// this default only applies to classes scheduled before the field existed, or
// requests that omit it outright.
const DEFAULT_DURATION_MINUTES = 60;
const MAX_DURATION_MINUTES = 480; // 8h — generous upper bound for a single session.

// A scheduled class must start in the future. The tolerance absorbs the date/time
// pickers' minute granularity plus request latency — without it, picking "now"
// client-side can land a few seconds in the past by the time this handler runs.
const PAST_SCHEDULE_TOLERANCE_MS = 60 * 1000;

// Max scheduled classes returned by GET /classes (soonest first).
const MAX_CLASSES_RETURNED = 200;

const FALLBACK_ROOM_NAME = 'class-session';
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

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

// roomName must be unique per class doc, not just per title \u2014 two classes titled
// "test" would otherwise slug to the same Twilio room and collide (same
// participants/chat/attention data). The doc id (== idempotencyKey) is already
// unique per creation, so it doubles as the disambiguator.
function buildRoomName(title: string, docId: string): string {
  // The tail, not the head: idempotency keys share a "class-" prefix, so only the
  // trailing random segment reliably disambiguates two same-titled classes.
  return `${slugifyTitle(title)}-${docId.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(-8)}`;
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
  update(data: { [key: string]: any }): Promise<unknown>;
  delete(): Promise<unknown>;
  // Recursive on purpose (mirrors ReportDocumentReference in attentionReports.ts):
  // deleting a class also needs to reach its owner's notificationState/
  // notificationGenerations subcollections, which hang off the same user doc this
  // reference descends from.
  collection(name: string): ClassesCollection;
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

export interface ClassTransaction {
  get(reference: ClassDocumentReference): Promise<ClassDocumentSnapshot>;
  set(reference: ClassDocumentReference, data: { [key: string]: any }): unknown;
  update(reference: ClassDocumentReference, data: { [key: string]: any }): unknown;
  delete(reference: ClassDocumentReference): unknown;
}

export interface ClassesDatabase {
  collection(name: string): { doc(id: string): ClassesUserDocumentReference };
  runTransaction<T>(updateFunction: (transaction: ClassTransaction) => Promise<T>): Promise<T>;
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
    durationMinutes: typeof data.durationMinutes === 'number' ? data.durationMinutes : DEFAULT_DURATION_MINUTES,
    status: data.status === 'completed' ? 'completed' : data.status === 'started' ? 'started' : 'scheduled',
  };
}

function timestampMillis(value: any): number | null {
  if (value instanceof Date) return value.getTime();
  if (!value || typeof value.toMillis !== 'function') return null;
  const result = value.toMillis();
  return Number.isFinite(result) ? result : null;
}

// Duplicated from attentionReports.ts/notificationReconciliation.ts on purpose —
// this codebase's convention (see roomAccessGuard.ts) is that each server unit
// stays independently deployable, so small pure helpers are copied rather than
// imported across leaf modules.
function effectivelyUnread(item: { [key: string]: any }, readBefore: unknown): boolean {
  const createdAt = timestampMillis(item.createdAt);
  const boundary = timestampMillis(readBefore);
  return timestampMillis(item.readAt) === null && !(boundary !== null && createdAt !== null && createdAt <= boundary);
}

function getOwnedClass(db: ClassesDatabase, uid: string, id: string) {
  return db
    .collection('users')
    .doc(uid)
    .collection('classes')
    .doc(id);
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
      logOperationalFailure({ event: 'class_lookup_failed', operation: 'GET /classes', uid: firebaseUser.uid, error: err });
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
      if (
        typeof scheduledAtMs !== 'number' ||
        !Number.isFinite(scheduledAtMs) ||
        isNaN(new Date(scheduledAtMs).getTime())
      ) {
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

      let durationMinutes = DEFAULT_DURATION_MINUTES;
      if (body.durationMinutes !== undefined) {
        if (
          typeof body.durationMinutes !== 'number' ||
          !Number.isInteger(body.durationMinutes) ||
          body.durationMinutes <= 0 ||
          body.durationMinutes > MAX_DURATION_MINUTES
        ) {
          sendBadRequest(res, 'invalid durationMinutes', 'La duración de la clase no es válida.');
          return;
        }
        durationMinutes = body.durationMinutes;
      }

      const idempotencyKey = body.idempotencyKey;
      if (typeof idempotencyKey !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
        sendBadRequest(res, 'invalid idempotencyKey', 'La clave de creación no es válida. Reintenta desde el formulario.');
        return;
      }

      // Optional: the quick-start sidebar flow already showed the teacher a join
      // code/link derived from this exact room name before hitting this endpoint —
      // recomputing our own slug here would silently invalidate what was already
      // shared. When provided, trust it verbatim instead of deriving one.
      let explicitRoomName: string | undefined;
      if (body.roomName !== undefined) {
        if (typeof body.roomName !== 'string' || !body.roomName.trim() || body.roomName.length > MAX_TITLE_LENGTH) {
          sendBadRequest(res, 'invalid roomName', 'El nombre de la sala no es válido.');
          return;
        }
        explicitRoomName = body.roomName.trim();
      }

      const userRef = db.collection('users').doc(firebaseUser.uid);
      const docRef = userRef.collection('classes').doc(idempotencyKey);
      const tombstoneRef = userRef.collection('classOccurrenceTombstones').doc(idempotencyKey);
      const roomName = explicitRoomName || buildRoomName(title, docRef.id);

      const outcome = await db.runTransaction(async transaction => {
        const existing = await transaction.get(docRef);
        const tombstone = await transaction.get(tombstoneRef);
        if (existing.exists) return { kind: 'existing' as const, data: existing.data() || {} };
        if (tombstone.exists) return { kind: 'tombstoned' as const };
        if (scheduledAtMs < Date.now() - PAST_SCHEDULE_TOLERANCE_MS) return { kind: 'past' as const };

        await transaction.set(docRef, {
          title,
          roomName,
          scheduledAt: new Date(scheduledAtMs),
          studentCount,
          durationMinutes,
          status: 'scheduled',
          idempotencyKey,
          createdAt: serverTimestamp(),
        });
        return { kind: 'created' as const };
      });

      if (outcome.kind === 'existing') {
        const existingScheduledAtMs =
          outcome.data.scheduledAt && typeof outcome.data.scheduledAt.toMillis === 'function'
            ? outcome.data.scheduledAt.toMillis()
            : null;
        res.status(200).json(toClassResponse(docRef.id, outcome.data, existingScheduledAtMs));
        return;
      }
      if (outcome.kind === 'tombstoned') {
        res.status(409).json({
          error: {
            message: 'class occurrence canceled',
            explanation: 'Esta ocurrencia de clase ya fue cancelada y no puede volver a crearse.',
          },
        });
        return;
      }
      if (outcome.kind === 'past') {
        sendBadRequest(res, 'scheduledAtMs in the past', 'No puedes programar una clase en una fecha u hora pasada.');
        return;
      }

      res.status(201).json(toClassResponse(docRef.id, { title, roomName, studentCount, durationMinutes }, scheduledAtMs));
    } catch (err) {
      logOperationalFailure({ event: 'class_save_failed', operation: 'POST /classes', uid: firebaseUser.uid, error: err });
      res.status(503).json({
        error: {
          message: 'class save failed',
          explanation: 'No pudimos crear la clase. Intenta de nuevo en unos segundos.',
        },
      });
    }
  };
}

export function createDeleteClassHandler(
  db: ClassesDatabase,
  serverTimestamp: () => unknown = () => new Date()
): RequestHandler {
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

      const userRef = db.collection('users').doc(firebaseUser.uid);
      const docRef = userRef.collection('classes').doc(req.params.id);
      const tombstoneRef = userRef.collection('classOccurrenceTombstones').doc(req.params.id);
      const reason = req.body && req.body.reason === 'canceled' ? 'canceled' : 'deleted';
      const outcome = await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(docRef);
        const tombstone = await transaction.get(tombstoneRef);

        if (!snapshot.exists) return tombstone.exists ? 'replayed' : 'not-found';
        const data = snapshot.data() || {};

        // A canceled/deleted class occurrence must not leave a stale
        // "class.upcoming"/"class.not_started" notification behind for the
        // teacher — the periodic reconcile sweep would eventually catch it, but
        // deleting it here in the same transaction gives immediate consistency
        // (mirrors the report-recovery notification cleanup in attentionReports.ts).
        // Firestore transactions require every read before any write, so all the
        // lookups below (state, then each notification item) happen before the
        // tombstone/item/state/class writes further down.
        const stateRef = userRef.collection('notificationState').doc('inbox');
        const stateSnapshot = await transaction.get(stateRef);
        const state = stateSnapshot.exists ? stateSnapshot.data() || {} : {};
        const generation = Number.isSafeInteger(state.currentGeneration) ? state.currentGeneration : 0;
        const items = userRef.collection('notificationGenerations').doc(String(generation)).collection('items');
        const classNotificationKeys: Array<{ eventType: 'class.upcoming' | 'class.not_started'; eventKey: string }> = [
          { eventType: 'class.upcoming', eventKey: `class:${req.params.id}:upcoming` },
          { eventType: 'class.not_started', eventKey: `class:${req.params.id}:not-started` },
        ];
        const itemSnapshots = [];
        for (const key of classNotificationKeys) {
          const itemRef = items.doc(canonicalNotificationId(key.eventType, key.eventKey));
          itemSnapshots.push({ itemRef, itemSnapshot: await transaction.get(itemRef) });
        }

        if (!tombstone.exists && data.status !== 'started' && data.status !== 'completed') {
          await transaction.set(tombstoneRef, {
            scheduledAt: data.scheduledAt,
            canceledAt: serverTimestamp(),
            reason,
            wasStarted: false,
          });
        }

        let unreadDelta = 0;
        for (const { itemRef, itemSnapshot } of itemSnapshots) {
          if (!itemSnapshot.exists) continue;
          if (effectivelyUnread(itemSnapshot.data() || {}, state.readBefore)) unreadDelta++;
          transaction.delete(itemRef);
        }
        if (unreadDelta > 0 && stateSnapshot.exists) {
          const unreadCount = Number.isSafeInteger(state.unreadCount) ? state.unreadCount : 0;
          transaction.update(stateRef, { unreadCount: Math.max(0, unreadCount - unreadDelta) });
        }

        await transaction.delete(docRef);
        return 'deleted';
      });

      if (outcome === 'not-found') {
        res.status(404).json({
          error: { message: 'class not found', explanation: 'La clase solicitada no existe.' },
        });
        return;
      }

      res.status(200).json({ deleted: true });
    } catch (err) {
      logOperationalFailure({
        event: 'class_delete_failed', operation: 'DELETE /classes/:id', uid: firebaseUser.uid, classId: req.params.id, error: err,
      });
      res.status(503).json({
        error: {
          message: 'class delete failed',
          explanation: 'No pudimos cancelar la clase. Intenta de nuevo en unos segundos.',
        },
      });
    }
  };
}

/** Marks a verified teacher's scheduled class as started after its token was issued. */
export function createStartClassHandler(db: ClassesDatabase, serverTimestamp: () => unknown): RequestHandler {
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
      const docRef = getOwnedClass(db, firebaseUser.uid, req.params.id);
      const snapshot = await docRef.get();
      const data = snapshot.data();
      if (!snapshot.exists || !data) {
        res.status(404).json({ error: { message: 'class not found', explanation: 'La clase solicitada no existe.' } });
        return;
      }
      if (typeof req.body?.roomName !== 'string' || req.body.roomName !== data.roomName) {
        sendBadRequest(res, 'roomName mismatch', 'La sala no corresponde a la clase programada.');
        return;
      }
      if (data.status === 'scheduled') {
        await docRef.update({ status: 'started', startedAt: serverTimestamp() });
      }
      res.status(200).json({ started: true });
    } catch (err) {
      logOperationalFailure({
        event: 'class_start_failed', operation: 'POST /classes/:id/start', uid: firebaseUser.uid, classId: req.params.id, error: err,
      });
      res.status(503).json({
        error: {
          message: 'class start failed',
          explanation: 'No pudimos iniciar la clase. Intenta de nuevo en unos segundos.',
        },
      });
    }
  };
}
