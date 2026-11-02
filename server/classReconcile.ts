import { RequestHandler } from 'express';
import { ClassesDatabase, getOwnedClass, readNewestClassDocs, TEACHER_ONLY_EXPLANATION } from './classes';
import { timestampMillis } from './firestoreTime';
import { logOperationalFailure } from './operationalEvents';
import { RoomExistenceChecker } from './roomExists';
import { teacherHandler } from './teacherHandler';

/*
 * Nothing tells this server a Twilio room ended, so a started class stays `started` until a report
 * names it, and old records and hidden duplicates pile up. POST /classes/reconcile, called once per
 * dashboard load, completes the ones that are over: stale or superseded, with a closed room.
 */

/** A started class older than this, with its room closed, was never finished properly. */
export const STALE_STARTED_CLASS_MS = 7 * 24 * 60 * 60 * 1000;

/** Twilio lookups per call; oldest first, so repeated calls drain a longer backlog. */
export const MAX_ROOMS_CHECKED_PER_CALL = 10;

export interface ReconcilableClass {
  id: string;
  roomName: string;
  status: string;
  scheduledAtMs: number | null;
  startedAtMs: number | null;
}

/** The order `isMoreRecentlyScheduled` uses in the dashboard (src/components/TeacherDashboard/classSessionsView.ts). */
function isMoreRecent(candidate: ReconcilableClass, current: ReconcilableClass): boolean {
  const candidateMs = candidate.scheduledAtMs ?? candidate.startedAtMs ?? -Infinity;
  const currentMs = current.scheduledAtMs ?? current.startedAtMs ?? -Infinity;
  return candidateMs === currentMs ? candidate.id > current.id : candidateMs > currentMs;
}

const ageOriginMs = (classRecord: ReconcilableClass) => classRecord.startedAtMs ?? classRecord.scheduledAtMs;

function isStale(classRecord: ReconcilableClass, nowMs: number): boolean {
  const originMs = ageOriginMs(classRecord);
  return originMs !== null && nowMs - originMs > STALE_STARTED_CLASS_MS;
}

function isSuperseded(classRecord: ReconcilableClass, classes: ReconcilableClass[]): boolean {
  return classes.some(
    other =>
      other.id !== classRecord.id &&
      other.roomName === classRecord.roomName &&
      (other.status === 'started' || other.status === 'completed') &&
      isMoreRecent(other, classRecord)
  );
}

/** Started records that should be completed if their room is closed, oldest first. */
export function findReconcileCandidates(classes: ReconcilableClass[], nowMs: number): ReconcilableClass[] {
  const origin = (classRecord: ReconcilableClass) => ageOriginMs(classRecord) ?? -Infinity;
  return classes
    .filter(
      classRecord =>
        classRecord.status === 'started' && (isStale(classRecord, nowMs) || isSuperseded(classRecord, classes))
    )
    .sort((a, b) => origin(a) - origin(b) || (a.id < b.id ? -1 : 1));
}

/** The rooms of the given candidates, each once, keeping their order, up to the per-call limit. */
export function selectRoomsToCheck(candidates: ReconcilableClass[]): string[] {
  return Array.from(new Set(candidates.map(candidate => candidate.roomName))).slice(0, MAX_ROOMS_CHECKED_PER_CALL);
}

export function createReconcileClassesHandler(
  db: ClassesDatabase,
  roomExists: RoomExistenceChecker,
  serverTimestamp: () => unknown,
  now: () => number = Date.now
): RequestHandler {
  return teacherHandler(
    db,
    {
      forbiddenExplanation: TEACHER_ONLY_EXPLANATION,
      failure: {
        event: 'class_reconcile_failed',
        operation: 'POST /classes/reconcile',
        message: 'class reconcile failed',
        explanation: 'No pudimos actualizar el estado de las clases. Intenta de nuevo en unos segundos.',
      },
    },
    async ({ uid, res }) => {
      const docs = await readNewestClassDocs(db, uid);
      const candidates = findReconcileCandidates(
        docs.map(doc => {
          const data = doc.data() || {};
          return {
            id: doc.id,
            roomName: data.roomName,
            status: data.status,
            scheduledAtMs: timestampMillis(data.scheduledAt),
            startedAtMs: timestampMillis(data.startedAt),
          };
        }),
        now()
      );

      let completed = 0;
      for (const roomName of selectRoomsToCheck(candidates)) {
        const roomCandidates = candidates.filter(candidate => candidate.roomName === roomName);
        let isOpen: boolean;
        try {
          isOpen = await roomExists(roomName);
        } catch (error) {
          // An outage says nothing about the room: skip it, a later dashboard load asks again.
          logOperationalFailure({
            event: 'class_reconcile_lookup_failed',
            operation: 'POST /classes/reconcile',
            uid,
            classId: roomCandidates[0].id,
            error,
          });
          continue;
        }
        if (isOpen) continue;

        for (const candidate of roomCandidates) {
          const docRef = getOwnedClass(db, uid, candidate.id);
          const didComplete = await db.runTransaction(async transaction => {
            const snapshot = await transaction.get(docRef);
            const data = snapshot.data();
            // A changed startedAt means "Start again" ran after the room lookup above: that room
            // answer is out of date and the class is about to be in use.
            if (
              !snapshot.exists ||
              !data ||
              data.status !== 'started' ||
              timestampMillis(data.startedAt) !== candidate.startedAtMs
            ) {
              return false;
            }
            transaction.update(docRef, { status: 'completed', completedAt: serverTimestamp() });
            return true;
          });
          if (didComplete) completed += 1;
        }
      }

      res.status(200).json({ completed });
    }
  );
}
