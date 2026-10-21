import { AttentionReport } from './reportTypes';
import { mergeHistory, mergeProctoringLog, seedFromReport } from './liveSnapshot';
import { PROCTORING_FEED_MAX } from './liveAttention';

const report: AttentionReport = {
  roomSid: 'RM00000000000000000000000000000abc',
  roomName: 'matematicas-2a',
  endReason: 'left',
  source: 'live',
  studentCount: 2,
  attentionThreshold: 60,
  ranges: { lowMax: 40, mediumMax: 70 },
  groupAverage: 70,
  percentAboveThreshold: 50,
  timeline: [
    { time: '10:00:00', value: 60 },
    { time: '10:00:01', value: 80 },
  ],
  participants: [
    { identity: 'Ana', indexAvg: 70, indexMin: 50, indexMax: 90, level: 'medium', alertCount: 1 },
    { identity: 'Beto', indexAvg: 30, indexMin: 20, indexMax: 40, level: 'low', alertCount: 0 },
  ],
  proctoringAlerts: [{ identity: 'Ana', kind: 'away', detectedAt: '10:00' }],
  endedAtIso: '2026-07-03T10:00:02.000Z',
  startedAtIso: '2026-07-03T09:59:00.000Z',
  durationMs: 62000,
  recordingWasActiveAtEnd: false,
};

describe('seedFromReport', () => {
  it('restores the full timeline, the roster and the per-student history from the stored shape', () => {
    const seed = seedFromReport(report);

    expect(seed.fullTimeline).toEqual(report.timeline);
    expect(Array.from(seed.attended)).toEqual(['Ana', 'Beto']);
    // min/max are kept; the running sum is rebuilt from the average over the stored sample count.
    expect(seed.history.get('Ana')).toEqual({ min: 50, max: 90, sum: 140, count: 2 });
    expect(seed.history.get('Beto')).toEqual({ min: 20, max: 40, sum: 60, count: 2 });
  });

  it('restores the proctoring log as already-expired alerts from the live feed', () => {
    const [alert] = seedFromReport(report).proctoringLog;

    expect(alert).toMatchObject({ identity: 'Ana', kind: 'away', detectedAt: '10:00', detectedAtMs: 0 });
    expect(alert.id).toMatch(/^restored-/);
    expect(alert.confidence).toBeGreaterThan(0);
  });

  it('counts at least one sample per student when the timeline is empty', () => {
    const seed = seedFromReport({ ...report, timeline: [] });

    expect(seed.history.get('Ana')).toEqual({ min: 50, max: 90, sum: 70, count: 1 });
  });

  it('drops alerts of an unknown kind instead of rendering garbage', () => {
    const seed = seedFromReport({
      ...report,
      proctoringAlerts: [{ identity: 'Ana', kind: 'bogus' as any, detectedAt: '1' }],
    });

    expect(seed.proctoringLog).toEqual([]);
  });
});

describe('mergeHistory', () => {
  it('combines the restored entry with samples gathered since the room connected', () => {
    const current = new Map([['Ana', { min: 55, max: 95, sum: 150, count: 2 }]]);
    const restored = new Map([
      ['Ana', { min: 50, max: 90, sum: 140, count: 2 }],
      ['Beto', { min: 1, max: 2, sum: 3, count: 2 }],
    ]);

    mergeHistory(current, restored);

    expect(current.get('Ana')).toEqual({ min: 50, max: 95, sum: 290, count: 4 });
    expect(current.get('Beto')).toEqual({ min: 1, max: 2, sum: 3, count: 2 });
  });
});

describe('mergeProctoringLog', () => {
  const alert = (id: string) => ({
    id,
    identity: 'Ana',
    kind: 'away' as const,
    detectedAt: '1',
    detectedAtMs: 0,
    confidence: 1,
  });

  it('keeps the restored events first and the newest ones last, capped', () => {
    const merged = mergeProctoringLog([alert('r1'), alert('r2'), alert('r3')], [alert('n1')]);

    expect(merged.map(a => a.id)).toEqual(['r2', 'r3', 'n1']);
    expect(merged).toHaveLength(PROCTORING_FEED_MAX);
  });
});
