import { AttentionTimelinePoint } from './types';
import { formatTimelineLabel } from './liveAttention';
import {
  backfillBucket,
  BACKFILL_MIN_INTERVAL_MS,
  sanitizeBackfillSamples,
} from '../../hooks/useAttentionTelemetry/attentionBackfill';
import { AttentionBackfillSample } from '../../hooks/useClassDataChannel/classProtocol';

/*
 * Pure teacher-side merge of the attention a student buffered while no teacher was present.
 *
 * Idempotence: the ledger remembers which 10 s windows of which student were already folded in,
 * so the same chunk delivered twice (the student resends to survive a late subscription) changes
 * nothing. Backfilled data only feeds history and the timeline; the proctoring feed never sees it.
 */

export interface BackfillLedger {
  /** identity -> windows already folded in. */
  seen: Map<string, Set<number>>;
  /** window -> running sum/count across students, to average the group point. */
  buckets: Map<number, { sum: number; count: number }>;
}

export const createBackfillLedger = (): BackfillLedger => ({ seen: new Map(), buckets: new Map() });

/**
 * Validates an untrusted payload and returns ONLY the samples not folded in before, recording
 * them in the ledger (mutates it by design: long-lived session data held in a ref).
 */
export function acceptBackfill(
  ledger: BackfillLedger,
  identity: string,
  raw: unknown,
  now: number
): AttentionBackfillSample[] {
  const seen = ledger.seen.get(identity) ?? new Set<number>();
  const fresh = sanitizeBackfillSamples(raw, now).filter(s => !seen.has(backfillBucket(s.t)));
  fresh.forEach(s => {
    const bucket = backfillBucket(s.t);
    seen.add(bucket);
    const agg = ledger.buckets.get(bucket) ?? { sum: 0, count: 0 };
    ledger.buckets.set(bucket, { sum: agg.sum + s.index, count: agg.count + 1 });
  });
  if (fresh.length > 0) ledger.seen.set(identity, seen);
  return fresh;
}

/** A timeline point with the epoch it belongs to (seeded points use 0: older than anything live). */
export interface TimedPoint {
  t: number;
  point: AttentionTimelinePoint;
  backfill?: boolean;
}

/**
 * Inserts (or refreshes in place) one point per touched window, chronologically. Returns the
 * same array when there is nothing fresh.
 */
export function mergeBackfillTimeline(
  entries: TimedPoint[],
  fresh: AttentionBackfillSample[],
  ledger: BackfillLedger,
  cap: number = Number.POSITIVE_INFINITY
): TimedPoint[] {
  if (fresh.length === 0) return entries;
  const touched = Array.from(new Set(fresh.map(s => backfillBucket(s.t)))).sort((a, b) => a - b);
  const touchedStarts = new Set(touched.map(b => b * BACKFILL_MIN_INTERVAL_MS));
  const kept = entries.filter(e => !(e.backfill && touchedStarts.has(e.t)));
  const next = kept.slice();
  touched.forEach(bucket => {
    const agg = ledger.buckets.get(bucket)!;
    const t = bucket * BACKFILL_MIN_INTERVAL_MS;
    const entry: TimedPoint = {
      t,
      backfill: true,
      point: { time: formatTimelineLabel(new Date(t)), value: Math.round(agg.sum / agg.count) },
    };
    let at = next.length;
    while (at > 0 && next[at - 1].t > t) at--;
    next.splice(at, 0, entry);
  });
  return next.slice(-cap);
}
