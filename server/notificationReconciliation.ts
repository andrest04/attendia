import { RequestHandler } from 'express';
import { ingestReportFailureEpisodes, ReportFailureEpisodeClaim } from './attentionReports';
import { logOperationalFailure } from './operationalEvents';
import { canonicalNotificationId, userDocument } from './notifications';
import {
  CanonicalNotificationCandidate,
  Collection,
  Document,
  DocumentSnapshot,
  NotificationsDatabase,
  QueryDocumentSnapshot,
  Transaction,
} from './notificationsTypes';
import { authorizeTeacher } from './teacherAuthorization';

const ROOM_SID = /^RM[A-Za-z0-9]{32}$/;
const SOURCE_ID = /^[A-Za-z0-9_-]{8,128}$/;
const CLASS_ID = /^[A-Za-z0-9_-]{1,128}$/;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const CLASS_SWEEP_SIZE = 10;

type TrustedTimestamp = { toMillis(): number };

export interface RecordingNotificationSource {
  roomSid?: unknown;
  manualRequestId?: unknown;
  status?: unknown;
  statusChangedAt?: unknown;
  clientObservedAtMs?: unknown;
}

export interface ReportNotificationSource {
  reportId?: unknown;
  failureEpisodeId?: unknown;
  status?: unknown;
  observedAt?: unknown;
  firstFailedAtMs?: unknown;
}

// Shared shape for both "does this source need a notification" derivations below:
// deriveClassNotification and deriveReportNotification. Named for the domain-neutral
// concept (an intent to create and/or remove a canonical notification), not for
// either specific source kind.
export interface NotificationIntent {
  candidate?: CanonicalNotificationCandidate;
  removeEventKey?: string;
}

export interface ClassNotificationSource {
  classId?: unknown;
  status?: unknown;
  scheduledAt?: unknown;
  tombstoned?: boolean;
}

export function deriveClassNotification(
  source: ClassNotificationSource,
  nowMs: number
): NotificationIntent {
  if (typeof source.classId !== 'string' || !CLASS_ID.test(source.classId)) return {};
  const upcomingKey = `class:${source.classId}:upcoming`;
  if (source.tombstoned) return { removeEventKey: upcomingKey };
  if (source.status !== 'scheduled' || !isTrustedTimestamp(source.scheduledAt) || !Number.isFinite(nowMs)) return {};
  const scheduledAtMs = source.scheduledAt.toMillis();
  const upcomingAtMs = scheduledAtMs - FIFTEEN_MINUTES_MS;
  const notStartedAtMs = scheduledAtMs + FIFTEEN_MINUTES_MS;
  if (nowMs < upcomingAtMs) return {};
  const missed = nowMs >= notStartedAtMs;
  return {
    removeEventKey: missed ? upcomingKey : undefined,
    candidate: {
      eventType: missed ? 'class.not_started' : 'class.upcoming',
      eventKey: `class:${source.classId}:${missed ? 'not-started' : 'upcoming'}`,
      source: { kind: 'class', classId: source.classId },
      eventOccurrenceAt: new Date(missed ? notStartedAtMs : upcomingAtMs),
      title: missed ? 'Clase no iniciada' : 'Clase próxima',
      message: missed ? 'La clase programada todavía no fue iniciada.' : 'Tu clase comienza en 15 minutos.',
      destination: { kind: 'classes' },
    },
  };
}

function isTrustedTimestamp(value: unknown): value is TrustedTimestamp {
  if (!value || typeof (value as any).toMillis !== 'function') return false;
  try {
    return Number.isFinite((value as TrustedTimestamp).toMillis());
  } catch {
    return false;
  }
}

export function deriveRecordingNotification(
  source: RecordingNotificationSource
): CanonicalNotificationCandidate | null {
  if (
    typeof source.roomSid !== 'string' ||
    !ROOM_SID.test(source.roomSid) ||
    typeof source.manualRequestId !== 'string' ||
    !SOURCE_ID.test(source.manualRequestId) ||
    !isTrustedTimestamp(source.statusChangedAt)
  ) return null;

  const ready = source.status === 'completed';
  const failed = source.status === 'failed';
  if (!ready && !failed) return null;

  const suffix = ready ? 'ready' : 'failed';
  return {
    eventType: ready ? 'recording.ready' : 'recording.failed',
    eventKey: `recording:${source.manualRequestId}:${suffix}`,
    source: {
      kind: 'recording',
      roomSid: source.roomSid,
      manualRequestId: source.manualRequestId,
    },
    eventOccurrenceAt: source.statusChangedAt,
    title: ready ? 'Grabación lista' : 'Error al procesar la grabación',
    message: ready
      ? 'La grabación solicitada ya está disponible.'
      : 'No se pudo procesar la grabación solicitada.',
    destination: { kind: 'recording', roomSid: source.roomSid },
  };
}

