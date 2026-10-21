import {
  appendBackfillSample,
  BACKFILL_CHUNK_SIZE,
  BACKFILL_MAX_SAMPLES,
  BACKFILL_MIN_INTERVAL_MS,
  chunkBackfill,
  isBackfillMessage,
  sanitizeBackfillSamples,
} from './attentionBackfill';

const T0 = 1_700_000_000_000;

describe('appendBackfillSample', () => {
  it('keeps the first sample', () => {
    expect(appendBackfillSample([], { t: T0, index: 70 })).toEqual([{ t: T0, index: 70 }]);
  });

  it('downsamples to at most one sample per interval', () => {
    let buffer = appendBackfillSample([], { t: T0, index: 70 });
    buffer = appendBackfillSample(buffer, { t: T0 + 1000, index: 10 });
    buffer = appendBackfillSample(buffer, { t: T0 + BACKFILL_MIN_INTERVAL_MS - 1, index: 10 });
    expect(buffer).toHaveLength(1);
    buffer = appendBackfillSample(buffer, { t: T0 + BACKFILL_MIN_INTERVAL_MS, index: 55 });
    expect(buffer.map(s => s.index)).toEqual([70, 55]);
  });

  it('ignores non-finite values and does not mutate the input', () => {
    const buffer = Object.freeze([{ t: T0, index: 70 }]) as any;
    expect(appendBackfillSample(buffer, { t: T0 + 20000, index: NaN })).toBe(buffer);
    expect(appendBackfillSample(buffer, { t: Infinity, index: 50 })).toBe(buffer);
  });

  it('drops the oldest entries beyond the cap', () => {
    let buffer: Array<{ t: number; index: number }> = [];
    for (let i = 0; i < BACKFILL_MAX_SAMPLES + 5; i++) {
      buffer = appendBackfillSample(buffer, { t: T0 + i * BACKFILL_MIN_INTERVAL_MS, index: i % 100 });
    }
    expect(buffer).toHaveLength(BACKFILL_MAX_SAMPLES);
    expect(buffer[0].t).toBe(T0 + 5 * BACKFILL_MIN_INTERVAL_MS);
  });
});

describe('chunkBackfill', () => {
  it('returns nothing for an empty buffer', () => {
    expect(chunkBackfill('ana', [])).toEqual([]);
  });

  it('splits into additive messages that stay well under the 16 KiB DataTrack limit', () => {
    const samples = Array.from({ length: BACKFILL_MAX_SAMPLES }, (_, i) => ({
      t: T0 + i * BACKFILL_MIN_INTERVAL_MS,
      index: 100,
    }));
    const messages = chunkBackfill('ana', samples);
    expect(messages).toHaveLength(Math.ceil(BACKFILL_MAX_SAMPLES / BACKFILL_CHUNK_SIZE));
    messages.forEach(m => {
      expect(m.type).toBe('attention-backfill');
      expect(m.identity).toBe('ana');
      expect(m.samples.length).toBeLessThanOrEqual(BACKFILL_CHUNK_SIZE);
      expect(JSON.stringify(m).length).toBeLessThan(10 * 1024);
    });
    expect(messages.reduce((n, m) => n + m.samples.length, 0)).toBe(BACKFILL_MAX_SAMPLES);
  });
});

describe('sanitizeBackfillSamples', () => {
  const now = T0 + 5 * 3600_000;

  it('drops malformed, non-finite, out-of-range, future and too-old entries', () => {
    const result = sanitizeBackfillSamples(
      [
        { t: now - 1000, index: 50 },
        { t: now - 1000 - 20000, index: NaN },
        { t: 'x', index: 10 },
        null,
        { t: now - 40000, index: 101 },
        { t: now - 40000, index: -1 },
        { t: now + 10 * 60_000, index: 40 },
        { t: now - (BACKFILL_MAX_SAMPLES + 5) * BACKFILL_MIN_INTERVAL_MS, index: 40 },
      ],
      now
    );
    expect(result).toEqual([{ t: now - 1000, index: 50 }]);
  });

  it('sorts, keeps one sample per interval and returns [] for a non-array', () => {
    const result = sanitizeBackfillSamples(
      [
        { t: now - 5000, index: 20 },
        { t: now - 100000, index: 30 },
        { t: now - 100000 + 1, index: 31 },
      ],
      now
    );
    expect(result.map(s => s.index)).toEqual([30, 20]);
    expect(sanitizeBackfillSamples('nope' as any, now)).toEqual([]);
  });
});

describe('isBackfillMessage', () => {
  it('accepts the shape and rejects others', () => {
    expect(isBackfillMessage({ type: 'attention-backfill', identity: 'a', samples: [] })).toBe(true);
    expect(isBackfillMessage({ type: 'attention-backfill', samples: 'x' })).toBe(false);
    expect(isBackfillMessage({ type: 'attention-telemetry' })).toBe(false);
    expect(isBackfillMessage(null)).toBe(false);
  });
});
