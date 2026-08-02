import { createHash } from 'crypto';
import { RequestHandler } from 'express';
import { logOperationalFailure } from './operationalEvents';
import { authorizeTeacher } from './teacherAuthorization';
import {
  CanonicalNotificationCandidate,
  Cursor,
  Document,
  DocumentSnapshot,
  EventType,
  NotificationsDatabase,
  Transaction,
} from './notificationsTypes';

const PAGE_SIZE = 10;
export const CLEAR_BATCH_SIZE = 100;

type Snapshot = { id: string; data(): { [key: string]: any } | undefined };

const EVENT_KEY_PATTERNS: { [key in EventType]: RegExp } = {
  'class.upcoming': /^class:[A-Za-z0-9_-]{1,128}:upcoming$/,
  'class.not_started': /^class:[A-Za-z0-9_-]{1,128}:not-started$/,
  'recording.ready': /^recording:[A-Za-z0-9_-]{1,128}:ready$/,
  'recording.failed': /^recording:[A-Za-z0-9_-]{1,128}:failed$/,
  'report.save_failed': /^report:[A-Za-z0-9_-]{1,128}:save-failed:[A-Za-z0-9_-]{1,128}$/,
};
const NOTIFICATION_ID = /^[a-f0-9]{64}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function canonicalNotificationId(eventType: EventType, eventKey: string): string {
  const pattern = EVENT_KEY_PATTERNS[eventType];
  if (!pattern || typeof eventKey !== 'string' || !pattern.test(eventKey)) {
    throw new Error('invalid canonical event key');
  }
  return createHash('sha256').update(eventKey, 'utf8').digest('hex');
}

function validateCanonicalSource(candidate: CanonicalNotificationCandidate) {
  const parts = candidate.eventKey.split(':');
  const source = candidate.source as any;
  const valid = candidate.eventType.startsWith('class.')
    ? source.kind === 'class' && source.classId === parts[1]
    : candidate.eventType.startsWith('recording.')
      ? source.kind === 'recording' && source.manualRequestId === parts[1] &&
        typeof source.roomSid === 'string' && source.roomSid.length > 0
      : source.kind === 'report' && source.reportId === parts[1] &&
        source.failureEpisodeId === parts[4];
  if (!valid) throw new Error('invalid canonical source');
}

export function millis(value: any): number | null {
  return value && typeof value.toMillis === 'function' ? value.toMillis() : null;
}

