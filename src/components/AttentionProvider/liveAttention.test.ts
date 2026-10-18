import {
  averageIndex,
  buildParticipants,
  initialProctoringState,
  isMeasured,
  PROCTORING_FEED_MAX,
  recordHistory,
  stepProctoring,
  summarizeGroup,
} from './liveAttention';
import { attentionLevelFromScore } from './attentionFormula';

const sample = (identity: string, overrides: any = {}) => ({
  identity,
  index: 80,
  multiface: false,
  faces: 1,
  cameraOff: false,
  unsupported: false,
  ...overrides,
});

const level = (score: number) => attentionLevelFromScore(score);

describe('isMeasured', () => {
  it('requires camera on, a supported device and a detected face', () => {
    expect(isMeasured(sample('a'))).toBe(true);
    expect(isMeasured(sample('a', { cameraOff: true }))).toBe(false);
    expect(isMeasured(sample('a', { unsupported: true }))).toBe(false);
    expect(isMeasured(sample('a', { faces: 0 }))).toBe(false);
    expect(isMeasured(sample('a', { faces: 0, pending: true }))).toBe(false);
  });

  it('treats a row without a face count as measured (ad-hoc fixtures)', () => {
    expect(isMeasured({ cameraOff: false })).toBe(true);
  });
});

describe('averageIndex', () => {
  it('rounds the mean and reports nothing for an empty list', () => {
    expect(averageIndex([{ index: 80 }, { index: 71 }])).toBe(76);
    expect(averageIndex([])).toBeNull();
  });
});

describe('recordHistory', () => {
  it('tracks min, max and the running average per identity', () => {
    const history = new Map();
    recordHistory(history, [sample('a', { index: 50 })] as any);
    recordHistory(history, [sample('a', { index: 90 }), sample('b', { index: 20 })] as any);

    expect(history.get('a')).toEqual({ min: 50, max: 90, sum: 140, count: 2 });
    expect(history.get('b')).toEqual({ min: 20, max: 20, sum: 20, count: 1 });
  });
});

