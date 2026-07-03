import { AttentionLevel, AttentionRanges, AttentionTimelinePoint, ProctoringAlert } from './types';

/*
 * Persisted attention-report contracts, shared by the client saver/history UI and
 * mirrored (structurally, not by import) by the Express handlers in
 * server/attentionReports.ts. A report is a SNAPSHOT of the professor-side
 * attention session, captured right before the room disconnects — the provider
 * clears its history when it goes inactive, so this is the only durable record.
 *
 * NOTE: prettier 1.19.1 (pre-commit hook) cannot parse `import type` /
 * `export type { }` syntax — keep these as plain imports/exports.
 */

/** Which professor exit path produced the report. */
export type ReportEndReason = 'ended-for-all' | 'left';

/** Per-student session summary row (drives the "Detalle por estudiante" table). */
export interface AttentionReportParticipant {
  identity: string;
  /** Time-averaged index over the session; the level is derived from this. */
  indexAvg: number;
  indexMin: number;
  indexMax: number;
  level: AttentionLevel;
  /** Proctoring alerts folded per identity at snapshot time. */
  alertCount: number;
}

/** Persisted slice of a proctoring alert (confidence/id dropped — display only needs these). */
export interface AttentionReportAlert {
  identity: string;
  kind: ProctoringAlert['kind'];
  detectedAt: string;
}

/** The payload POSTed to /reports when the professor ends or leaves a class. */
export interface AttentionReport {
  /** Twilio room SID — dedup key: a final save overwrites a partial "left" save. */
  roomSid: string;
  roomName: string;
  endReason: ReportEndReason;
  source: 'mock' | 'live';
  /** Remote participants connected at snapshot time (professor excluded). */
  studentCount: number;
  attentionThreshold: number;
  ranges: AttentionRanges;
  /** averageOverTime(timeline), falling back to the live groupAttention snapshot. */
  groupAverage: number;
  /** percentTimeAboveThreshold(timeline, attentionThreshold). */
  percentAboveThreshold: number;
  /** Capped by the provider at 90 points (1.5-minute sliding window). */
  timeline: AttentionTimelinePoint[];
  participants: AttentionReportParticipant[];
  /** Capped by the provider at the last 3 events. */
  proctoringAlerts: AttentionReportAlert[];
  /** Client clock at snapshot time — display fallback when endedAtMs is null. */
  endedAtIso: string;
}

/** A report as returned by GET /reports (Firestore serverTimestamp resolved to millis). */
export interface StoredAttentionReport extends AttentionReport {
  endedAtMs: number | null;
}
