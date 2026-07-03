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
