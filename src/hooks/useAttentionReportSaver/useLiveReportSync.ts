import { useContext, useEffect } from 'react';
import { AttentionRestoreContext } from '../../components/AttentionProvider';
import { AttentionReport, ReportEndReason } from '../../components/AttentionProvider/reportTypes';
import { useAppState } from '../../state';
import { ClientApiError, createApiClient } from '../../state/useFirebaseAuth/apiClient';
import { featureFlags } from '../../utils/featureFlags';
import useLatest from '../useLatest/useLatest';
import useVideoContext from '../useVideoContext/useVideoContext';

/*
 * Keeps the class report alive across the teacher leaving or losing connectivity.
 *
 * Owner teacher only (the caller passes `enabled`; the server refuses everyone else too):
 *  1. On entry, GET /reports/:sid/live and hand the stored snapshot to the AttentionProvider, so a
 *     teacher who comes back to a class that kept running continues the same report.
 *  2. Every LIVE_PUSH_INTERVAL_MS, PUT the current snapshot (same shape as the final report).
 *
 * The order matters: nothing is pushed until the restore settled. A restore that failed for a
 * transient reason is retried first, because pushing an empty snapshot over the stored one would
 * destroy exactly what this feature exists to keep. Pushes are silent and never block anything; a
 * 403/409 (not the owner / the class was already ended for all) stops them for the session.
 *
 * Inert, with no network at all, while the attention pipeline flag is off.
 */

export const LIVE_PUSH_INTERVAL_MS = 30 * 1000;
export const LIVE_RESTORE_RETRY_MS = 10 * 1000;

// The server will answer these the same way on every retry.
const STOP_PUSHING_STATUSES = [403, 409];

export interface LiveReportSyncOptions {
  /** True only for the room's owner teacher. */
  enabled: boolean;
  /** Pure snapshot of the current attention data (null when there is nothing to persist). */
  buildReport: (endReason: ReportEndReason) => AttentionReport | null;
  /** Called with the restored snapshot's start time so the duration continues across re-entries. */
  adoptStartTime: (startedAtIso: string) => void;
}

export default function useLiveReportSync({ enabled, buildReport, adoptStartTime }: LiveReportSyncOptions): void {
  const { room } = useVideoContext();
  const { user } = useAppState();
  const restore = useContext(AttentionRestoreContext);
  const roomSid = room?.sid;
  const firebaseUser = user && 'getIdToken' in user ? user : null;
  const active = enabled && Boolean(roomSid) && Boolean(firebaseUser) && featureFlags.isAttentionCvEnabled();

  const buildReportRef = useLatest(buildReport);
  const adoptStartTimeRef = useLatest(adoptStartTime);
  const restoreRef = useLatest(restore);

  useEffect(() => {
    if (!active || !firebaseUser || !roomSid) return;

    const api = createApiClient(firebaseUser);
    const path = `/reports/${roomSid}/live`;
    let cancelled = false;
    let timer: number | undefined;
    let inFlight = false;

    const push = () => {
      if (inFlight) return;
      const report = buildReportRef.current('left');
      if (!report) return;
      inFlight = true;
      api
        .send(path, { method: 'PUT', json: report })
        .catch(error => {
          if (error instanceof ClientApiError && STOP_PUSHING_STATUSES.indexOf(error.status) !== -1) {
            window.clearInterval(timer);
          }
        })
        .then(() => {
          inFlight = false;
        });
    };

    const startPushing = () => {
      if (cancelled) return;
      timer = window.setInterval(push, LIVE_PUSH_INTERVAL_MS);
    };

    const attemptRestore = () => {
      api
        .json<AttentionReport>(path)
        .then(snapshot => {
          if (cancelled) return;
          restoreRef.current(snapshot);
          adoptStartTimeRef.current(snapshot.startedAtIso);
          startPushing();
        })
        .catch(error => {
          if (cancelled) return;
          if (error instanceof ClientApiError && error.status === 404) {
            // Nothing stored yet: a fresh class (or the first entry). Safe to start pushing.
            startPushing();
          } else if (error instanceof ClientApiError && STOP_PUSHING_STATUSES.indexOf(error.status) !== -1) {
            // Not the owner of this class: neither restore nor push.
          } else {
            timer = window.setTimeout(attemptRestore, LIVE_RESTORE_RETRY_MS);
          }
        });
    };

    attemptRestore();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(timer);
    };
  }, [active, firebaseUser, roomSid, buildReportRef, adoptStartTimeRef, restoreRef]);
}
