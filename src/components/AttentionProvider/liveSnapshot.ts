import { AttentionReport } from './reportTypes';
import { AttentionTimelinePoint, ProctoringAlert } from './types';
import { IndexHistory, ParticipantHistory, PROCTORING_FEED_MAX } from './liveAttention';
import { PROCTORING_KINDS } from './proctoring';

/*
 * Pure bridge between the persisted report shape and the provider's in-memory session state.
 *
 * A teacher who leaves without ending the class (or loses connectivity) re-enters the same room
 * and must not start from an empty report: the server keeps the latest snapshot (see
 * server/liveReports.ts) and the provider is seeded from it. The stored shape is a SUMMARY, so
 * the restore is faithful as far as it goes: the timeline, the roster and min/max/average per
 * student survive; the exact running sums are rebuilt from the average.
 */

/** What the provider's hooks need to continue a session. */
export interface AttentionSeed {
  fullTimeline: AttentionTimelinePoint[];
  attended: ReadonlySet<string>;
  history: ParticipantHistory;
  proctoringLog: ProctoringAlert[];
}

export function seedFromReport(report: AttentionReport): AttentionSeed {
  // The group timeline has one point per sampled second; each measured student contributed to at
  // most that many samples, so it is the best available weight for the stored average.
  const samples = Math.max(1, report.timeline.length);
  const history: ParticipantHistory = new Map();
  report.participants.forEach(participant => {
    history.set(participant.identity, {
      min: participant.indexMin,
      max: participant.indexMax,
      sum: participant.indexAvg * samples,
      count: samples,
    });
  });

  const proctoringLog: ProctoringAlert[] = report.proctoringAlerts
    .filter(alert => Object.prototype.hasOwnProperty.call(PROCTORING_KINDS, alert.kind))
    .map((alert, index) => ({
      id: `restored-${alert.kind}-${alert.identity}-${index}`,
      identity: alert.identity,
      kind: alert.kind,
      detectedAt: alert.detectedAt,
      // 0 = long expired: the history stays in the report but never reappears in the live feed.
      detectedAtMs: 0,
      confidence: PROCTORING_KINDS[alert.kind].confidence,
    }));

  return {
    fullTimeline: report.timeline,
    attended: new Set(report.participants.map(participant => participant.identity)),
    history,
    proctoringLog,
  };
}

/** Folds the restored per-student history into the one gathered since the room connected (mutates `current`). */
export function mergeHistory(current: ParticipantHistory, restored: ParticipantHistory): void {
  restored.forEach((entry: IndexHistory, identity) => {
    const existing = current.get(identity);
    if (!existing) {
      current.set(identity, { ...entry });
      return;
    }
    existing.min = Math.min(existing.min, entry.min);
    existing.max = Math.max(existing.max, entry.max);
    existing.sum += entry.sum;
    existing.count += entry.count;
  });
}

/** Restored events come first (they are older); the cap keeps the most recent ones. */
export function mergeProctoringLog(restored: ProctoringAlert[], current: ProctoringAlert[]): ProctoringAlert[] {
  return [...restored, ...current].slice(-PROCTORING_FEED_MAX);
}
