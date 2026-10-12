import { AttentionContextValue } from '../AttentionProvider/types';
import { AttentionReport, ReportEndReason } from '../AttentionProvider/reportTypes';
import {
  averageOverTime,
  downsampleTimeline,
  MAX_REPORT_TIMELINE_POINTS,
  percentTimeAboveThreshold,
} from './reportMath';

export interface BuildAttentionReportInput {
  /** The attention snapshot to persist (the provider's live or mock data). */
  data: AttentionContextValue;
  room: { sid: string; name: string; isRecording?: boolean };
  endReason: ReportEndReason;
  /** When the room connection was first observed (ms); falls back to `now` (zero duration). */
  startedAtMs: number | null;
  /** The scheduled class this session belongs to, when it was started from the dashboard. */
  classId?: string;
  now?: Date;
}

/**
 * Pure snapshot of the in-room attention data into the exact AttentionReport that gets
 * persisted. No refs, no storage, no network: the caller decides WHEN to snapshot (the
 * provider clears its history the moment the room disconnects) and what to do with the
 * result. Kept separate from useAttentionReportSaver so the derivation can be tested on
 * plain data.
 */
export function buildAttentionReport({
  data,
  room,
  endReason,
  startedAtMs,
  classId,
  now = new Date(),
}: BuildAttentionReportInput): AttentionReport {
  // Fold proctoring alerts per identity for the per-student table.
  const alertCountByIdentity: Record<string, number> = {};
  data.proctoringAlerts.forEach(alert => {
    alertCountByIdentity[alert.identity] = (alertCountByIdentity[alert.identity] || 0) + 1;
  });

  const startedAt = startedAtMs ?? now.getTime();
  return {
    roomSid: room.sid,
    roomName: room.name,
    ...(classId ? { classId } : {}),
    endReason,
    source: data.source,
    // data.participants is the cumulative attendance roster (identities ever
    // seen, not just currently connected) — see AttentionProvider — so this
    // stays accurate even after every student has already left the room.
    studentCount: data.participants.length,
    attentionThreshold: data.attentionThreshold,
    ranges: data.ranges,
    // Same derivations as the in-room report view: session time-average with a
    // live-snapshot fallback, and the real share of time at/above the threshold.
    // Computed from the full-resolution session series (not the persisted,
    // possibly-downsampled one) for accuracy.
    groupAverage: data.fullTimeline.length > 0 ? averageOverTime(data.fullTimeline) : data.groupAttention,
    percentAboveThreshold: percentTimeAboveThreshold(data.fullTimeline, data.attentionThreshold),
    // Downsampled only if the session exceeded MAX_REPORT_TIMELINE_POINTS
    // (a no-op for any realistic class length — see reportMath.ts).
    timeline: downsampleTimeline(data.fullTimeline, MAX_REPORT_TIMELINE_POINTS),
    participants: data.participants.map(participant => {
      const avg = participant.indexAvg ?? participant.index;
      return {
        identity: participant.identity,
        indexAvg: avg,
        indexMin: participant.indexMin ?? participant.index,
        indexMax: participant.indexMax ?? participant.index,
        level: data.attentionLevel(avg),
        alertCount: alertCountByIdentity[participant.identity] || 0,
      };
    }),
    proctoringAlerts: data.proctoringAlerts.map(alert => ({
      identity: alert.identity,
      kind: alert.kind,
      detectedAt: alert.detectedAt,
    })),
    endedAtIso: now.toISOString(),
    startedAtIso: new Date(startedAt).toISOString(),
    durationMs: Math.max(0, now.getTime() - startedAt),
    // The SDK has no recording-composition status or media URL API in this app.
    // This is only the truthful final in-room state, not a download guarantee.
    recordingWasActiveAtEnd: Boolean(room.isRecording),
  };
}
