import { useEffect } from 'react';
import { useAppState } from '../../state';
import { savePendingAttentionReport } from '../../components/AttentionReport/pendingAttentionReports';
import useAttentionReportSaver from '../useAttentionReportSaver/useAttentionReportSaver';
import useCachedIdToken from '../useCachedIdToken/useCachedIdToken';
import useLatest from '../useLatest/useLatest';

/**
 * Teacher-only beforeunload/pagehide safety net for the attention report.
 *
 * useRoom already registers its own listener that disconnects the room, but never persists the
 * report — a tab close or refresh silently dropped it. This one, in order:
 *  1. synchronously snapshots the report into the localStorage retry queue (guaranteed durability
 *     even if the fetch below never lands), then
 *  2. fires a best-effort keepalive POST with the id token cached by useCachedIdToken (a
 *     synchronous handler cannot await `user.getIdToken()`).
 *
 * Browsers fire both `beforeunload` and `pagehide` for one unload, so a run within
 * UNLOAD_DEDUPE_WINDOW_MS of the previous handled one is skipped: one unload means one queue write
 * and one POST. The window is time-based, so the handler can never be disabled for good (e.g. when
 * a `beforeunload` is cancelled and the page stays alive).
 *
 * Latest-value refs keep the listener registered once while always reading fresh values. It is a
 * no-op for students. The request is deliberately NOT routed through the api client: it must be
 * synchronous, `keepalive`, and carry the already-cached token.
 */
/** beforeunload and pagehide of the same unload land well inside this window. */
export const UNLOAD_DEDUPE_WINDOW_MS = 1000;

export default function useUnloadReportPersistence(
  isTeacher: boolean,
  buildReport: ReturnType<typeof useAttentionReportSaver>['buildReport']
) {
  const { user } = useAppState();
  // `user` is typed as a union with a legacy non-firebase shape (see StateContextType);
  // narrow to a real firebase User via a method only it has before handing it to
  // useCachedIdToken, which calls user.getIdToken().
  const firebaseUser = user && 'getIdToken' in user ? user : null;
  // Only cached while a teacher is present — the keepalive POST below is the only consumer, and
  // it never runs for students.
  const cachedIdTokenRef = useCachedIdToken(isTeacher ? firebaseUser : null);

  const isTeacherRef = useLatest(isTeacher);
  const buildReportRef = useLatest(buildReport);
  const userRef = useLatest(user);

  useEffect(() => {
    let lastHandledAt: number | null = null;

    const handleUnload = () => {
      if (!isTeacherRef.current) {
        return;
      }
      const now = Date.now();
      if (lastHandledAt !== null && now - lastHandledAt < UNLOAD_DEDUPE_WINDOW_MS) {
        return;
      }
      const report = buildReportRef.current('left');
      if (!report) {
        return;
      }
      lastHandledAt = now;

      const currentUser = userRef.current;
      savePendingAttentionReport(currentUser && 'uid' in currentUser ? currentUser.uid : undefined, report);

      const idToken = cachedIdTokenRef.current;
      if (!idToken) {
        return;
      }
      // Not awaited: keepalive lets the browser keep this request alive past teardown. The
      // localStorage queue above already guarantees no data loss if this fails or never completes.
      fetch('/reports', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: idToken },
        body: JSON.stringify(report),
      }).catch(() => {
        // Swallowed: the pending-report queue is the source of truth for retry.
      });
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [cachedIdTokenRef, isTeacherRef, buildReportRef, userRef]);
}
