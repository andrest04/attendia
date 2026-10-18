import { RequestHandler } from 'express';
import { HttpError, sendBadRequest, sendError } from './http';
import { ROOM_SID_PATTERN } from './ids';
import { canonicalNotificationId } from './notifications';
import { readInbox, readInboxItems, retractInboxItems } from './notificationInbox';
import { RoomSessionBinder } from './roomOwnership';
import { teacherHandler } from './teacherHandler';

/*
 * Firestore-backed per-class attention reports:
 * users/{uid}/reports/{roomSid} = the professor's attention-report snapshot,
 * written when the professor ends or leaves a class session.
 *
 * Teacher enforcement happens HERE, server-side: both handlers read users/{uid}
 * (written by userProfiles.ts) with the uid from the VERIFIED ID token and require
 * role === 'teacher' — nothing the browser sends is trusted. The roomSid doubles as
 * the dedup key: a partial "left" save is overwritten wholesale by the final save.
 *
 * Both endpoints assume firebaseAuthMiddleware already ran and attached the decoded
 * token to res.locals.firebaseUser. Like userProfiles.ts, this module is a leaf with
 * zero firebase-admin imports: the structural interfaces below are satisfied by the
 * real admin Firestore instance and are trivially mockable in tests.
 */

const VALID_END_REASONS = ['ended-for-all', 'left'];

// Defensive caps on incoming arrays — the client-side producers already cap far
// lower (alerts ≤3), so anything above these is a malformed payload.
// Mirrors src/components/AttentionReport/reportMath.ts MAX_REPORT_TIMELINE_POINTS
// structurally (not by import — server and client build separately): 3h @ 1Hz,
// full per-second resolution for any realistic class length.
const MAX_TIMELINE_POINTS = 10800;
const MAX_PARTICIPANTS = 200;
const MAX_ALERTS = 10;

// Max reports returned by GET /reports (newest first).
const MAX_REPORTS_RETURNED = 50;
const MAX_FAILURE_EPISODE_CLAIMS = 20;
const FAILURE_EPISODE_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export interface ReportFailureEpisodeClaim {
  reportId: string;
  failureEpisodeId: string;
  firstFailedAtMs: number;
}

// ─── Structural Firestore slice ────────────────────────────────────────────────
// Minimal surface used below; the real firebase-admin Firestore satisfies all of
// these structurally (same pattern as ProfileDatabase in userProfiles.ts).

export interface ReportDocumentSnapshot {
  id: string;
  exists?: boolean;
  data(): { [key: string]: any } | undefined;
}

export interface ReportQuerySnapshot {
  docs: ReportDocumentSnapshot[];
}

export interface ReportsQuery {
  get(): Promise<ReportQuerySnapshot>;
}

export interface ReportDocumentReference {
  set(data: { [key: string]: any }): Promise<unknown>;
  get(): Promise<ReportDocumentSnapshot>;
  update(data: { [key: string]: any }): Promise<unknown>;
  collection(name: string): ReportsCollection;
}

export interface ReportTransaction {
  get(reference: ReportDocumentReference): Promise<ReportDocumentSnapshot>;
  set(reference: ReportDocumentReference, data: { [key: string]: any }, options?: { merge: boolean }): ReportTransaction;
  update(reference: ReportDocumentReference, data: { [key: string]: any }): ReportTransaction;
  delete(reference: ReportDocumentReference): ReportTransaction;
}

export interface ReportsCollection {
  doc(id: string): ReportDocumentReference;
  orderBy(field: string, direction: 'asc' | 'desc'): { limit(n: number): ReportsQuery };
}

export interface UserDocumentSnapshot {
  exists: boolean;
  data(): { [key: string]: any } | undefined;
}

export interface UserDocumentReference {
  get(): Promise<UserDocumentSnapshot>;
  collection(name: string): ReportsCollection;
}

export interface ReportsDatabase {
  collection(name: string): { doc(id: string): UserDocumentReference };
  runTransaction<T>(updateFunction: (transaction: ReportTransaction) => Promise<T>): Promise<T>;
}

const TEACHER_ONLY_EXPLANATION = 'El historial de clases solo está disponible para profesores.';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !isNaN(new Date(value).getTime());
}

function isValidFailureEpisodeId(value: unknown): value is string {
  return typeof value === 'string' && FAILURE_EPISODE_ID_PATTERN.test(value);
}