function decodeCursor(value: unknown): Cursor | undefined {
  if (typeof value !== 'string' || !value || value.length > 1024) return undefined;
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
    if (
      !Number.isSafeInteger(parsed.generation) ||
      !Number.isFinite(parsed.eventOccurrenceAtMs) ||
      !Number.isFinite(parsed.createdAtMs) ||
      typeof parsed.id !== 'string' ||
      !parsed.id ||
      parsed.id.length > 256
    ) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function toResponse(snapshot: Snapshot, readBeforeMs: number | null) {
  const data = snapshot.data() || {};
  const createdAtMs = millis(data.createdAt);
  const explicitReadAtMs = millis(data.readAt);
  const effectivelyRead = explicitReadAtMs !== null || (
    readBeforeMs !== null && createdAtMs !== null && createdAtMs <= readBeforeMs
  );
  return {
    notificationId: snapshot.id,
    ownerUid: data.ownerUid,
    eventType: data.eventType,
    eventKey: data.eventKey,
    source: data.source,
    eventOccurrenceAtMs: millis(data.eventOccurrenceAt),
    createdAtMs,
    readAtMs: explicitReadAtMs === null && effectivelyRead ? readBeforeMs : explicitReadAtMs,
    title: data.title,
    message: data.message,
    destination: data.destination,
  };
}

function sendError(res: Parameters<RequestHandler>[1], status: number, message: string, explanation: string) {
  res.status(status).json({ error: { message, explanation } });
}

// Shared envelope for the three write endpoints below (clear / mark-all-read /
// patch-read): authorize, run the endpoint-specific work, fire the bounded
// maintenance tail call only after a successful response, and fall back to a 503
// (or the endpoint's one special status, e.g. 409/404) on failure. `handle` must
// return true only along the success path that already sent a 2xx response —
// every early/validation return (already-sent 4xx) must return false so the
// maintenance tail call is skipped, matching each handler's original behavior.
async function withTeacherHandler(
  db: NotificationsDatabase,
  res: Parameters<RequestHandler>[1],
  boundedMaintenance: (uid: string) => Promise<unknown>,
  operation: string,
  failureEvent: string,
  failureMessage: string,
  failureExplanation: string,
  statusOverride: { status: number; message: string; explanation: string },
  handle: (uid: string) => Promise<boolean>
): Promise<void> {
  let uid: string | undefined;
  try {
    uid = await authorizeTeacher(db, res);
    if (!uid) return;
    const succeeded = await handle(uid);
    if (succeeded) {
      await boundedMaintenance(uid).catch(error => logOperationalFailure({
        event: 'notification_maintenance_failed', operation, uid: uid!, error,
      }));
    }
  } catch (error) {
    if ((error as any).status === statusOverride.status) {
      sendError(res, statusOverride.status, statusOverride.message, statusOverride.explanation);
      return;
    }
    logOperationalFailure({ event: failureEvent, operation, uid, error });
    sendError(res, 503, failureMessage, failureExplanation);
  }
}

function requireIdempotencyKey(
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1]
): string | undefined {
  const header = req.headers && req.headers['idempotency-key'];
  const idempotencyKey = Array.isArray(header) ? undefined : header;
  if (typeof idempotencyKey !== 'string' || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
    sendError(res, 400, 'invalid idempotency key', 'La clave de idempotencia no es válida.');
    return undefined;
  }
  return idempotencyKey;
}

// Shared idempotency-key/receipt-transaction envelope for clear and mark-all-read:
// both persist a durable receipt keyed by the client's idempotency key, replay
// that receipt's response on retry, and 409 when the same key is reused for a
// different kind of operation. `applyMutation` performs only the operation-specific
// reads/writes and returns the acceptedAt sentinel (so callers keep full control of
// exactly when it's requested) plus the response to persist on the receipt.
async function commitIdempotentMutation(
  db: NotificationsDatabase,
  uid: string,
  idempotencyKey: string,
  kind: string,
  notCommittedMessage: string,
  applyMutation: (
    transaction: Transaction,
    stateRef: Document,
    stateSnapshot: DocumentSnapshot,
    generation: number
  ) => Promise<{ acceptedAt: unknown; response: { [key: string]: any } }>
): Promise<{ acceptedAtMs: number; response: { [key: string]: any } }> {
  const receiptRef = operationDocument(db, uid, idempotencyKey);
  await db.runTransaction(async transaction => {
    const receiptSnapshot = await transaction.get(receiptRef);
    if (receiptSnapshot.exists) {
      if ((receiptSnapshot.data() || {}).kind !== kind) {
        const conflict: any = new Error('idempotency key conflict');
        conflict.status = 409;
        throw conflict;
      }
      return;
    }
    const stateRef = stateDocument(db, uid);
    const stateSnapshot = await transaction.get(stateRef);
    const state = stateSnapshot.exists ? stateSnapshot.data() || {} : {};
    const generation = Number.isSafeInteger(state.currentGeneration) ? state.currentGeneration : 0;
    const { acceptedAt, response } = await applyMutation(transaction, stateRef, stateSnapshot, generation);
    transaction.create(receiptRef, { kind, acceptedAt, generation, response });
  });

  const receipt = (await receiptRef.get()).data() || {};
  const acceptedAtMs = millis(receipt.acceptedAt);
  if (receipt.kind !== kind || acceptedAtMs === null) throw new Error(notCommittedMessage);
  return { acceptedAtMs, response: receipt.response };
}

