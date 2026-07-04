import { AttentionReportViewData } from './AttentionReportView';
import { averageOverTime, percentTimeAboveThreshold } from './reportMath';
import {
  AttentionLevel,
  AttentionTimelinePoint,
  ParticipantAttention,
  ProctoringAlert,
} from '../AttentionProvider/types';

/**
 * The slice of the live attention context needed to build a report, plus the
 * header fields (session name/count) the context does not carry. Shared by the
 * in-room "Ver reporte" action so the overlay and the new-tab report page derive
 * an identical `AttentionReportViewData` from the same source of truth.
 */
export interface LiveReportSource {
  sessionName: string;
  studentCount: number;
  source: 'mock' | 'live';
  groupAttention: number;
  groupDataAvailable: boolean;
  attentionThreshold: number;
  timeline: AttentionTimelinePoint[];
  participants: ParticipantAttention[];
  proctoringAlerts: ProctoringAlert[];
  attentionLevel: (score: number) => AttentionLevel;
  /** Capture time shown in the header chips (the client clock at report open). */
  reportDate: Date;
}

/**
 * Normalize the live attention context into the presentational view's data shape.
 * "Índice Prom." is the session average, falling back to the latest index for
 * participants without accumulated history (min/max stay undefined → rendered "—").
 * The group KPIs are honest only when the session recorded real data: either
 * accumulated timeline points, or a live reading at open time — otherwise the
 * view renders "—", never a placeholder 0 that reads as "0% attention".
 */
export function buildReportViewData(input: LiveReportSource): AttentionReportViewData {
  const {
    sessionName,
    studentCount,
    source,
    groupAttention,
    groupDataAvailable,
    attentionThreshold,
    timeline,
    participants,
    proctoringAlerts,
    attentionLevel,
    reportDate,
  } = input;

  // Build a lookup from identity -> alert count for the table.
  const alertCountByIdentity: Record<string, number> = {};
  proctoringAlerts.forEach(alert => {
    alertCountByIdentity[alert.identity] = (alertCountByIdentity[alert.identity] || 0) + 1;
  });

  return {
    sessionName,
    studentCount,
    source,
    attentionThreshold,
    timeline,
    hasGroupData: timeline.length > 0 || groupDataAvailable,
    groupAverage: timeline.length > 0 ? averageOverTime(timeline) : groupAttention,
    percentAboveThreshold: percentTimeAboveThreshold(timeline, attentionThreshold),
    participants: participants.map(participant => {
      const avg = participant.indexAvg ?? participant.index;
      return {
        identity: participant.identity,
        indexAvg: avg,
        indexMin: participant.indexMin,
        indexMax: participant.indexMax,
        level: attentionLevel(avg),
        alertCount: alertCountByIdentity[participant.identity] || 0,
      };
    }),
    totalAlerts: proctoringAlerts.length,
    reportDate,
  };
}