function isValidFailureClaim(value: ReportFailureEpisodeClaim): boolean {
  return !!value && ROOM_SID_PATTERN.test(value.reportId) && isValidFailureEpisodeId(value.failureEpisodeId) &&
    isFiniteNumber(value.firstFailedAtMs) && value.firstFailedAtMs >= 0;
}

/** Persists bounded browser claims without allowing browser time to become authority. */
export async function ingestReportFailureEpisodes(
  db: ReportsDatabase,
  uid: string,
  claims: ReportFailureEpisodeClaim[],
  serverTimestamp: () => unknown
): Promise<void> {
  if (claims.length > MAX_FAILURE_EPISODE_CLAIMS) throw new Error('too many report failure claims');
  if (!claims.every(isValidFailureClaim)) throw new Error('invalid report failure claim');

  const episodes = db.collection('users').doc(uid).collection('reportFailureEpisodes');
  await db.runTransaction(async transaction => {
    const entries = claims.map(claim => ({ claim, ref: episodes.doc(claim.failureEpisodeId), snapshot: undefined as any }));
    for (const entry of entries) entry.snapshot = await transaction.get(entry.ref);
    for (const { claim, ref, snapshot } of entries) {
      if (!snapshot.data()) {
        transaction.set(ref, {
          reportId: claim.reportId,
          failureEpisodeId: claim.failureEpisodeId,
          status: 'unresolved',
          observedAt: serverTimestamp(),
        });
      }
    }
  });
}

/**
 * Validates and sanitizes the incoming report body. Returns the whitelisted
 * payload ready for Firestore, or an error message pair. Only known fields are
 * copied through — the client can never smuggle extra keys into the document.
 */
function sanitizeReportBody(body: {
  [key: string]: any;
}): { report?: { [key: string]: any }; error?: { message: string; explanation: string } } {
  const roomSid = body.roomSid;
  if (typeof roomSid !== 'string' || !ROOM_SID_PATTERN.test(roomSid)) {
    return { error: { message: 'invalid roomSid', explanation: 'El identificador de la sala no es válido.' } };
  }

  const roomName = typeof body.roomName === 'string' ? body.roomName.trim() : '';
  if (!roomName) {
    return { error: { message: 'invalid roomName', explanation: 'El nombre de la sala no puede estar vacío.' } };
  }

  if (!VALID_END_REASONS.includes(body.endReason)) {
    return { error: { message: 'invalid endReason', explanation: 'El motivo de cierre de la sesión no es válido.' } };
  }

  const timeline = body.timeline;
  if (!Array.isArray(timeline) || timeline.length > MAX_TIMELINE_POINTS) {
    return { error: { message: 'invalid timeline', explanation: 'La línea de tiempo del reporte no es válida.' } };
  }

  const participants = body.participants;
  if (!Array.isArray(participants) || participants.length > MAX_PARTICIPANTS) {
    return { error: { message: 'invalid participants', explanation: 'El detalle de estudiantes no es válido.' } };
  }

  const proctoringAlerts = body.proctoringAlerts;
  if (!Array.isArray(proctoringAlerts) || proctoringAlerts.length > MAX_ALERTS) {
    return { error: { message: 'invalid proctoringAlerts', explanation: 'Las alertas del reporte no son válidas.' } };
  }

  // Light guards on the numeric summary fields — a malformed payload becomes a 400
  // instead of a NaN-poisoned document.
  const numericFields = ['studentCount', 'attentionThreshold', 'groupAverage', 'percentAboveThreshold', 'durationMs'];
  for (const field of numericFields) {
    if (!isFiniteNumber(body[field])) {
      return { error: { message: `invalid ${field}`, explanation: 'Las métricas del reporte no son válidas.' } };
    }
  }
  if (body.durationMs < 0) {
    return { error: { message: 'invalid durationMs', explanation: 'La duración del reporte no es válida.' } };
  }
  if (!isValidIsoDate(body.startedAtIso) || !isValidIsoDate(body.endedAtIso)) {
    return { error: { message: 'invalid session time', explanation: 'Las fechas de la sesión no son válidas.' } };
  }
  if (new Date(body.startedAtIso).getTime() > new Date(body.endedAtIso).getTime()) {
    return { error: { message: 'invalid session time', explanation: 'Las fechas de la sesión no son válidas.' } };
  }
  if (body.classId !== undefined && (typeof body.classId !== 'string' || body.classId.trim().length === 0)) {
    return { error: { message: 'invalid classId', explanation: 'La clase asociada no es válida.' } };
  }

  // Only the fields listed below ever reach Firestore — this is a whitelist by
  // construction. In particular `recording` (the Twilio Composition artifact status)
  // is deliberately absent: it is server-derived only (see recordings.ts) and a
  // client-supplied value here is silently dropped, never persisted.
  return {
    report: {
      roomSid,
      roomName,
      // Omit the key entirely rather than setting it to `undefined` — the
      // Firestore Admin SDK rejects `undefined` field values outright, and
      // this branch is hit on every ad-hoc (non-scheduled-class) session.
      ...(typeof body.classId === 'string' && body.classId.trim() ? { classId: body.classId.trim() } : {}),
      endReason: body.endReason,
      source: body.source === 'live' ? 'live' : 'mock',
      studentCount: body.studentCount,
      attentionThreshold: body.attentionThreshold,
      ranges: body.ranges,
      groupAverage: body.groupAverage,
      percentAboveThreshold: body.percentAboveThreshold,
      timeline,
      participants,
      proctoringAlerts,
      endedAtIso: body.endedAtIso,
      startedAtIso: body.startedAtIso,
      durationMs: body.durationMs,
      recordingWasActiveAtEnd: body.recordingWasActiveAtEnd === true,
    },
  };
}

