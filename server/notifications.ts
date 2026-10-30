import { createHash } from 'crypto';
import { RequestHandler } from 'express';
import { decodeBase64Url, encodeBase64Url } from './base64url';
import { timestampMillis } from './firestoreTime';
import { ExpressResponse, HttpError, sendBadRequest, sendError } from './http';
import { inboxGeneration, inboxUnreadCount } from './notificationInbox';
import { logOperationalFailure } from './operationalEvents';
import { localizeNotificationCopy } from './notificationCopy';
import { resolveLocale } from './locale';
import { teacherHandler } from './teacherHandler';
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

/**
 * One entry per notification source kind. Adding a kind means adding ONE entry here
 * (plus its key patterns above and its derive function in notificationReconciliation.ts),
 * instead of editing parallel `startsWith(...)` branches scattered across both modules.
 */
interface NotificationKind {
  /** Both the `eventKey` prefix (`class:…`) and the source's `kind` discriminator. */
  name: 'class' | 'recording' | 'report';
  eventTypes: EventType[];
  /**
   * The event type a bare "remove this key" intent refers to. Only kinds whose items can
   * be retracted by key have one (an upcoming class, a failed report save).
   */
  removalEventType?: EventType;
  /** Whether the stored `source` really belongs to the key it is filed under. */
  validateSource(source: any, keyParts: string[]): boolean;
}

const NOTIFICATION_KINDS: NotificationKind[] = [
  {
    name: 'class',
    eventTypes: ['class.upcoming', 'class.not_started'],
    removalEventType: 'class.upcoming',
    validateSource: (source, parts) => source.kind === 'class' && source.classId === parts[1],
  },
  {
    name: 'recording',
    eventTypes: ['recording.ready', 'recording.failed'],
    validateSource: (source, parts) =>
      source.kind === 'recording' && source.manualRequestId === parts[1] &&
      typeof source.roomSid === 'string' && source.roomSid.length > 0,
  },
  {
    name: 'report',
    eventTypes: ['report.save_failed'],
    removalEventType: 'report.save_failed',
    validateSource: (source, parts) =>
      source.kind === 'report' && source.reportId === parts[1] && source.failureEpisodeId === parts[4],
  },
];

function validateCanonicalSource(candidate: CanonicalNotificationCandidate) {
  const kind = NOTIFICATION_KINDS.find(value => value.eventTypes.indexOf(candidate.eventType) !== -1);
  if (!kind || !kind.validateSource(candidate.source as any, candidate.eventKey.split(':'))) {
    throw new Error('invalid canonical source');
  }
}

/** The event type behind a bare removal key such as `class:abc:upcoming`. */
export function removalEventTypeForKey(eventKey: string): EventType {
  const kind = NOTIFICATION_KINDS.find(value => value.name === eventKey.split(':')[0]);
  if (!kind || !kind.removalEventType) throw new Error('invalid canonical event key');
  return kind.removalEventType;
}