export function deriveReportNotification(source: ReportNotificationSource): NotificationIntent {
  if (
    typeof source.reportId !== 'string' ||
    !ROOM_SID.test(source.reportId) ||
    typeof source.failureEpisodeId !== 'string' ||
    !SOURCE_ID.test(source.failureEpisodeId)
  ) return {};

  const eventKey = `report:${source.reportId}:save-failed:${source.failureEpisodeId}`;
  if (source.status === 'resolved') return { removeEventKey: eventKey };
  if (source.status !== 'unresolved' || !isTrustedTimestamp(source.observedAt)) return {};

  return {
    candidate: {
      eventType: 'report.save_failed',
      eventKey,
      source: {
        kind: 'report',
        reportId: source.reportId,
        failureEpisodeId: source.failureEpisodeId,
      },
      eventOccurrenceAt: source.observedAt,
      title: 'No se pudo guardar el reporte',
      message: 'El reporte sigue pendiente. Volvé a intentarlo desde el historial.',
      destination: { kind: 'report-retry', reportId: source.reportId },
    },
  };
}

const MAX_PENDING_REPORT_FAILURES = 25;
const FAILURE_CLAIM_ID = /^[A-Za-z0-9_-]{8,128}$/;
export type RefreshRecordingRequest = (
  uid: string,
  roomSid: string,
  manualRequestId: string
) => Promise<unknown>;

type SourceEntry = {
  kind: 'recording' | 'report' | 'class'; ref: Document; roomSid?: string; tombstoneRef?: Document;
  data: { [key: string]: any }; tombstoned?: boolean;
};

type DiscoveredSources = {
  recordingRefs: Array<{ ref: Document; roomSid: string }>;
  episodeRefs: Document[];
  classRefs: Array<{ ref: Document; tombstoneRef: Document }>;
};

function validClaims(value: unknown): value is ReportFailureEpisodeClaim[] {
  return Array.isArray(value) && value.length <= MAX_PENDING_REPORT_FAILURES && value.every((claim: any) =>
    claim && typeof claim.reportId === 'string' && ROOM_SID.test(claim.reportId) &&
    typeof claim.failureEpisodeId === 'string' && FAILURE_CLAIM_ID.test(claim.failureEpisodeId) &&
    typeof claim.firstFailedAtMs === 'number' && Number.isFinite(claim.firstFailedAtMs) && claim.firstFailedAtMs >= 0
  );
}

function valueMillis(value: any): number | null {
  const result = value instanceof Date ? value.getTime() : value && typeof value.toMillis === 'function' ? value.toMillis() : NaN;
  return Number.isFinite(result) ? result : null;
}

function effectivelyUnread(item: any, readBefore: any): boolean {
  const createdAt = valueMillis(item.createdAt);
  const boundary = valueMillis(readBefore);
  return valueMillis(item.readAt) === null && !(boundary !== null && createdAt !== null && createdAt <= boundary);
}

async function discoverSources(db: NotificationsDatabase, uid: string, includeAll: boolean): Promise<DiscoveredSources> {
  const user = userDocument(db, uid);
  const reports = await user.collection('reports').get();
  const recordingRefs: Array<{ ref: Document; roomSid: string }> = [];
  for (const report of reports.docs) {
    const requests = await report.ref.collection('recordingRequests').get();
    requests.docs.forEach(request => recordingRefs.push({ ref: request.ref, roomSid: report.id }));
  }
  const episodes = includeAll ? await user.collection('reportFailureEpisodes').get() : { docs: [] as QueryDocumentSnapshot[] };
  const classes = includeAll ? await user.collection('classes').get() : { docs: [] as QueryDocumentSnapshot[] };
  return {
    recordingRefs,
    episodeRefs: episodes.docs.map(doc => doc.ref),
    classRefs: classes.docs.map(doc => ({
      ref: doc.ref, tombstoneRef: user.collection('classOccurrenceTombstones').doc(doc.id),
    })),
  };
}

