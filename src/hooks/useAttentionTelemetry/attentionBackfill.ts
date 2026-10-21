import { AttentionBackfillMessage, AttentionBackfillSample } from '../useClassDataChannel/classProtocol';

/**
 * Pure rules of the attention backfill: while no teacher is in the room a student keeps a
 * bounded, downsampled local buffer of their own index and hands it to the teacher when one
 * (re)connects, so the group timeline and the per-student history have no hole. Only numbers
 * and timestamps travel, never an image. Everything here is a pure function of its inputs
 * (the clock is injected by the caller).
 */

/** At most one buffered sample per this window. */
export const BACKFILL_MIN_INTERVAL_MS = 10_000;

/** 3 h of samples at one per 10 s; the oldest are dropped beyond it. */
export const BACKFILL_MAX_SAMPLES = 1080;

/** Samples per message: ~30 bytes each, so a chunk stays far below the 16 KiB DataTrack limit. */
export const BACKFILL_CHUNK_SIZE = 200;

/** Tolerated clock skew between a student and the teacher when judging "in the future". */
const FUTURE_SKEW_MS = 60_000;

const bucketOf = (t: number) => Math.floor(t / BACKFILL_MIN_INTERVAL_MS);

const isValidSample = (value: unknown): value is AttentionBackfillSample => {
  if (typeof value !== 'object' || value === null) return false;
  const { t, index } = value as Record<string, unknown>;
  return (
    typeof t === 'number' &&
    Number.isFinite(t) &&
    typeof index === 'number' &&
    Number.isFinite(index) &&
    index >= 0 &&
    index <= 100
  );
};

/** Appends a sample unless it falls inside the downsampling window of the last one. */
export function appendBackfillSample(
  buffer: readonly AttentionBackfillSample[],
  sample: AttentionBackfillSample
): AttentionBackfillSample[] {
  if (!isValidSample(sample)) return buffer as AttentionBackfillSample[];
  const last = buffer[buffer.length - 1];
  if (last && sample.t - last.t < BACKFILL_MIN_INTERVAL_MS) return buffer as AttentionBackfillSample[];
  return [...buffer, { t: sample.t, index: sample.index }].slice(-BACKFILL_MAX_SAMPLES);
}

/** Splits a buffer into protocol messages of at most BACKFILL_CHUNK_SIZE samples. */
export function chunkBackfill(
  identity: string,
  samples: readonly AttentionBackfillSample[]
): AttentionBackfillMessage[] {
  const messages: AttentionBackfillMessage[] = [];
  for (let i = 0; i < samples.length; i += BACKFILL_CHUNK_SIZE) {
    messages.push({
      type: 'attention-backfill',
      identity,
      samples: samples.slice(i, i + BACKFILL_CHUNK_SIZE).map(({ t, index }) => ({ t, index })),
    });
  }
  return messages;
}

/**
 * What a receiver accepts from an untrusted payload: well-formed samples, not older than the
 * buffer cap, not in the future, sorted by time with at most one per downsampling window.
 */
export function sanitizeBackfillSamples(raw: unknown, now: number): AttentionBackfillSample[] {
  if (!Array.isArray(raw)) return [];
  const oldest = now - BACKFILL_MAX_SAMPLES * BACKFILL_MIN_INTERVAL_MS;
  const newest = now + FUTURE_SKEW_MS;
  const seen = new Set<number>();
  return raw
    .filter(isValidSample)
    .filter(s => s.t >= oldest && s.t <= newest)
    .sort((a, b) => a.t - b.t)
    .filter(s => {
      const bucket = bucketOf(s.t);
      if (seen.has(bucket)) return false;
      seen.add(bucket);
      return true;
    })
    .slice(-BACKFILL_MAX_SAMPLES)
    .map(({ t, index }) => ({ t, index }));
}

export function isBackfillMessage(value: unknown): value is AttentionBackfillMessage {
  if (typeof value !== 'object' || value === null) return false;
  const msg = value as Record<string, unknown>;
  return msg.type === 'attention-backfill' && Array.isArray(msg.samples);
}

export { bucketOf as backfillBucket };
