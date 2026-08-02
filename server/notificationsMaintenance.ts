import { logOperationalFailure } from './operationalEvents';
import { CLEAR_BATCH_SIZE, clearJobDocument, itemDocument, millis, userDocument } from './notifications';
import { NotificationsDatabase } from './notificationsTypes';

// If a retired generation's clear job hasn't advanced in this long, the drain is
// presumed abandoned (e.g. the owning teacher never made another request that
// would advance it via boundedMaintenance) — see createDrainOneClearBatch below.
const ABANDONED_CLEAR_JOB_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export function createDrainOneClearBatch(
  db: NotificationsDatabase,
  serverTimestamp: () => unknown,
  now: () => number = Date.now
): (uid: string) => Promise<void> {
  return async function drainOneClearBatch(uid: string) {
    let abandonedJobAgeMs: number | null = null;
    await db.runTransaction(async transaction => {
      const user = userDocument(db, uid);
      const jobs = await transaction.get(
        user.collection('notificationClearJobs').orderBy('createdAt', 'asc').limit(1)
      );
      const jobSnapshot = jobs.docs[0];
      if (!jobSnapshot) return;
      const job = jobSnapshot.data() || {};
      if (
        !Number.isSafeInteger(job.retiredGeneration) ||
        job.batchSize !== CLEAR_BATCH_SIZE ||
        job.status !== 'pending' ||
        (job.nextAfterId !== null && typeof job.nextAfterId !== 'string')
      ) throw new Error('invalid notification clear job');

      // Observability only (SUGGESTION-level): this repo has no background job
      // runner, so a drain only advances as a side effect of a later teacher
      // request. A job whose last progress is older than the threshold is likely
      // stuck/abandoned (e.g. the teacher never came back) — log it so it's at
      // least visible in monitoring instead of sitting silently forever.
      const lastProgressMs = millis(job.updatedAt);
      if (lastProgressMs !== null) {
        const ageMs = now() - lastProgressMs;
        if (ageMs > ABANDONED_CLEAR_JOB_THRESHOLD_MS) abandonedJobAgeMs = ageMs;
      }

      let itemsQuery = user
        .collection('notificationGenerations')
        .doc(String(job.retiredGeneration))
        .collection('items')
        .orderBy('__name__', 'asc');
      if (job.nextAfterId !== null) itemsQuery = itemsQuery.startAfter(job.nextAfterId);
      const items = await transaction.get(itemsQuery.limit(CLEAR_BATCH_SIZE));
      const jobRef = clearJobDocument(db, uid, job.retiredGeneration);
      for (const item of items.docs) {
        transaction.delete(itemDocument(db, uid, job.retiredGeneration, item.id));
      }
      if (items.docs.length < CLEAR_BATCH_SIZE) {
        transaction.delete(jobRef);
      } else {
        transaction.update(jobRef, {
          nextAfterId: items.docs[items.docs.length - 1].id,
          deletedCount: (Number.isSafeInteger(job.deletedCount) ? job.deletedCount : 0) + items.docs.length,
          updatedAt: serverTimestamp(),
        });
      }
    });
    if (abandonedJobAgeMs !== null) {
      logOperationalFailure({
        event: 'notification_clear_job_abandoned',
        operation: 'notification maintenance drain',
        uid,
        error: new Error(
          `notification clear job has not advanced in ${abandonedJobAgeMs}ms (threshold ${ABANDONED_CLEAR_JOB_THRESHOLD_MS}ms)`
        ),
      });
    }
  };
}