// One recording's provider fetch failing (e.g. a transient Twilio API error) must
// not prevent unrelated report/class reconciliation from running in the same poll
// (see US "one failing source blocks reconciliation of all others"). Each item is
// isolated in its own try/catch: a failure here just means that recording's status
// stays stale for this pass — reconcileSources() only turns a completed/failed
// status into a notification, so leaving the pre-refresh (still-pending) status in
// place is safe and simply gets retried on the next poll. Nothing is trusted to be
// terminal without a successful, freshly-fetched provider response.
async function refreshPendingRecordingSources(
  refs: Array<{ ref: Document; roomSid: string }>,
  uid: string,
  refreshRecordingRequest: RefreshRecordingRequest
): Promise<void> {
  for (const source of refs) {
    const snapshot = await source.ref.get();
    const request = snapshot.exists ? snapshot.data() || {} : {};
    const pending = request.status === 'enqueued' || request.status === 'processing';
    if (
      pending &&
      !request.statusChangedAt &&
      typeof request.compositionSid === 'string' &&
      typeof request.manualRequestId === 'string' &&
      SOURCE_ID.test(request.manualRequestId)
    ) {
      try {
        await refreshRecordingRequest(uid, source.roomSid, request.manualRequestId);
      } catch (error) {
        logOperationalFailure({
          event: 'notification_recording_refresh_failed',
          operation: 'POST /notifications/reconcile',
          uid,
          roomSid: source.roomSid,
          error,
        });
      }
    }
  }
}

// Read-only: pages the "class.upcoming" items in the current generation and
// determines which of them belong to a class that no longer exists or was
// tombstoned (moved/cancelled), so they can be swept away as stale.
async function sweepRetiredClassItems(
  transaction: Transaction,
  user: Document,
  items: Collection,
  classSweepAfter: unknown,
  includeAll: boolean
): Promise<{ removals: Array<{ ref: Document; snapshot: DocumentSnapshot }>; classSweepAfter: unknown }> {
  if (!includeAll) return { removals: [], classSweepAfter };

  let query = items.where('eventType', '==', 'class.upcoming').orderBy('notificationId', 'asc');
  if (classSweepAfter) query = query.startAfter(classSweepAfter);
  const sweepSnapshot = await transaction.get(query.limit(CLASS_SWEEP_SIZE + 1));
  const sweepItems = sweepSnapshot.docs.slice(0, CLASS_SWEEP_SIZE);
  const nextClassSweepAfter = sweepSnapshot.docs.length > CLASS_SWEEP_SIZE && sweepItems.length
    ? (sweepItems[sweepItems.length - 1].data() || {}).notificationId || sweepItems[sweepItems.length - 1].id
    : null;

  const removals: Array<{ ref: Document; snapshot: DocumentSnapshot }> = [];
  for (const item of sweepItems) {
    const data = item.data() || {};
    const classId = data.source && data.source.classId;
    if (typeof classId !== 'string' || !CLASS_ID.test(classId)) continue;
    const sourceSnapshot = await transaction.get(user.collection('classes').doc(classId));
    const tombstoneSnapshot = await transaction.get(user.collection('classOccurrenceTombstones').doc(classId));
    if (!sourceSnapshot.exists || tombstoneSnapshot.exists) {
      removals.push({ ref: item.ref, snapshot: item });
    }
  }
  return { removals, classSweepAfter: nextClassSweepAfter };
}

// Read-only: fetches the current data for every recording/report/class source and
// derives each one's notification intent (create and/or remove a canonical item).
async function collectSourceIntents(
  transaction: Transaction,
  refs: DiscoveredSources,
  nowMs: number
): Promise<NotificationIntent[]> {
  const sourceEntries: SourceEntry[] = [];
  for (const source of refs.recordingRefs) {
    const snapshot = await transaction.get(source.ref);
    if (snapshot.exists) sourceEntries.push({ kind: 'recording', ...source, data: snapshot.data() || {} });
  }
  for (const ref of refs.episodeRefs) {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists) sourceEntries.push({ kind: 'report', ref, data: snapshot.data() || {} });
  }
  for (const source of refs.classRefs) {
    const snapshot = await transaction.get(source.ref);
    const tombstone = await transaction.get(source.tombstoneRef);
    if (snapshot.exists) sourceEntries.push({
      kind: 'class', ...source, data: snapshot.data() || {}, tombstoned: tombstone.exists,
    });
  }

  return sourceEntries.map(entry => {
    if (entry.kind === 'recording') {
      return { candidate: deriveRecordingNotification({ ...entry.data, roomSid: entry.roomSid }) || undefined };
    }
    if (entry.kind === 'report') return deriveReportNotification(entry.data);
    return deriveClassNotification({ ...entry.data, classId: entry.ref.id, tombstoned: entry.tombstoned }, nowMs);
  });
}

