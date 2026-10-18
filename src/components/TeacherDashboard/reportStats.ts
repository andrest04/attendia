import { StoredAttentionReport } from '../../components/AttentionProvider/reportTypes';

/**
 * Pure, deterministic transform from real StoredAttentionReport[] + an injected
 * clock into the "Clases" tab's real stat values. Never reads Date.now() itself —
 * same discipline as classSessionsView.ts elsewhere in this
 * repo: callers inject "now" so the transform stays unit-testable.
 */

/** Returns the epoch ms of the most recent Monday 00:00:00 local time at-or-before nowMs. */
export function startOfWeekMs(nowMs: number): number {
  const now = new Date(nowMs);
  // getDay(): 0 = Sunday … 6 = Saturday. Convert to 0 = Monday … 6 = Sunday, matching
  // this codebase's existing convention in classSessionsView.ts's getJulyWeekdayIndex.
  const mondayIndex = (now.getDay() + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayIndex);
  monday.setHours(0, 0, 0, 0);
  return monday.getTime();
}

// These three stats are computed only from reports whose session ended in the
// current week, so a teacher with no classes this week correctly sees zeros
// rather than stale historical numbers.
export function buildReportStats(
  reports: StoredAttentionReport[],
  nowMs: number
): { sessionsThisWeek: number; activeStudents: number; avgAttentionPercent: number } {
  const weekStartMs = startOfWeekMs(nowMs);

  const thisWeekReports = reports.filter(report => report.endedAtMs !== null && report.endedAtMs >= weekStartMs);

  const sessionsThisWeek = thisWeekReports.length;

  // A mock-sourced report (CV pipeline off) is a real class, so it counts as a
  // session, but its participants and averages are simulated: keep them out of
  // the attention stats.
  const liveReports = thisWeekReports.filter(report => report.source === 'live');

  const studentIdentities = new Set<string>();
  liveReports.forEach(report => {
    report.participants.forEach(participant => studentIdentities.add(participant.identity));
  });
  const activeStudents = studentIdentities.size;

  const avgAttentionPercent =
    liveReports.length === 0
      ? 0
      : Math.round(liveReports.reduce((sum, report) => sum + report.groupAverage, 0) / liveReports.length);

  return { sessionsThisWeek, activeStudents, avgAttentionPercent };
}

/**
 * Total hours taught across all reports (not scoped to the current week, unlike
 * the three stats above) — each report's durationMs is the elapsed time between
 * its observed start and its final snapshot (see AttentionReport.durationMs).
 */
export function computeTotalHoursTaught(reports: StoredAttentionReport[]): number {
  const totalMs = reports.reduce(
    (sum, report) => sum + (Number.isFinite(report.durationMs) ? report.durationMs : 0),
    0
  );
  return Math.round(totalMs / 3600000);
}
