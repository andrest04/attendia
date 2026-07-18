import { AttentionTimelinePoint } from '../AttentionProvider/types';

/*
 * Pure report metrics shared by the in-room overlay, the report saver hook, and
 * the history page. Leaf module on purpose: hooks must never import from
 * presentational components, so the math lives below both layers.
 */

/**
 * Time-average of the group attention over the recorded session (rounded).
 * Returns 0 for an empty timeline. Used by the report so "Atención promedio
 * grupal" is the session mean, not the last instantaneous snapshot.
 */
export function averageOverTime(timeline: AttentionTimelinePoint[]): number {
  if (timeline.length === 0) return 0;
  return Math.round(timeline.reduce((sum, p) => sum + p.value, 0) / timeline.length);
}

/**
 * Percentage of recorded time the group attention was at or above the threshold.
 * Returns 0 for an empty timeline. Replaces the old placeholder that just echoed
 * the threshold constant as if it were a percentage of time.
 */
export function percentTimeAboveThreshold(timeline: AttentionTimelinePoint[], threshold: number): number {
  if (timeline.length === 0) return 0;
  const above = timeline.filter(p => p.value >= threshold).length;
  return Math.round((above * 100) / timeline.length);
}

// Mirrors server/attentionReports.ts MAX_TIMELINE_POINTS structurally — the
// server hard-rejects any persisted report whose timeline exceeds this.
// 3h @ 1Hz: full per-second resolution for any realistic class length, so the
// report's zoom/scrub timeline (AttentionReportView's Brush) has real detail
// to zoom into. Downsampling only kicks in for a session longer than this.
export const MAX_REPORT_TIMELINE_POINTS = 10800;

/**
 * Bucket-average a timeline down to at most `maxPoints`, preserving the full
 * session span — unlike naive every-Nth-point sampling, every input point
 * contributes to its bucket's average, so no data is silently dropped.
 * Returns `points` unchanged when already within budget (the common case).
 */
export function downsampleTimeline(points: AttentionTimelinePoint[], maxPoints: number): AttentionTimelinePoint[] {
  if (points.length <= maxPoints || maxPoints <= 0) return points;
  const result: AttentionTimelinePoint[] = [];
  for (let b = 0; b < maxPoints; b++) {
    const start = Math.floor((b * points.length) / maxPoints);
    const end = Math.floor(((b + 1) * points.length) / maxPoints);
    const bucket = points.slice(start, end);
    const avg = Math.round(bucket.reduce((sum, p) => sum + p.value, 0) / bucket.length);
    result.push({ time: bucket[bucket.length - 1].time, value: avg });
  }
  return result;
}