function decodeCursor(value: unknown): Cursor | undefined {
  if (typeof value !== 'string' || !value || value.length > 1024) return undefined;
  try {
    const parsed = JSON.parse(decodeBase64Url(value).toString('utf8'));
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
  return encodeBase64Url(JSON.stringify(cursor));
}

function toResponse(snapshot: Snapshot, readBeforeMs: number | null, locale: ReturnType<typeof resolveLocale> = 'es') {
  const data = snapshot.data() || {};
  const createdAtMs = timestampMillis(data.createdAt);
  const explicitReadAtMs = timestampMillis(data.readAt);
  const effectivelyRead = explicitReadAtMs !== null || (
    readBeforeMs !== null && createdAtMs !== null && createdAtMs <= readBeforeMs
  );
  const copy = localizeNotificationCopy(locale, data);
  return {
    notificationId: snapshot.id,
    ownerUid: data.ownerUid,
    eventType: data.eventType,
    eventKey: data.eventKey,
    source: data.source,
    eventOccurrenceAtMs: timestampMillis(data.eventOccurrenceAt),
    createdAtMs,
    readAtMs: explicitReadAtMs === null && effectivelyRead ? readBeforeMs : explicitReadAtMs,
    title: copy.title,
    message: copy.message,
    destination: data.destination,
  };
}

const TEACHER_ONLY_EXPLANATION = 'Las notificaciones solo están disponibles para profesores.';

// The bounded maintenance tail call runs only AFTER a successful response, and its own
// failure is logged but never surfaced to the client.
const runBoundedMaintenance = (
  boundedMaintenance: (uid: string) => Promise<unknown>,
  operation: string,
  uid: string
): Promise<void> =>
  boundedMaintenance(uid).then(
    () => undefined,
    error => logOperationalFailure({ event: 'notification_maintenance_failed', operation, uid, error })
  );

// Maps a typed HttpError (a duplicate idempotency key → 409, an unknown notification →
// 404) to that endpoint's own response; anything else falls through to the generic 503.
const mapHttpError = (status: number, message: string, explanation: string) => (
  error: unknown,
  res: ExpressResponse
): boolean => {
  if (!HttpError.is(error, status)) return false;
  sendError(res, status, message, explanation);
  return true;
};

function requireIdempotencyKey(
  req: Parameters<RequestHandler>[0],
  res: ExpressResponse
): string | undefined {
  const header = req.headers && req.headers['idempotency-key'];
  const idempotencyKey = Array.isArray(header) ? undefined : header;
  if (typeof idempotencyKey !== 'string' || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
    sendBadRequest(res, 'invalid idempotency key', 'La clave de idempotencia no es válida.');
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
        throw HttpError.conflict('idempotency key conflict');
      }
      return;
    }
    const stateRef = stateDocument(db, uid);
    const stateSnapshot = await transaction.get(stateRef);
    const state = stateSnapshot.exists ? stateSnapshot.data() || {} : {};
    const generation = inboxGeneration(state);
    const { acceptedAt, response } = await applyMutation(transaction, stateRef, stateSnapshot, generation);
    transaction.create(receiptRef, { kind, acceptedAt, generation, response });
  });

  const receipt = (await receiptRef.get()).data() || {};
  const acceptedAtMs = timestampMillis(receipt.acceptedAt);
  if (receipt.kind !== kind || acceptedAtMs === null) throw new Error(notCommittedMessage);
  return { acceptedAtMs, response: receipt.response };
}

const IDEMPOTENCY_CONFLICT = mapHttpError(409, 'idempotency key conflict', 'La clave ya fue usada para otra operación.');

export function createClearNotificationsHandler(
  db: NotificationsDatabase,
  serverTimestamp: () => unknown,
  boundedMaintenance: (uid: string) => Promise<unknown> = async () => undefined
): RequestHandler {
  return teacherHandler(
    db,
    {
      forbiddenExplanation: TEACHER_ONLY_EXPLANATION,
      failure: {
        event: 'notification_clear_failed',
        operation: 'DELETE /notifications',
        message: 'notification clear failed',
        explanation: 'No se pudieron vaciar las notificaciones.',
      },
      mapError: IDEMPOTENCY_CONFLICT,
    },
    async ({ uid, req, res }) => {
      const idempotencyKey = requireIdempotencyKey(req, res);
      if (!idempotencyKey) return;

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
      await runBoundedMaintenance(boundedMaintenance, 'DELETE /notifications', uid);
    }
  );
}

export function createMarkAllNotificationsReadHandler(
  db: NotificationsDatabase,
  serverTimestamp: () => unknown,
  boundedMaintenance: (uid: string) => Promise<unknown> = async () => undefined
): RequestHandler {
  return teacherHandler(
    db,
    {
      forbiddenExplanation: TEACHER_ONLY_EXPLANATION,
      failure: {
        event: 'notification_mark_all_failed',
        operation: 'POST /notifications/mark-all-read',
        message: 'notification mark-all failed',
        explanation: 'No se pudieron marcar las notificaciones como leídas.',
      },
      mapError: IDEMPOTENCY_CONFLICT,
    },
    async ({ uid, req, res }) => {
      const idempotencyKey = requireIdempotencyKey(req, res);
      if (!idempotencyKey) return;

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
      await runBoundedMaintenance(boundedMaintenance, 'POST /notifications/mark-all-read', uid);
    }
  );
}

