import { acceptBackfill, createBackfillLedger, mergeBackfillTimeline, TimedPoint } from './backfill';
import { BACKFILL_MIN_INTERVAL_MS } from '../../hooks/useAttentionTelemetry/attentionBackfill';
import { ParticipantHistory, recordIndexSample } from './liveAttention';

const NOW = 1_700_000_000_000 + 5 * 3600_000;
const STEP = BACKFILL_MIN_INTERVAL_MS;

describe('acceptBackfill', () => {
  it('returns only samples not seen before (idempotent per identity)', () => {
    const ledger = createBackfillLedger();
    const chunk = [
      { t: NOW - 3 * STEP, index: 40 },
      { t: NOW - 2 * STEP, index: 60 },
    ];
    expect(acceptBackfill(ledger, 'ana', chunk, NOW)).toHaveLength(2);
    expect(acceptBackfill(ledger, 'ana', chunk, NOW)).toEqual([]);
    expect(acceptBackfill(ledger, 'ana', [...chunk, { t: NOW - STEP, index: 80 }], NOW)).toEqual([
      { t: NOW - STEP, index: 80 },
    ]);
  });

  it('does not treat the same instant of another student as a duplicate', () => {
    const ledger = createBackfillLedger();
    const s = [{ t: NOW - 3 * STEP, index: 40 }];
    expect(acceptBackfill(ledger, 'ana', s, NOW)).toHaveLength(1);
    expect(acceptBackfill(ledger, 'bob', s, NOW)).toHaveLength(1);
  });

  it('drops malformed samples', () => {
    const ledger = createBackfillLedger();
    expect(
      acceptBackfill(
        ledger,
        'ana',
        [
          { t: NaN, index: 1 },
          { t: NOW, index: Infinity },
        ],
        NOW
      )
    ).toEqual([]);
  });
});

describe('mergeBackfillTimeline', () => {
  const live = (t: number, value: number): TimedPoint => ({ t, point: { time: 'x', value } });

  it('inserts averaged bucket points in chronological order, before newer live points', () => {
    const ledger = createBackfillLedger();
    const fresh = [...acceptBackfill(ledger, 'ana', [{ t: NOW - 3 * STEP, index: 40 }], NOW)];
    fresh.push(...acceptBackfill(ledger, 'bob', [{ t: NOW - 3 * STEP + 1, index: 60 }], NOW));
    const entries = [live(0, 90), live(NOW, 77)];
    const merged = mergeBackfillTimeline(entries, fresh, ledger);
    expect(merged.map(e => e.point.value)).toEqual([90, 50, 77]);
  });

  it('updates a bucket in place when a later chunk adds another student, never duplicating it', () => {
    const ledger = createBackfillLedger();
    const first = acceptBackfill(ledger, 'ana', [{ t: NOW - 3 * STEP, index: 40 }], NOW);
    let merged = mergeBackfillTimeline([live(NOW, 77)], first, ledger);
    const second = acceptBackfill(ledger, 'bob', [{ t: NOW - 3 * STEP, index: 80 }], NOW);
    merged = mergeBackfillTimeline(merged, second, ledger);
    expect(merged.map(e => e.point.value)).toEqual([60, 77]);
  });

  it('is a no-op for an empty fresh list (a repeated chunk)', () => {
    const entries = [live(NOW, 77)];
    expect(mergeBackfillTimeline(entries, [], createBackfillLedger())).toBe(entries);
  });

  it('respects the cap by dropping the oldest', () => {
    const ledger = createBackfillLedger();
    const fresh = acceptBackfill(ledger, 'ana', [{ t: NOW - 3 * STEP, index: 40 }], NOW);
    const merged = mergeBackfillTimeline([live(0, 1), live(NOW, 2)], fresh, ledger, 2);
    expect(merged.map(e => e.point.value)).toEqual([40, 2]);
  });
});

describe('recordIndexSample', () => {
  it('folds one sample into the history', () => {
    const history: ParticipantHistory = new Map();
    recordIndexSample(history, 'ana', 40);
    recordIndexSample(history, 'ana', 80);
    expect(history.get('ana')).toEqual({ min: 40, max: 80, sum: 120, count: 2 });
  });
});