export function createClearNotificationsHandler(
  db: NotificationsDatabase,
  serverTimestamp: () => unknown,
  boundedMaintenance: (uid: string) => Promise<unknown> = async () => undefined
): RequestHandler {
  return async (req, res) => {
    await withTeacherHandler(
      db, res, boundedMaintenance, 'DELETE /notifications',
      'notification_clear_failed', 'notification clear failed', 'No se pudieron vaciar las notificaciones.',
      { status: 409, message: 'idempotency key conflict', explanation: 'La clave ya fue usada para otra operación.' },
      async uid => {
        const idempotencyKey = requireIdempotencyKey(req, res);
        if (!idempotencyKey) return false;

        const { acceptedAtMs, response } = await commitIdempotentMutation(
          db, uid, idempotencyKey, 'clear', 'clear receipt not committed',
          async (transaction, stateRef, stateSnapshot, generation) => {
            const jobRef = clearJobDocument(db, uid, generation);
            const jobSnapshot = await transaction.get(jobRef);
            const acceptedAt = serverTimestamp();
            if (!jobSnapshot.exists) {
              transaction.create(jobRef, {
                retiredGeneration: generation,
                nextAfterId: null,
                batchSize: CLEAR_BATCH_SIZE,
                status: 'pending',
                createdAt: acceptedAt,
                updatedAt: acceptedAt,
                deletedCount: 0,
              });
            }
            const acceptedState = {
              currentGeneration: generation + 1,
              clearBefore: acceptedAt,
              readBefore: null,
              unreadCount: 0,
              classSweepAfter: null,
              updatedAt: acceptedAt,
            };
            if (stateSnapshot.exists) transaction.update(stateRef, acceptedState);
            else transaction.create(stateRef, acceptedState);
            return { acceptedAt, response: { unreadCount: 0 } };
          }
        );

        res.status(200).json({ acceptedAtMs, unreadCount: response.unreadCount });
        return true;
      }
    );
  };
}

export function createMarkAllNotificationsReadHandler(
  db: NotificationsDatabase,
  serverTimestamp: () => unknown,
  boundedMaintenance: (uid: string) => Promise<unknown> = async () => undefined
): RequestHandler {
  return async (req, res) => {
    await withTeacherHandler(
      db, res, boundedMaintenance, 'POST /notifications/mark-all-read',
      'notification_mark_all_failed', 'notification mark-all failed',
      'No se pudieron marcar las notificaciones como leídas.',
      { status: 409, message: 'idempotency key conflict', explanation: 'La clave ya fue usada para otra operación.' },
      async uid => {
        const idempotencyKey = requireIdempotencyKey(req, res);
        if (!idempotencyKey) return false;

        const { acceptedAtMs, response } = await commitIdempotentMutation(
          db, uid, idempotencyKey, 'mark-all-read', 'mark-all receipt not committed',
          async (transaction, stateRef, stateSnapshot, _generation) => {
            const acceptedAt = serverTimestamp();
            const acceptedState = { readBefore: acceptedAt, unreadCount: 0, updatedAt: acceptedAt };
            if (stateSnapshot.exists) {
              transaction.update(stateRef, acceptedState);
            } else {
              transaction.create(stateRef, {
                currentGeneration: 0, clearBefore: null, classSweepAfter: null, ...acceptedState,
              });
            }
            return { acceptedAt, response: { unreadCount: 0 } };
          }
        );

        res.status(200).json({ acceptedAtMs, unreadCount: response.unreadCount });
        return true;
      }
    );
  };
}