type ItemEntry = {
  ref: Document; snapshot: DocumentSnapshot; remove: boolean; candidate?: CanonicalNotificationCandidate;
};

// Read-only: turns the swept removals and the derived intents into the concrete
// item refs/snapshots that the write phase (applyItemEntries) will act on.
async function readItemEntries(
  transaction: Transaction,
  user: Document,
  generation: number,
  sweepRemovals: Array<{ ref: Document; snapshot: DocumentSnapshot }>,
  intents: NotificationIntent[]
): Promise<ItemEntry[]> {
  const itemEntries: ItemEntry[] = sweepRemovals.map(entry => ({ ref: entry.ref, snapshot: entry.snapshot, remove: true }));
  for (const intent of intents) {
    if (intent.removeEventKey) {
      const eventType = intent.removeEventKey.startsWith('class:') ? 'class.upcoming' : 'report.save_failed';
      const id = canonicalNotificationId(eventType, intent.removeEventKey);
      const ref = user.collection('notificationGenerations').doc(String(generation)).collection('items').doc(id);
      itemEntries.push({ ref, snapshot: await transaction.get(ref), remove: true });
    }
    if (intent.candidate) {
      const id = canonicalNotificationId(intent.candidate.eventType, intent.candidate.eventKey);
      const ref = user.collection('notificationGenerations').doc(String(generation)).collection('items').doc(id);
      itemEntries.push({ ref, snapshot: await transaction.get(ref), remove: false, candidate: intent.candidate });
    }
  }
  return itemEntries;
}

// Write phase: deletes the removal entries and creates the still-relevant
// candidates, tracking the resulting unread count and whether anything changed.
function applyItemEntries(
  transaction: Transaction,
  itemEntries: ItemEntry[],
  uid: string,
  state: { [key: string]: any },
  createdAt: () => unknown
): { unreadCount: number; changed: boolean } {
  let unreadCount = Number.isSafeInteger(state.unreadCount) ? Math.max(0, state.unreadCount) : 0;
  let changed = false;
  const removed = new Set<string>();
  for (const entry of itemEntries.filter(value => value.remove)) {
    if (!entry.snapshot.exists || removed.has(entry.ref.id)) continue;
    removed.add(entry.ref.id);
    if (effectivelyUnread(entry.snapshot.data() || {}, state.readBefore)) unreadCount--;
    transaction.delete(entry.ref);
    changed = true;
  }
  for (const entry of itemEntries.filter(value => value.candidate)) {
    const candidate = entry.candidate!;
    const occurrence = valueMillis(candidate.eventOccurrenceAt);
    const clearBefore = valueMillis(state.clearBefore);
    if (entry.snapshot.exists || occurrence === null || (clearBefore !== null && occurrence <= clearBefore)) continue;
    transaction.create(entry.ref, {
      notificationId: entry.ref.id, ownerUid: uid, ...candidate, createdAt: createdAt(), readAt: null,
    });
    unreadCount++;
    changed = true;
  }
  return { unreadCount: Math.max(0, unreadCount), changed };
}

// Write phase: persists the inbox state document's unread count / class-sweep
// cursor, matching the original update-vs-create branching exactly.
function writeInboxState(
  transaction: Transaction,
  stateRef: Document,
  stateSnapshot: DocumentSnapshot,
  generation: number,
  count: number,
  changed: boolean,
  classSweepAfter: unknown,
  includeAll: boolean,
  sweepChanged: boolean,
  createdAt: () => unknown
): void {
  if (!(changed || sweepChanged)) return;
  if (stateSnapshot.exists) {
    transaction.update(stateRef, {
      ...(changed ? { unreadCount: count } : {}),
      ...(includeAll ? { classSweepAfter } : {}),
    });
  } else {
    transaction.create(stateRef, {
      currentGeneration: generation, clearBefore: null, readBefore: null, unreadCount: count,
      classSweepAfter, updatedAt: createdAt(),
    });
  }
}

