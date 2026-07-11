import { AttentionReport } from '../AttentionProvider/reportTypes';

const STORAGE_KEY = 'twilio-video-pending-attention-reports';

interface PendingReportsByUser {
  [uid: string]: AttentionReport[];
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

export function getPendingAttentionReports(uid: string | undefined): AttentionReport[] {
  return uid ? readAll()[uid] || [] : [];
}

// A report is keyed by roomSid server-side, so replacing a pending copy preserves
// the same idempotency contract before it is retried.
export function savePendingAttentionReport(uid: string | undefined, report: AttentionReport): void {
  if (!uid) return;
  try {
    const reports = readAll();
    reports[uid] = [...(reports[uid] || []).filter(item => item.roomSid !== report.roomSid), report];
    writeAll(reports);
  } catch (error) {
    console.error('attention-report-persistence: could not queue report for retry', { roomSid: report.roomSid, error });
  }
}

export function removePendingAttentionReport(uid: string | undefined, roomSid: string): void {
  if (!uid) return;
  try {
    const reports = readAll();
    const remaining = (reports[uid] || []).filter(report => report.roomSid !== roomSid);
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
