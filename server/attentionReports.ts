import { RequestHandler } from 'express';

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

// Twilio room SIDs are "RM" + 32 hex/alphanumeric chars. Validating the shape also
// sanitizes the value before it is used as a Firestore document id.
const ROOM_SID_PATTERN = /^RM[a-zA-Z0-9]{32}$/;

// Defensive caps on incoming arrays — the client-side producers already cap far
// lower (timeline ≤90, alerts ≤3), so anything above these is a malformed payload.
const MAX_TIMELINE_POINTS = 200;
const MAX_PARTICIPANTS = 200;
const MAX_ALERTS = 10;

// Max reports returned by GET /reports (newest first).
const MAX_REPORTS_RETURNED = 50;

// Decoded Firebase identity attached by firebaseAuthMiddleware. Duplicated from
// userProfiles.ts on purpose: each server unit stays independently deployable and
// testable (same call as the isTeacherIdentity mirror in roomAccessGuard.ts).
export interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
}

// ─── Structural Firestore slice ────────────────────────────────────────────────
// Minimal surface used below; the real firebase-admin Firestore satisfies all of
// these structurally (same pattern as ProfileDatabase in userProfiles.ts).

export interface ReportDocumentSnapshot {
  id: string;
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
      explanation: 'El historial de clases solo está disponible para profesores.',
    },
  });
}

function sendBadRequest(res: Parameters<RequestHandler>[1], message: string, explanation: string) {
  res.status(400).json({ error: { message, explanation } });
}

/**
 * Resolves whether the verified uid holds role=teacher in Firestore. Returns
 * 'teacher' | 'forbidden'. Throws on Firestore failure (caller maps it to 503).
 */
async function resolveIsTeacher(db: ReportsDatabase, uid: string): Promise<boolean> {
  const snapshot = await db
    .collection('users')
    .doc(uid)
    .get();
  if (!snapshot.exists) return false;
  const data = snapshot.data() || {};
  return data.role === 'teacher';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
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
  const numericFields = ['studentCount', 'attentionThreshold', 'groupAverage', 'percentAboveThreshold'];
  for (const field of numericFields) {
    if (!isFiniteNumber(body[field])) {
      return { error: { message: `invalid ${field}`, explanation: 'Las métricas del reporte no son válidas.' } };
    }
  }

  return {
    report: {
      roomSid,
      roomName,
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
      endedAtIso: typeof body.endedAtIso === 'string' ? body.endedAtIso : '',
    },
  };
}

export function createPostReportHandler(db: ReportsDatabase, serverTimestamp: () => unknown): RequestHandler {
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

      const { report, error } = sanitizeReportBody(req.body ?? {});
      if (!report) {
        sendBadRequest(res, error!.message, error!.explanation);
        return;
      }

      // Plain overwrite on the roomSid doc: a partial "left" save is replaced
      // wholesale by the final "ended-for-all" save for the same class.
      await db
        .collection('users')
        .doc(firebaseUser.uid)
        .collection('reports')
        .doc(report.roomSid)
        .set({ ...report, endedAt: serverTimestamp() });

      res.status(201).json({ saved: true, roomSid: report.roomSid });
    } catch (err) {
      console.error('attentionReports: could not save the report', err);
      res.status(503).json({
        error: {
          message: 'report save failed',
          explanation: 'No pudimos guardar el reporte de la clase. Intenta de nuevo en unos segundos.',
        },
      });
    }
  };
}

export function createGetReportsHandler(db: ReportsDatabase): RequestHandler {
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

      // Single-field orderBy on a subcollection — no composite index required.
      const snapshot = await db
        .collection('users')
        .doc(firebaseUser.uid)
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
    } catch (err) {
      console.error('attentionReports: could not list the reports', err);
      res.status(503).json({
        error: {
          message: 'report lookup failed',
          explanation: 'No pudimos consultar el historial de clases. Intenta de nuevo en unos segundos.',
        },
      });
    }
  };
}