// Fail-closed default: without a wired binder (see server/index.ts) no report can be saved.
const unconfiguredSessionBinder: RoomSessionBinder = () =>
  Promise.reject(new Error('room session binder is not configured'));

/**
 * `bindSession` (roomOwnership.ts createRoomSessionBinder) ties the report's roomSid to
 * the verified teacher before anything is written: the session must be theirs, its
 * Twilio unique name must be the report's roomName, and they must own that room.
 */
export function createPostReportHandler(
  db: ReportsDatabase,
  serverTimestamp: () => unknown,
  bindSession: RoomSessionBinder = unconfiguredSessionBinder
): RequestHandler {
  return teacherHandler(
    db,
    {
      forbiddenExplanation: TEACHER_ONLY_EXPLANATION,
      failure: {
        event: 'report_save_failed',
        operation: 'POST /reports',
        message: 'report save failed',
        explanation: 'No pudimos guardar el reporte de la clase. Intenta de nuevo en unos segundos.',
      },
      mapError: (error, res) => {
        if (!HttpError.is(error, 400)) return false;
        sendBadRequest(res, 'class relation mismatch', 'La clase asociada no corresponde a la sala de la sesión.');
        return true;
      },
    },
    async ({ uid, req, res }) => {
      const body = req.body ?? {};
      const { report, error } = sanitizeReportBody(body);
      if (!report) {
        sendBadRequest(res, error!.message, error!.explanation);
        return;
      }
      const failureEpisodeId = body.failureEpisodeId;
      if (failureEpisodeId !== undefined && !isValidFailureEpisodeId(failureEpisodeId)) {
        sendBadRequest(res, 'invalid failureEpisodeId', 'El identificador del episodio de error no es válido.');
        return;
      }

      const verdict = await bindSession({ roomSid: report.roomSid, roomName: report.roomName, uid });
      if (verdict === 'room-not-found') {
        sendError(res, 404, 'room not found', 'No encontramos esa sesión de clase.');
        return;
      }
      if (verdict !== 'bound') {
        sendError(res, 403, 'room session not owned', 'Este reporte corresponde a una clase que no está a tu cargo.');
        return;
      }

      const userRef = db.collection('users').doc(uid);
      const reportRef = userRef.collection('reports').doc(report.roomSid);
      const episodeRef = failureEpisodeId
        ? userRef.collection('reportFailureEpisodes').doc(failureEpisodeId)
        : undefined;
      const classRef = report.classId
        ? db
          .collection('users')
          .doc(uid)
          .collection('classes')
          .doc(report.classId)
        : undefined;

      // The report document id is the room SID. Replaying this request therefore
      // converges on one report while the class state changes in the same commit.
      await db.runTransaction(async transaction => {
        const classSnapshot = classRef ? await transaction.get(classRef) : undefined;
        const episodeSnapshot = episodeRef ? await transaction.get(episodeRef) : undefined;
        const inbox = failureEpisodeId ? await readInbox(transaction, userRef) : undefined;
        const [saveFailedNotification] = inbox
          ? await readInboxItems(transaction, inbox, [
            canonicalNotificationId('report.save_failed', `report:${report.roomSid}:save-failed:${failureEpisodeId}`),
          ])
          : [];
        if (classSnapshot) {
          const classData = classSnapshot.data();
          if (!classData || classData.roomName !== report.roomName) {
            throw HttpError.badRequest('class relation mismatch');
          }
          transaction.update(classRef!, { status: 'completed', completedAt: serverTimestamp() });
        }
        if (episodeRef) {
          const episode = episodeSnapshot!.data();
          if (!episode || episode.status !== 'resolved') {
            transaction.set(
              episodeRef,
              {
                ...(episode || { reportId: report.roomSid, failureEpisodeId, observedAt: serverTimestamp() }),
                status: 'resolved',
                resolvedAt: serverTimestamp(),
              },
              { merge: true }
            );
          }
          // The failure notification is moot once the episode is resolved.
          if (inbox && saveFailedNotification) retractInboxItems(transaction, inbox, [saveFailedNotification]);
        }
        // merge: true — a replayed save (Feature 1's keepalive-on-unload + pending-queue
        // auto-retry can legitimately resend the same roomSid) must not wipe out the
        // `recording` field recordings.ts writes onto this same doc after the class ends.
        transaction.set(reportRef, { ...report, endedAt: serverTimestamp() }, { merge: true });
      });

      res.status(201).json({ saved: true, roomSid: report.roomSid });
    }
  );
}

