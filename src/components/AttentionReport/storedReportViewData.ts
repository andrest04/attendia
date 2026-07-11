import { AttentionReportViewData } from './AttentionReportView';
import { StoredAttentionReport } from '../AttentionProvider/reportTypes';

/** Prefer the Firestore completion time while retaining reports written before it resolved. */
export function storedReportDate(report: StoredAttentionReport): Date {
  return report.endedAtMs != null ? new Date(report.endedAtMs) : new Date(report.endedAtIso);
}

/** Adapt a persisted report to the source-agnostic view used by both history entry points. */
export function storedReportToViewData(report: StoredAttentionReport): AttentionReportViewData {
  return {
    sessionName: report.roomName,
    studentCount: report.studentCount,
    source: report.source,
    attentionThreshold: report.attentionThreshold,
    timeline: report.timeline || [],
    hasGroupData: true,
    groupAverage: report.groupAverage,
    percentAboveThreshold: report.percentAboveThreshold,
    participants: report.participants || [],
    totalAlerts: (report.proctoringAlerts || []).length,
    reportDate: storedReportDate(report),
  };
}
