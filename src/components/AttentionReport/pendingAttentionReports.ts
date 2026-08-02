import { AttentionReport, PendingAttentionReport } from '../AttentionProvider/reportTypes';

const STORAGE_KEY = 'twilio-video-pending-attention-reports';
const MAX_PENDING_REPORTS = 20;
const EPISODE_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

interface PendingReportsByUser {
  [uid: string]: unknown[];
}

function readAll(): PendingReportsByUser {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(reports: PendingReportsByUser): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

function createFailureEpisodeId(): string {
  return `episode_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function isReport(value: any): value is AttentionReport {
  return value && typeof value === 'object' && typeof value.roomSid === 'string';
}

function normalize(value: any): PendingAttentionReport | undefined {
  if (!value || typeof value !== 'object') return undefined;
  if (isReport(value.report) && EPISODE_ID_PATTERN.test(value.failureEpisodeId) &&
      typeof value.firstFailedAtMs === 'number' && Number.isFinite(value.firstFailedAtMs) && value.firstFailedAtMs >= 0) {
    return { ...value.report, report: value.report, failureEpisodeId: value.failureEpisodeId, firstFailedAtMs: value.firstFailedAtMs };
  }
  // Migrate the previous report-only queue shape without losing a failed save.
  if (isReport(value)) {
    return { ...value, report: value, failureEpisodeId: createFailureEpisodeId(), firstFailedAtMs: Date.now() };
  }
  return undefined;
}

export function getPendingAttentionReports(uid: string | undefined): PendingAttentionReport[] {
  if (!uid) return [];
  const entries = readAll()[uid];
  return Array.isArray(entries) ? entries.map(normalize).filter((item): item is PendingAttentionReport => !!item).slice(0, MAX_PENDING_REPORTS) : [];
}

// Replacing the same report preserves its episode identity across ambiguous responses.
export function savePendingAttentionReport(uid: string | undefined, report: AttentionReport): void {
  if (!uid) return;
  try {
    const reports = readAll();
    const current = getPendingAttentionReports(uid);
    const existing = current.find(item => item.roomSid === report.roomSid);
    const pending: PendingAttentionReport = {
      ...report,
      report,
      failureEpisodeId: existing ? existing.failureEpisodeId : createFailureEpisodeId(),
      firstFailedAtMs: existing ? existing.firstFailedAtMs : Date.now(),
    };
    reports[uid] = [...current.filter(item => item.roomSid !== report.roomSid), pending].slice(-MAX_PENDING_REPORTS);
    writeAll(reports);
  } catch (error) {
    console.error('attention-report-persistence: could not queue report for retry', { roomSid: report.roomSid, error });
  }
}

export function removePendingAttentionReport(uid: string | undefined, roomSid: string): void {
  if (!uid) return;
  try {
    const reports = readAll();
    const remaining = getPendingAttentionReports(uid).filter(item => item.roomSid !== roomSid);
    if (remaining.length) reports[uid] = remaining;
    else delete reports[uid];
    writeAll(reports);
  } catch (error) {
    console.error('attention-report-persistence: could not remove retried report', { roomSid, error });
  }
}

export function clearPendingAttentionReports(uid: string | undefined): void {
  if (!uid) return;
  try {
    const reports = readAll();
    delete reports[uid];
    writeAll(reports);
  } catch (error) {
    console.error('attention-report-persistence: could not clear reports on sign-out', { error });
  }
}