export function createGetReportsHandler(db: ReportsDatabase): RequestHandler {
  return teacherHandler(
    db,
    {
      forbiddenExplanation: TEACHER_ONLY_EXPLANATION,
      failure: {
        event: 'report_lookup_failed',
        operation: 'GET /reports',
        message: 'report lookup failed',
        explanation: 'No pudimos consultar el historial de clases. Intenta de nuevo en unos segundos.',
      },
    },
    async ({ uid, res }) => {
      // Single-field orderBy on a subcollection — no composite index required.
      const snapshot = await db
        .collection('users')
        .doc(uid)
        .collection('reports')
        .orderBy('endedAt', 'desc')
        .limit(MAX_REPORTS_RETURNED)
        .get();

      const reports = snapshot.docs.map(doc => {
        const { endedAt, ...data } = doc.data() || {};
        return {
          ...data,
          roomSid: doc.id,
          // Resolve the Firestore server timestamp to epoch millis for the client;
          // null when the write predates the field or the type is unexpected.
          endedAtMs: endedAt && typeof endedAt.toMillis === 'function' ? endedAt.toMillis() : null,
        };
      });

      res.status(200).json(reports);
    }
  );
}

/** Fetches one report only from the verified teacher's own subcollection. */
export function createGetReportHandler(db: ReportsDatabase): RequestHandler {
  return teacherHandler(
    db,
    {
      forbiddenExplanation: TEACHER_ONLY_EXPLANATION,
      failure: {
        event: 'report_read_failed',
        operation: 'GET /reports/:roomSid',
        message: 'report lookup failed',
        explanation: 'No pudimos consultar el reporte de la clase. Intenta de nuevo en unos segundos.',
      },
      // Validate the sid before the role lookup so a malformed request answers 400
      // even for a non-teacher.
      preValidate: (req, res) => {
        const roomSid = req.params.roomSid;
        if (typeof roomSid !== 'string' || !ROOM_SID_PATTERN.test(roomSid)) {
          sendBadRequest(res, 'invalid roomSid', 'El identificador de la sala no es válido.');
          return false;
        }
        return true;
      },
      logContext: req => ({ roomSid: req.params.roomSid }),
    },
    async ({ uid, req, res }) => {
      const snapshot = await db
        .collection('users')
        .doc(uid)
        .collection('reports')
        .doc(req.params.roomSid)
        .get();
      if (!snapshot.data()) {
        sendError(res, 404, 'report not found', 'No encontramos ese reporte.');
        return;
      }

      const { endedAt, ...data } = snapshot.data() || {};
      res.status(200).json({
        ...data,
        roomSid: snapshot.id,
        endedAtMs: endedAt && typeof endedAt.toMillis === 'function' ? endedAt.toMillis() : null,
      });
    }
  );
}
