import { Dispatch, SetStateAction, useCallback, useEffect } from 'react';
import { DashboardStat } from './types';
import { mockDashboardData } from './mockDashboardData';
import { StateContextType } from '../../state';
import { StoredAttentionReport } from '../../components/AttentionProvider/reportTypes';
import { PendingAttentionReport } from '../AttentionProvider/reportTypes';
import { buildReportStats, computeTotalHoursTaught } from './reportStats';
import { getPendingAttentionReports, removePendingAttentionReport } from '../AttentionReport/pendingAttentionReports';
import { isPermanentClientError } from '../../state/useFirebaseAuth/apiClient';
import useReloadableResource from '../../hooks/useReloadableResource/useReloadableResource';

export interface UseTeacherReportsParams {
  fetchAttentionReports?: StateContextType['fetchAttentionReports'];
  saveAttentionReport?: StateContextType['saveAttentionReport'];
  userUid?: string;
  setPendingReports: Dispatch<SetStateAction<PendingAttentionReport[]>>;
  // The notifications hook's own bell-refresh, needed once a queued report is
  // finally retried successfully. Owned by TeacherDashboard.tsx (it in turn
  // depends on this hook's pendingReports state to build its own pending
  // failure claims), so it is threaded in here rather than constructed
  // locally — see the "cross-hook dependencies" note in TeacherDashboard.tsx.
  notifications: { refresh: () => void };
}

/**
 * Owns the "Reports" concern of TeacherDashboard: fetching attention reports,
 * the derived real stat cards, and retrying reports that failed to save
 * (queued in localStorage — see pendingAttentionReports.ts). Mechanical
 * extraction from TeacherDashboard.tsx.
 */
export default function useTeacherReports({
  fetchAttentionReports,
  saveAttentionReport,
  userUid,
  setPendingReports,
  notifications,
}: UseTeacherReportsParams) {
  const data = mockDashboardData;
  const {
    data: reports,
    isLoading: isReportsLoading,
    error: reportsError,
    reload: loadReports,
  } = useReloadableResource<StoredAttentionReport[] | null>(fetchAttentionReports, {
    initial: null,
    failureMessage: 'No pudimos consultar el historial de clases.',
    logLabel: 'TeacherDashboard: could not fetch attention reports',
  });

  const retryPendingReports = useCallback(() => {
    if (!saveAttentionReport) return;
    const reportsToRetry = getPendingAttentionReports(userUid);
    if (reportsToRetry.length === 0) return;
    Promise.all(
      reportsToRetry.map(report =>
        saveAttentionReport(report)
          .then(() => {
            removePendingAttentionReport(userUid, report.roomSid);
            return true;
          })
          .catch(error => {
            if (isPermanentClientError(error)) {
              // 400/403/404/413: the server will never accept it, so stop retrying.
              removePendingAttentionReport(userUid, report.roomSid);
              console.error('attention-report-persistence: retry permanently rejected, dropped', {
                roomSid: report.roomSid,
                error,
              });
              return true;
            }
            console.error('attention-report-persistence: retry failed', { roomSid: report.roomSid, error });
            return false;
          })
      )
    ).then(results => {
      if (results.some(Boolean)) {
        setPendingReports(getPendingAttentionReports(userUid));
        notifications.refresh();
      }
    });
  }, [notifications, saveAttentionReport, setPendingReports, userUid]);

  // Auto-retry once on mount if reports were queued from a failed/unload save, and
  // again whenever the browser regains connectivity — the manual "Reintentar
  // guardado" button (below) stays as the visible fallback either way.
  useEffect(() => {
    retryPendingReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.addEventListener('online', retryPendingReports);
    return () => window.removeEventListener('online', retryPendingReports);
  }, [retryPendingReports]);

  const hasRealStats = Boolean(fetchAttentionReports);

  const stats: DashboardStat[] = hasRealStats
    ? (() => {
        const { sessionsThisWeek, activeStudents, avgAttentionPercent } = buildReportStats(reports || [], Date.now());
        const totalHoursTaught = computeTotalHoursTaught(reports || []);
        return [
          { ...data.stats[0], value: `${sessionsThisWeek}` },
          { ...data.stats[1], value: `${activeStudents}` },
          { ...data.stats[2], value: `${avgAttentionPercent}%` },
          { ...data.stats[3], value: `${totalHoursTaught}h` },
        ];
      })()
    : data.stats;

  return {
    reports,
    isReportsLoading,
    reportsError,
    loadReports,
    retryPendingReports,
    hasRealStats,
    stats,
  };
}
