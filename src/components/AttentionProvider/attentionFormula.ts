import { AttentionLevel, AttentionRanges } from './types';

/**
 * Single source of truth for the attention level thresholds (0-100 score →
 * 'low' | 'medium' | 'high'). Every consumer that needs to bucket a score into
 * a level (AttentionProvider live data, the teacher dashboard history bars,
 * the group-attention gauge) must derive from these — do not redefine
 * lowMax/mediumMax/the threshold anywhere else.
 */
export const ATTENTION_RANGES: AttentionRanges = { lowMax: 40, mediumMax: 70 };

/** Scores below this are flagged as "group below threshold" (below-threshold alarm). */
export const ATTENTION_THRESHOLD = 60;

/** Maps a 0-100 score to a level using the given ranges (defaults to ATTENTION_RANGES). */
export function attentionLevelFromScore(score: number, ranges: AttentionRanges = ATTENTION_RANGES): AttentionLevel {
  if (score <= ranges.lowMax) return 'low';
  if (score <= ranges.mediumMax) return 'medium';
  return 'high';
}
