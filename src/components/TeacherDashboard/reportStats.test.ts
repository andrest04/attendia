import { startOfWeekMs, buildReportStats } from './reportStats';
import { StoredAttentionReport } from '../../components/AttentionProvider/reportTypes';

function makeReport(overrides: Partial<StoredAttentionReport> = {}): StoredAttentionReport {
  return {
    roomSid: 'RM-1',
    roomName: 'matematicas-grupo-a',
    endReason: 'ended-for-all',
    source: 'live',
    studentCount: 2,
    attentionThreshold: 60,
    ranges: { low: 0, medium: 0, high: 0 } as any,
    groupAverage: 72,
    percentAboveThreshold: 80,
    timeline: [],
    participants: [],
    proctoringAlerts: [],
    startedAtIso: '2026-07-08T09:00:00.000Z',
    endedAtIso: '2026-07-08T10:00:00.000Z',
    durationMs: 3600000,
    recordingWasActiveAtEnd: false,
    endedAtMs: new Date(2026, 6, 8, 10, 0, 0).getTime(),
    ...overrides,
  };
}

describe('startOfWeekMs', () => {
  it('returns the preceding Monday 00:00:00 for a mid-week timestamp', () => {
    // Wednesday, July 8 2026, 3:45 pm
    const nowMs = new Date(2026, 6, 8, 15, 45, 0).getTime();
    const expected = new Date(2026, 6, 6, 0, 0, 0, 0).getTime();

    expect(startOfWeekMs(nowMs)).toBe(expected);
  });

  it('returns the same-day 00:00:00 when the timestamp is itself a Monday', () => {
    // Monday, July 6 2026, 9:00 am
    const nowMs = new Date(2026, 6, 6, 9, 0, 0).getTime();
    const expected = new Date(2026, 6, 6, 0, 0, 0, 0).getTime();

    expect(startOfWeekMs(nowMs)).toBe(expected);
  });
});

describe('buildReportStats', () => {
  // Wednesday, July 8 2026, 3:45 pm — week start is Monday July 6, 00:00.
  const NOW_MS = new Date(2026, 6, 8, 15, 45, 0).getTime();

  it('returns all zeros for an empty reports array', () => {
    expect(buildReportStats([], NOW_MS)).toEqual({
      sessionsThisWeek: 0,
      activeStudents: 0,
      avgAttentionPercent: 0,
    });
  });

  it('excludes reports with endedAtMs: null', () => {
    const nullEnded = makeReport({ endedAtMs: null });

    expect(buildReportStats([nullEnded], NOW_MS)).toEqual({
      sessionsThisWeek: 0,
      activeStudents: 0,
      avgAttentionPercent: 0,
    });
  });

  it('excludes reports from before the current week', () => {
    // Sunday, July 5 2026 — the calendar day before this week's Monday.
    const lastWeek = makeReport({
      endedAtMs: new Date(2026, 6, 5, 23, 59, 0).getTime(),
    });

    expect(buildReportStats([lastWeek], NOW_MS)).toEqual({
      sessionsThisWeek: 0,
      activeStudents: 0,
      avgAttentionPercent: 0,
    });
  });

  it('dedups repeated student identities across multiple reports into activeStudents', () => {
    const reportA = makeReport({
      groupAverage: 70,
      participants: [
        { identity: 'Ana', indexAvg: 70, indexMin: 60, indexMax: 80, level: 'high', alertCount: 0 } as any,
        { identity: 'Beto', indexAvg: 70, indexMin: 60, indexMax: 80, level: 'high', alertCount: 0 } as any,
      ],
    });
    const reportB = makeReport({
      groupAverage: 80,
      participants: [
        { identity: 'Ana', indexAvg: 70, indexMin: 60, indexMax: 80, level: 'high', alertCount: 0 } as any,
        { identity: 'Cami', indexAvg: 70, indexMin: 60, indexMax: 80, level: 'high', alertCount: 0 } as any,
      ],
    });

    const result = buildReportStats([reportA, reportB], NOW_MS);

    expect(result.sessionsThisWeek).toBe(2);
    expect(result.activeStudents).toBe(3);
  });

  it('computes avgAttentionPercent correctly, including rounding', () => {
    const reportA = makeReport({ groupAverage: 70 });
    const reportB = makeReport({ groupAverage: 71 });

    const result = buildReportStats([reportA, reportB], NOW_MS);

    // (70 + 71) / 2 = 70.5 -> rounds to 71
    expect(result.avgAttentionPercent).toBe(71);
  });
});
