import { AttentionComponents, AttentionLevel, AttentionRanges } from './types';
import { computeFullAttentionIndex } from '../../utils/attentionHeuristics';

/**
 * Single source of truth for the attention level thresholds (0-100 score →
 * 'low' | 'medium' | 'high'). Every consumer that needs to bucket a score into
 * a level (AttentionProvider live/mock data, the teacher dashboard history bars,
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

/**
 * Compute the aggregate attention index (0-100) from its three components.
 *
 * Formula: 0.40 × eyes + 0.30 × posture + 0.30 × head
 *
 * OPEN PRODUCT DECISION (doc v0.1): the team proposed equal weights (0.33 each)
 * as a counter-proposal (WhatsApp thread, 2026-05). The research document v0.1
 * uses the weights above. They are defined ONCE, as ATTENTION_WEIGHTS in
 * utils/attentionHeuristics.ts, and both this formula and the eyes+head subset the
 * live pipeline measures are derived from that table — do not scatter the weights
 * anywhere else in the codebase.
 *
 * NOTE — live pipeline uses computeLabAttentionIndex (eyes + head only):
 *   This three-component formula is used exclusively for mockAttentionData.
 *   The live CV pipeline (useAttentionCapture) does not measure posture today,
 *   so AttentionProvider uses computeLabAttentionIndex(eyes, head) from
 *   attentionHeuristics.ts for real attention indexes.  When posture becomes a
 *   measured signal, Layer 4b can wire it in here and this function becomes the
 *   live formula again.
 *
 * Result is rounded to the nearest integer and clamped to [0, 100].
 */
export function computeAttentionIndex(c: AttentionComponents): number {
  return computeFullAttentionIndex(c);
}