export function createPatchNotificationReadHandler(
  db: NotificationsDatabase,
  serverTimestamp: () => unknown,
  boundedMaintenance: (uid: string) => Promise<unknown> = async () => undefined
): RequestHandler {
  return async (req, res) => {
    await withTeacherHandler(
      db, res, boundedMaintenance, 'PATCH /notifications/:id/read',
      'notification_read_failed', 'notification read failed', 'No se pudo marcar la notificación como leída.',
      { status: 404, message: 'notification not found', explanation: 'La notificación no existe en la bandeja actual.' },
      async uid => {
        const id = req.params && req.params.id;
        if (typeof id !== 'string' || !NOTIFICATION_ID.test(id)) {
          sendError(res, 400, 'invalid notification id', 'La notificación no es válida.');
          return false;
        }

        await db.runTransaction(async transaction => {
          const stateRef = stateDocument(db, uid);
          const stateSnapshot = await transaction.get(stateRef);
          const state = stateSnapshot.exists ? stateSnapshot.data() || {} : {};
          const generation = Number.isSafeInteger(state.currentGeneration) ? state.currentGeneration : 0;
          const itemRef = itemDocument(db, uid, generation, id);
          const itemSnapshot = await transaction.get(itemRef);
          if (!itemSnapshot.exists || (itemSnapshot.data() || {}).ownerUid !== uid) {
            const notFound: any = new Error('notification not found');
            notFound.status = 404;
            throw notFound;
          }
          const item = itemSnapshot.data() || {};
          const readBeforeMs = millis(state.readBefore);
          const effectivelyRead = millis(item.readAt) !== null || (
            readBeforeMs !== null && millis(item.createdAt) !== null && millis(item.createdAt)! <= readBeforeMs
          );
          if (!effectivelyRead) {
            transaction.update(itemRef, { readAt: serverTimestamp() });
            transaction.update(stateRef, {
              unreadCount: Math.max(0, (Number.isSafeInteger(state.unreadCount) ? state.unreadCount : 0) - 1),
            });
          }
        });

        const committedState = (await stateDocument(db, uid).get()).data() || {};
        const generation = Number.isSafeInteger(committedState.currentGeneration)
          ? committedState.currentGeneration
          : 0;
        const committedItem = await itemDocument(db, uid, generation, id).get();
        if (!committedItem.exists) {
          const notFound: any = new Error('notification not found');
          notFound.status = 404;
          throw notFound;
        }
        res.status(200).json({
          notification: toResponse({ id, data: () => committedItem.data() }, millis(committedState.readBefore)),
          unreadCount: Number.isSafeInteger(committedState.unreadCount) ? committedState.unreadCount : 0,
        });
        return true;
      }
    );
  };
}

export function userDocument(db: NotificationsDatabase, uid: string): Document {
  return db.collection('users').doc(uid);
}

function stateDocument(db: NotificationsDatabase, uid: string) {
  return userDocument(db, uid).collection('notificationState').doc('inbox');
}

function operationDocument(db: NotificationsDatabase, uid: string, idempotencyKey: string) {
  return userDocument(db, uid).collection('notificationOperations').doc(idempotencyKey);
}

export function clearJobDocument(db: NotificationsDatabase, uid: string, generation: number) {
  return userDocument(db, uid).collection('notificationClearJobs').doc(String(generation));
}

export function itemDocument(db: NotificationsDatabase, uid: string, generation: number, id: string) {
  return userDocument(db, uid)
    .collection('notificationGenerations')
    .doc(String(generation))
    .collection('items')
    .doc(id);
}

function immutableShape(value: { [key: string]: any }) {
  return JSON.stringify({
    ownerUid: value.ownerUid,
    eventType: value.eventType,
    eventKey: value.eventKey,
    source: value.source,
    eventOccurrenceAtMs: millis(value.eventOccurrenceAt),
    title: value.title,
    message: value.message,
    destination: value.destination,
  });
}