export function createPatchNotificationReadHandler(
  db: NotificationsDatabase,
  serverTimestamp: () => unknown,
  boundedMaintenance: (uid: string) => Promise<unknown> = async () => undefined
): RequestHandler {
  return teacherHandler(
    db,
    {
      forbiddenExplanation: TEACHER_ONLY_EXPLANATION,
      failure: {
        event: 'notification_read_failed',
        operation: 'PATCH /notifications/:id/read',
        message: 'notification read failed',
        explanation: 'No se pudo marcar la notificación como leída.',
      },
      mapError: mapHttpError(404, 'notification not found', 'La notificación no existe en la bandeja actual.'),
    },
    async ({ uid, req, res }) => {
      const id = req.params && req.params.id;
      if (typeof id !== 'string' || !NOTIFICATION_ID.test(id)) {
        sendBadRequest(res, 'invalid notification id', 'La notificación no es válida.');
        return;
      }

      await db.runTransaction(async transaction => {
        const stateRef = stateDocument(db, uid);
        const stateSnapshot = await transaction.get(stateRef);
        const state = stateSnapshot.exists ? stateSnapshot.data() || {} : {};
        const generation = inboxGeneration(state);
        const itemRef = itemDocument(db, uid, generation, id);
        const itemSnapshot = await transaction.get(itemRef);
        if (!itemSnapshot.exists || (itemSnapshot.data() || {}).ownerUid !== uid) {
          throw HttpError.notFound('notification not found');
        }
        const item = itemSnapshot.data() || {};
        const readBeforeMs = timestampMillis(state.readBefore);
        const effectivelyRead = timestampMillis(item.readAt) !== null || (
          readBeforeMs !== null && timestampMillis(item.createdAt) !== null && timestampMillis(item.createdAt)! <= readBeforeMs
        );
        if (!effectivelyRead) {
          transaction.update(itemRef, { readAt: serverTimestamp() });
          transaction.update(stateRef, { unreadCount: Math.max(0, inboxUnreadCount(state) - 1) });
        }
      });

      const committedState = (await stateDocument(db, uid).get()).data() || {};
      const committedItem = await itemDocument(db, uid, inboxGeneration(committedState), id).get();
      if (!committedItem.exists) {
        throw HttpError.notFound('notification not found');
      }
      res.status(200).json({
        notification: toResponse(
          { id, data: () => committedItem.data() },
          timestampMillis(committedState.readBefore),
          resolveLocale(req)
        ),
        unreadCount: inboxUnreadCount(committedState),
      });
      await runBoundedMaintenance(boundedMaintenance, 'PATCH /notifications/:id/read', uid);
    }
  );
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
    eventOccurrenceAtMs: timestampMillis(value.eventOccurrenceAt),
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
    const generation = inboxGeneration(state);
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
      unreadCount: Math.max(0, inboxUnreadCount(state)) + 1,
    });
    return canonical;
  });
}

export function createGetNotificationsHandler(
  db: NotificationsDatabase,
  boundedMaintenance: (uid: string) => Promise<unknown> = async () => undefined
): RequestHandler {
  return teacherHandler(
    db,
    {
      forbiddenExplanation: TEACHER_ONLY_EXPLANATION,
      failure: {
        event: 'notification_lookup_failed',
        operation: 'GET /notifications',
        message: 'notification lookup failed',
        explanation: 'No se pudieron cargar las notificaciones.',
      },
    },
    async ({ uid, req, res }) => {
      const user = db.collection('users').doc(uid);
      const stateSnapshot = await user.collection('notificationState').doc('inbox').get();
      const state = stateSnapshot.exists ? stateSnapshot.data() || {} : {};
      const generation = inboxGeneration(state);
      const unreadCount = Math.max(0, inboxUnreadCount(state));
      const readBeforeMs = timestampMillis(state.readBefore);
      const suppliedCursor = req.query && req.query.cursor;
      const cursor = suppliedCursor === undefined ? undefined : decodeCursor(suppliedCursor);
      if (suppliedCursor !== undefined && !cursor) {
        sendBadRequest(res, 'invalid cursor', 'El cursor de notificaciones no es válido.');
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
          eventOccurrenceAtMs: timestampMillis(lastData.eventOccurrenceAt)!,
          createdAtMs: timestampMillis(lastData.createdAt)!,
          id: last.id,
        })
        : null;

      res.status(200).json({
        items: page.map(value => toResponse(value, readBeforeMs, resolveLocale(req))),
        unreadCount,
        nextCursor,
        hasMore,
      });
      await runBoundedMaintenance(boundedMaintenance, 'GET /notifications', uid);
    }
  );
}