async function reconcileSources(
  db: NotificationsDatabase,
  uid: string,
  includeAll: boolean,
  createdAt: () => unknown,
  now: () => number
): Promise<{ unreadCount: number; changed: boolean }> {
  const refs = await discoverSources(db, uid, includeAll);
  const nowMs = now();
  return db.runTransaction(async transaction => {
    const user = userDocument(db, uid);
    const stateRef = user.collection('notificationState').doc('inbox');
    const stateSnapshot = await transaction.get(stateRef);
    const state = stateSnapshot.exists ? stateSnapshot.data() || {} : {};
    const generation = Number.isSafeInteger(state.currentGeneration) ? state.currentGeneration : 0;
    const items = user.collection('notificationGenerations').doc(String(generation)).collection('items');

    // Read phase: every read below must happen before any write (transaction
    // safety — see notificationReconciliation.test.ts's "reads every source/item
    // before writes" assertion).
    const { removals, classSweepAfter } = await sweepRetiredClassItems(
      transaction, user, items, state.classSweepAfter || null, includeAll
    );
    const intents = await collectSourceIntents(transaction, refs, nowMs);
    const itemEntries = await readItemEntries(transaction, user, generation, removals, intents);

    // Write phase.
    const { unreadCount: count, changed } = applyItemEntries(transaction, itemEntries, uid, state, createdAt);
    const sweepChanged = includeAll && classSweepAfter !== (state.classSweepAfter || null);
    writeInboxState(transaction, stateRef, stateSnapshot, generation, count, changed, classSweepAfter, includeAll, sweepChanged, createdAt);

    return { unreadCount: count, changed };
  });
}

export function createReconcileNotificationsHandler(
  db: NotificationsDatabase,
  serverTimestamp: () => unknown,
  boundedMaintenance: (uid: string) => Promise<unknown> = async () => undefined,
  now: () => number = Date.now,
  refreshRecordingRequest: RefreshRecordingRequest = async () => undefined
): RequestHandler {
  return async (req, res) => {
    let uid: string | undefined;
    try {
      uid = await authorizeTeacher(db, res);
      if (!uid) return;
      const body = req.body || {};
      if (body.scope !== 'all' && body.scope !== 'recordings') {
        res.status(400).json({ error: { message: 'invalid reconciliation scope', explanation: 'El alcance no es válido.' } });
        return;
      }
      const claims = body.pendingReportFailures === undefined ? [] : body.pendingReportFailures;
      if (!validClaims(claims)) {
        res.status(400).json({ error: { message: 'invalid report failure claims', explanation: 'Los errores pendientes no son válidos.' } });
        return;
      }
      if (body.scope === 'all' && claims.length) {
        // notificationReconciliation.ts's typed NotificationsDatabase (Transaction
        // returning void from create/update/delete) is structurally incompatible with
        // attentionReports.ts's ReportsDatabase (chainable ReportTransaction, plus
        // direct set()/update() on ReportDocumentReference) — the two modules model
        // the same real Firestore surface with independently-evolved, narrower slices.
        // Unifying them would mean widening notifications.ts's Transaction/Document
        // contracts to satisfy a chainable API unrelated to anything notifications.ts
        // itself needs, which is out of proportion for this SUGGESTION-level, type-only
        // cleanup. Scoped intentionally to this one cross-module call.
        await ingestReportFailureEpisodes(db as any, uid, claims, serverTimestamp);
      }
      const sources = await discoverSources(db, uid, body.scope === 'all');
      await refreshPendingRecordingSources(sources.recordingRefs, uid, refreshRecordingRequest);
      const result = await reconcileSources(db, uid, body.scope === 'all', serverTimestamp, now);
      res.status(200).json(result);
      await boundedMaintenance(uid).catch(error => logOperationalFailure({
        event: 'notification_maintenance_failed', operation: 'POST /notifications/reconcile', uid: uid!, error,
      }));
    } catch (error) {
      logOperationalFailure({ event: 'notification_reconcile_failed', operation: 'POST /notifications/reconcile', uid, error });
      res.status(503).json({ error: { message: 'notification reconciliation failed', explanation: 'No se pudieron actualizar las notificaciones.' } });
    }
  };
}