export async function persistCanonicalNotification(
  db: NotificationsDatabase,
  uid: string,
  candidate: CanonicalNotificationCandidate,
  createdAt: unknown
) {
  const notificationId = canonicalNotificationId(candidate.eventType, candidate.eventKey);
  validateCanonicalSource(candidate);
  return db.runTransaction(async transaction => {
    const stateRef = stateDocument(db, uid);
    const stateSnapshot = await transaction.get(stateRef);
    const state = stateSnapshot.exists ? stateSnapshot.data() || {} : {};
    const generation = Number.isSafeInteger(state.currentGeneration) ? state.currentGeneration : 0;
    const itemRef = itemDocument(db, uid, generation, notificationId);
    const existingSnapshot = await transaction.get(itemRef);
    const canonical = {
      notificationId,
      ownerUid: uid,
      ...candidate,
      createdAt,
      readAt: null,
    };
    if (existingSnapshot.exists) {
      const existing = existingSnapshot.data() || {};
      if (existing.eventKey !== candidate.eventKey) throw new Error('notification collision');
      if (immutableShape(existing) !== immutableShape(canonical)) {
        throw new Error('immutable canonical mismatch');
      }
      return existing;
    }
    transaction.create(itemRef, canonical);
    transaction.update(stateRef, {
      unreadCount: Math.max(0, Number.isSafeInteger(state.unreadCount) ? state.unreadCount : 0) + 1,
    });
    return canonical;
  });
}

export function createGetNotificationsHandler(
  db: NotificationsDatabase,
  boundedMaintenance: (uid: string) => Promise<unknown> = async () => undefined
): RequestHandler {
  return async (req, res) => {
    let uid: string | undefined;
    try {
      uid = await authorizeTeacher(db, res);
      if (!uid) return;

      const user = db.collection('users').doc(uid);
      const stateSnapshot = await user.collection('notificationState').doc('inbox').get();
      const state = stateSnapshot.exists ? stateSnapshot.data() || {} : {};
      const generation = Number.isSafeInteger(state.currentGeneration) ? state.currentGeneration : 0;
      const unreadCount = Number.isSafeInteger(state.unreadCount) && state.unreadCount >= 0 ? state.unreadCount : 0;
      const readBeforeMs = millis(state.readBefore);
      const suppliedCursor = req.query && req.query.cursor;
      const cursor = suppliedCursor === undefined ? undefined : decodeCursor(suppliedCursor);
      if (suppliedCursor !== undefined && !cursor) {
        sendError(res, 400, 'invalid cursor', 'El cursor de notificaciones no es válido.');
        return;
      }
      if (cursor && cursor.generation !== generation) {
        sendError(res, 409, 'stale_cursor', 'La bandeja cambió; actualizá la primera página.');
        return;
      }

      let query = user
        .collection('notificationGenerations')
        .doc(String(generation))
        .collection('items')
        .orderBy('eventOccurrenceAt', 'desc')
        .orderBy('createdAt', 'desc')
        .orderBy('__name__', 'desc');
      if (cursor) {
        query = query.startAfter(
          new Date(cursor.eventOccurrenceAtMs),
          new Date(cursor.createdAtMs),
          cursor.id
        );
      }
      const snapshot = await query.limit(PAGE_SIZE + 1).get();
      const hasMore = snapshot.docs.length > PAGE_SIZE;
      const page = snapshot.docs.slice(0, PAGE_SIZE);
      const last = page[page.length - 1];
      const lastData = last && last.data();
      const nextCursor = hasMore && last && lastData
        ? encodeCursor({
          generation,
          eventOccurrenceAtMs: millis(lastData.eventOccurrenceAt)!,
          createdAtMs: millis(lastData.createdAt)!,
          id: last.id,
        })
        : null;

      res.status(200).json({
        items: page.map(value => toResponse(value, readBeforeMs)),
        unreadCount,
        nextCursor,
        hasMore,
      });
      await boundedMaintenance(uid).catch(error => logOperationalFailure({
        event: 'notification_maintenance_failed', operation: 'GET /notifications', uid: uid!, error,
      }));
    } catch (error) {
      logOperationalFailure({ event: 'notification_lookup_failed', operation: 'GET /notifications', uid, error });
      sendError(res, 503, 'notification lookup failed', 'No se pudieron cargar las notificaciones.');
    }
  };
}
