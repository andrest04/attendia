import { RequestHandler } from 'express';
import { ReportsDatabase, sanitizeReportBody, TEACHER_ONLY_EXPLANATION } from './attentionReports';
import { sendBadRequest, sendError } from './http';
import { ROOM_SID_PATTERN } from './ids';
import { RoomSessionBinder } from './roomOwnership';
import { teacherHandler } from './teacherHandler';

/*
 * Live (in-progress) attention report snapshots:
 * users/{uid}/liveReports/{roomSid} = the latest snapshot the OWNER teacher pushed while the
 * class is running, so a teacher who leaves without ending the class (or loses connectivity)
 * does not lose the timeline / proctoring log: the browser restores it on re-entry.
 *
 * It is a DEDICATED document, never the report document:
 *  - GET /reports and GET /reports/:roomSid keep listing only real, final-or-left reports (a
 *    partial snapshot can never show up as a finished report in the Historial);
 *  - a push can never overwrite or downgrade a report written by POST /reports (different doc);
 *  - once the class is ended for all, the live push is refused (409) and the read answers 404:
 *    the final report supersedes the snapshot (the orphan live doc is never served).
 *
 * Ownership is the same as POST /reports: the injected RoomSessionBinder ties the SID to the
 * verified teacher, so a co-teacher can neither write nor read an owner's snapshot (their uid
 * has its own, empty, liveReports collection).
 */

const LIVE_COLLECTION = 'liveReports';

// Fields the server adds to the stored documents; never sent back to the browser.
const SERVER_ONLY_FIELDS = ['status', 'updatedAt', 'endedAt', 'recording'];

const unconfiguredSessionBinder: RoomSessionBinder = () =>
  Promise.reject(new Error('room session binder is not configured'));

const invalidRoomSid = (res: Parameters<typeof sendBadRequest>[0]) =>
  sendBadRequest(res, 'invalid roomSid', 'El identificador de la sala no es válido.');

function stripServerFields(data: { [key: string]: any }): { [key: string]: any } {
  const copy = { ...data };
  SERVER_ONLY_FIELDS.forEach(field => delete copy[field]);
  return copy;
}

function snapshotTimeMs(data: { [key: string]: any } | undefined): number {
  const ms = data ? new Date(data.endedAtIso).getTime() : NaN;
  return Number.isFinite(ms) ? ms : -Infinity;
}

/** PUT /reports/:roomSid/live — owner-only, idempotent replace of the latest snapshot. */
export function createPutLiveReportHandler(
  db: ReportsDatabase,
  serverTimestamp: () => unknown,
  bindSession: RoomSessionBinder = unconfiguredSessionBinder
): RequestHandler {
  return teacherHandler(
    db,
    {
      forbiddenExplanation: TEACHER_ONLY_EXPLANATION,
      failure: {
        event: 'live_report_save_failed',
        operation: 'PUT /reports/:roomSid/live',
        message: 'live report save failed',
        explanation: 'No pudimos guardar el avance de la clase. Intenta de nuevo en unos segundos.',
      },
      preValidate: (req, res) => {
        const roomSid = req.params.roomSid;
        if (typeof roomSid !== 'string' || !ROOM_SID_PATTERN.test(roomSid)) {
          invalidRoomSid(res);
          return false;
        }
        return true;
      },
      logContext: req => ({ roomSid: req.params.roomSid }),
    },
    async ({ uid, req, res }) => {
      const body = req.body ?? {};
      if (body.roomSid !== req.params.roomSid) {
        sendBadRequest(res, 'roomSid mismatch', 'El identificador de la sala no coincide.');
        return;
      }
      const { report, error } = sanitizeReportBody(body);
      if (!report) {
        sendBadRequest(res, error!.message, error!.explanation);
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
      const liveRef = userRef.collection(LIVE_COLLECTION).doc(report.roomSid);

      // The final-report check and the snapshot write share one transaction, so a concurrent
      // "end for all" save cannot slip in between and then be shadowed by this push.
      const stored = await db.runTransaction(async transaction => {
        const final = (await transaction.get(reportRef)).data();
        if (final && final.endReason === 'ended-for-all') return false;
        transaction.set(liveRef, { ...report, status: 'live', updatedAt: serverTimestamp() });
        return true;
      });

      if (!stored) {
        sendError(res, 409, 'report already final', 'La clase ya fue cerrada para todos.');
        return;
      }
      res.status(200).json({ saved: true, roomSid: report.roomSid });
    }
  );
}

/**
 * GET /reports/:roomSid/live — the freshest in-progress state of the teacher's own class:
 * the live snapshot or, when the teacher's last exit saved a newer "left" report, that one
 * (`snapshot` tells which). 404 when there is nothing to restore or the class already ended.
 */
export function createGetLiveReportHandler(db: ReportsDatabase): RequestHandler {
  return teacherHandler(
    db,
    {
      forbiddenExplanation: TEACHER_ONLY_EXPLANATION,
      failure: {
        event: 'live_report_read_failed',
        operation: 'GET /reports/:roomSid/live',
        message: 'live report lookup failed',
        explanation: 'No pudimos recuperar el avance de la clase. Intenta de nuevo en unos segundos.',
      },
      preValidate: (req, res) => {
        const roomSid = req.params.roomSid;
        if (typeof roomSid !== 'string' || !ROOM_SID_PATTERN.test(roomSid)) {
          invalidRoomSid(res);
          return false;
        }
        return true;
      },
      logContext: req => ({ roomSid: req.params.roomSid }),
    },
    async ({ uid, req, res }) => {
      const roomSid = req.params.roomSid;
      const userRef = db.collection('users').doc(uid);
      const [liveSnapshot, reportSnapshot] = await Promise.all([
        userRef
          .collection(LIVE_COLLECTION)
          .doc(roomSid)
          .get(),
        userRef
          .collection('reports')
          .doc(roomSid)
          .get(),
      ]);
      const live = liveSnapshot.data();
      const left = reportSnapshot.data();

      if ((left && left.endReason === 'ended-for-all') || (!live && !left)) {
        sendError(res, 404, 'live report not found', 'No encontramos avance guardado de esta clase.');
        return;
      }

      const useLeft = !live || (!!left && snapshotTimeMs(left) > snapshotTimeMs(live));
      const chosen = (useLeft ? left : live)!;
      res.status(200).json({ ...stripServerFields(chosen), roomSid, snapshot: useLeft ? 'left' : 'live' });
    }
  );
}
