import { AttentionComponents } from './types';

/**
 * Compute the aggregate attention index (0-100) from its three components.
 *
 * Formula: 0.40 × eyes + 0.30 × posture + 0.30 × head
 *
 * OPEN PRODUCT DECISION (doc v0.1): the team proposed equal weights (0.33 each)
 * as a counter-proposal (WhatsApp thread, 2026-05). The research document v0.1
 * uses the weights above. THIS SINGLE FUNCTION is the one place to change the
 * formula — do not scatter the weights anywhere else in the codebase.
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
  const raw = 0.4 * c.eyes + 0.3 * c.posture + 0.3 * c.head;
  return Math.min(100, Math.max(0, Math.round(raw)));
}
