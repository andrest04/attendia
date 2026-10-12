import { buildAttentionReport } from './buildAttentionReport';

const point = (time: string, value: number) => ({ time, value });

const makeData = (overrides: any = {}): any => ({
  source: 'live',
  attentionThreshold: 60,
  ranges: { lowMax: 40, mediumMax: 70 },
  groupAttention: 72,
  fullTimeline: [point('00:01', 80), point('00:02', 40)],
  participants: [
    { identity: 'Ana', index: 90, indexAvg: 85, indexMin: 70, indexMax: 95 },
    { identity: 'Luis', index: 30 },
  ],
  proctoringAlerts: [
    { id: '1', identity: 'Luis', kind: 'away', detectedAt: '10:00', confidence: 0.9 },
    { id: '2', identity: 'Luis', kind: 'multiface', detectedAt: '10:05', confidence: 0.8 },
  ],
  attentionLevel: (score: number) => (score > 70 ? 'high' : score > 40 ? 'medium' : 'low'),
  ...overrides,
});

const room = { sid: 'RM1', name: 'algebra-1', isRecording: true };
const now = new Date('2026-03-01T12:00:00.000Z');

describe('buildAttentionReport', () => {
  it('snapshots the room, reason and session timing', () => {
    const report = buildAttentionReport({
      data: makeData(),
      room,
      endReason: 'ended-for-all',
      startedAtMs: now.getTime() - 5000,
      now,
    });

    expect(report).toMatchObject({
      roomSid: 'RM1',
      roomName: 'algebra-1',
      endReason: 'ended-for-all',
      source: 'live',
      studentCount: 2,
      attentionThreshold: 60,
      endedAtIso: '2026-03-01T12:00:00.000Z',
      startedAtIso: '2026-03-01T11:59:55.000Z',
      durationMs: 5000,
      recordingWasActiveAtEnd: true,
    });
  });

  it('has zero duration when the connection time was never observed', () => {
    const report = buildAttentionReport({ data: makeData(), room, endReason: 'left', startedAtMs: null, now });
    expect(report.durationMs).toBe(0);
    expect(report.startedAtIso).toBe(report.endedAtIso);
  });

  it('never reports a negative duration', () => {
    const report = buildAttentionReport({
      data: makeData(),
      room,
      endReason: 'left',
      startedAtMs: now.getTime() + 1000,
      now,
    });
    expect(report.durationMs).toBe(0);
  });

  it('uses the session time-average, falling back to the live group value with no history', () => {
    const withHistory = buildAttentionReport({ data: makeData(), room, endReason: 'left', startedAtMs: null, now });
    expect(withHistory.groupAverage).toBe(60); // (80 + 40) / 2

    const noHistory = buildAttentionReport({
      data: makeData({ fullTimeline: [] }),
      room,
      endReason: 'left',
      startedAtMs: null,
      now,
    });
    expect(noHistory.groupAverage).toBe(72);
  });

  it('folds the alert count per student and derives min/max/avg from the index when missing', () => {
    const report = buildAttentionReport({ data: makeData(), room, endReason: 'left', startedAtMs: null, now });

    expect(report.participants).toEqual([
      { identity: 'Ana', indexAvg: 85, indexMin: 70, indexMax: 95, level: 'high', alertCount: 0 },
      { identity: 'Luis', indexAvg: 30, indexMin: 30, indexMax: 30, level: 'low', alertCount: 2 },
    ]);
    expect(report.proctoringAlerts).toEqual([
      { identity: 'Luis', kind: 'away', detectedAt: '10:00' },
      { identity: 'Luis', kind: 'multiface', detectedAt: '10:05' },
    ]);
  });

  it('links the report to the scheduled class only when there is one', () => {
    const linked = buildAttentionReport({
      data: makeData(),
      room,
      endReason: 'left',
      startedAtMs: null,
      classId: 'c1',
      now,
    });
    const adHoc = buildAttentionReport({ data: makeData(), room, endReason: 'left', startedAtMs: null, now });

    expect(linked.classId).toBe('c1');
    expect(adHoc).not.toHaveProperty('classId');
  });

  it('treats a missing recording flag as not recording', () => {
    const report = buildAttentionReport({
      data: makeData(),
      room: { sid: 'RM1', name: 'x' },
      endReason: 'left',
      startedAtMs: null,
      now,
    });
    expect(report.recordingWasActiveAtEnd).toBe(false);
  });
});