describe('buildParticipants', () => {
  it('uses live values for connected students and keeps their history', () => {
    const history = new Map([['a', { min: 40, max: 95, sum: 270, count: 4 }]]);
    const rows = buildParticipants({
      attended: new Set(['a']),
      history,
      live: [sample('a', { index: 85 }) as any],
      attentionLevel: level,
    });

    expect(rows).toEqual([
      {
        identity: 'a',
        index: 85,
        multiface: false,
        level: 'high',
        cameraOff: false,
        faces: 1,
        unsupported: false,
        pending: false,
        indexMin: 40,
        indexMax: 95,
        indexAvg: 68,
      },
    ]);
  });

  it('keeps a row for a student who left, from their history', () => {
    const rows = buildParticipants({
      attended: new Set(['gone']),
      history: new Map([['gone', { min: 60, max: 80, sum: 140, count: 2 }]]),
      live: [],
      attentionLevel: level,
    });

    expect(rows[0]).toMatchObject({
      identity: 'gone',
      index: 70,
      cameraOff: true,
      faces: 1,
      indexMin: 60,
      indexAvg: 70,
    });
  });

  it('gives a never-measured attendee an honest "sin medición" row', () => {
    const rows = buildParticipants({
      attended: new Set(['ghost']),
      history: new Map(),
      live: [],
      attentionLevel: level,
    });

    expect(rows[0]).toMatchObject({ identity: 'ghost', index: 0, faces: 0, cameraOff: true });
    expect(rows[0].indexMin).toBeUndefined();
    expect(rows[0].indexAvg).toBeUndefined();
  });

  it('carries a live "no reading yet" heartbeat as pending, not camera-off', () => {
    const rows = buildParticipants({
      attended: new Set(['a']),
      history: new Map(),
      live: [sample('a', { index: 0, faces: 0, pending: true }) as any],
      attentionLevel: level,
    });

    expect(rows[0]).toMatchObject({ identity: 'a', pending: true, cameraOff: false });
  });

  it('shows a connected student with no telemetry at all as pending, never camera-off', () => {
    const rows = buildParticipants({
      attended: new Set(['quiet']),
      connected: new Set(['quiet']),
      history: new Map(),
      live: [],
      attentionLevel: level,
    });

    expect(rows[0]).toMatchObject({ identity: 'quiet', pending: true, cameraOff: false, faces: 0 });
    expect(isMeasured(rows[0])).toBe(false);
  });

  it('keeps the accumulated history of a connected student whose reading is pending', () => {
    const rows = buildParticipants({
      attended: new Set(['a']),
      connected: new Set(['a']),
      history: new Map([['a', { min: 60, max: 80, sum: 140, count: 2 }]]),
      live: [],
      attentionLevel: level,
    });

    expect(rows[0]).toMatchObject({ pending: true, cameraOff: false, indexMin: 60, indexAvg: 70 });
  });

  it('unions attendees, history and live identities without duplicates', () => {
    const rows = buildParticipants({
      attended: new Set(['a', 'b']),
      history: new Map([['b', { min: 1, max: 1, sum: 1, count: 1 }]]),
      live: [sample('c') as any, sample('a') as any],
      attentionLevel: level,
    });

    expect(rows.map(row => row.identity).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('summarizeGroup', () => {
  it('averages only the measured participants', () => {
    const rows = [
      sample('a', { index: 80 }),
      sample('b', { index: 60 }),
      sample('c', { index: 5, cameraOff: true }),
      sample('d', { index: 5, faces: 0 }),
      sample('e', { index: 5, unsupported: true }),
      sample('f', { index: 5, faces: 0, pending: true }),
    ] as any;

    expect(summarizeGroup(rows)).toEqual({ groupAttention: 70, groupDataAvailable: true });
  });

  it('reports NO DATA, not 0 attention, when nobody is measured', () => {
    expect(summarizeGroup([sample('a', { cameraOff: true }) as any])).toEqual({
      groupAttention: 0,
      groupDataAvailable: false,
    });
    expect(summarizeGroup([])).toEqual({ groupAttention: 0, groupDataAvailable: false });
  });
});

describe('stepProctoring', () => {
  const away = sample('ana', { index: 10 }) as any;

  it('does not log on the first sample of a condition (debounce)', () => {
    const { state, changed } = stepProctoring(initialProctoringState(), [away], '10:00');
    expect(changed).toBe(false);
    expect(state.log).toEqual([]);
    expect(state.streak.get('ana::away')).toBe(1);
  });

  it('logs once the condition holds for consecutive samples, with a unique id and the kind confidence', () => {
    let current = initialProctoringState();
    current = stepProctoring(current, [away], '10:00').state;
    const result = stepProctoring(current, [away], '10:01');

    expect(result.changed).toBe(true);
    expect(result.state.log).toEqual([
      { id: 'live-away-ana-1', identity: 'ana', kind: 'away', detectedAt: '10:01', confidence: 0.9 },
    ]);
  });

  it('does not log again while the same condition persists', () => {
    let current = initialProctoringState();
    [away, away, away, away].forEach(s => {
      current = stepProctoring(current, [s], '10:00').state;
    });
    expect(current.log).toHaveLength(1);
  });

  it('resets a flicker: a one-sample blip never reaches the feed', () => {
    let current = initialProctoringState();
    current = stepProctoring(current, [away], '10:00').state;
    current = stepProctoring(current, [sample('ana') as any], '10:01').state; // condition ended
    current = stepProctoring(current, [away], '10:02').state;

    expect(current.log).toEqual([]);
    expect(current.streak.get('ana::away')).toBe(1);
  });

  it('logs a brand-new event when a cleared condition recurs, and keeps ids unique', () => {
    let current = initialProctoringState();
    [away, away, sample('ana') as any, away, away].forEach(s => {
      current = stepProctoring(current, [s], '10:00').state;
    });

    expect(current.log.map(alert => alert.id)).toEqual(['live-away-ana-1', 'live-away-ana-2']);
  });

  it('keeps only the most recent events', () => {
    let current = initialProctoringState();
    ['a', 'b', 'c', 'd'].forEach(identity => {
      const s = sample(identity, { faces: 0 }) as any;
      current = stepProctoring(current, [s], '10:00').state;
      current = stepProctoring(current, [s], '10:00').state;
    });

    expect(current.log).toHaveLength(PROCTORING_FEED_MAX);
    expect(current.log.map(alert => alert.identity)).toEqual(['b', 'c', 'd']);
  });

  it('never mutates the previous state', () => {
    const before = initialProctoringState();
    stepProctoring(before, [away], '10:00');
    expect(before.streak.size).toBe(0);
    expect(before.log).toEqual([]);
  });

  it('ignores devices that cannot measure', () => {
    const { state } = stepProctoring(
      initialProctoringState(),
      [sample('m', { unsupported: true, cameraOff: true }) as any],
      '10:00'
    );
    expect(state.streak.size).toBe(0);
  });
});

describe('time labels', () => {
  const date = new Date(2026, 0, 5, 9, 4, 7);

  it('formats minute and second resolution with zero padding', async () => {
    const { formatTimeLabel, formatTimelineLabel } = await import('./liveAttention');
    expect(formatTimeLabel(date)).toBe('09:04');
    expect(formatTimelineLabel(date)).toBe('09:04:07');
  });
});
