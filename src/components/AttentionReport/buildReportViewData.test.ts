import { buildReportViewData, LiveReportSource } from './buildReportViewData';
import { MAX_REPORT_TIMELINE_POINTS } from './reportMath';
import { AttentionLevel } from '../AttentionProvider/types';

const attentionLevel = (score: number): AttentionLevel => {
  if (score <= 40) return 'low';
  if (score <= 70) return 'medium';
  return 'high';
};

const baseInput: LiveReportSource = {
  sessionName: 'matematicas-2a',
  studentCount: 2,
  source: 'live',
  groupAttention: 55,
  groupDataAvailable: true,
  attentionThreshold: 60,
  timeline: [
    { time: '10:00:00', value: 40 },
    { time: '10:00:01', value: 80 },
    { time: '10:00:02', value: 90 },
    { time: '10:00:03', value: 90 },
  ],
  participants: [
    { identity: 'Ana García', index: 85, level: 'high', multiface: false, cameraOff: false, indexAvg: 83 },
    { identity: 'Beto Díaz', index: 30, level: 'low', multiface: true, cameraOff: false },
  ],
  proctoringAlerts: [{ id: 'a1', identity: 'Beto Díaz', kind: 'multiface', detectedAt: '10:02', detectedAtMs: 0, confidence: 1 }],
  attentionLevel,
  reportDate: new Date('2026-06-20T10:00:00Z'),
};

describe('buildReportViewData', () => {
  it('computes groupAverage/percentAboveThreshold from the full-resolution timeline param', () => {
    const view = buildReportViewData(baseInput);
    // Time-average of [40, 80, 90, 90] = 75; 3 of 4 points ≥ 60 → 75%.
    expect(view.groupAverage).toBe(75);
    expect(view.percentAboveThreshold).toBe(75);
  });

  it('persists the timeline unchanged when under the report cap', () => {
    const view = buildReportViewData(baseInput);
    expect(view.timeline).toEqual(baseInput.timeline);
  });

  it('falls back to the live groupAttention snapshot when the timeline is empty', () => {
    const view = buildReportViewData({ ...baseInput, timeline: [] });
    expect(view.groupAverage).toBe(baseInput.groupAttention);
    expect(view.percentAboveThreshold).toBe(0);
    expect(view.hasGroupData).toBe(true); // groupDataAvailable still true
  });

  it('downsamples an over-cap timeline while computing stats from full resolution', () => {
    const size = MAX_REPORT_TIMELINE_POINTS + 1000;
    const bigTimeline = Array.from({ length: size }, (_, i) => ({
      time: `t${i}`,
      value: i % 2 === 0 ? 0 : 100,
    }));
    const view = buildReportViewData({ ...baseInput, timeline: bigTimeline });
    expect(view.timeline.length).toBeLessThanOrEqual(MAX_REPORT_TIMELINE_POINTS);
    expect(view.timeline.length).toBeGreaterThan(0);
    expect(view.groupAverage).toBe(50);
  });

  it('passes studentCount and participants through, folding alert counts per identity', () => {
    const view = buildReportViewData(baseInput);
    expect(view.studentCount).toBe(2);
    const beto = view.participants.find(p => p.identity === 'Beto Díaz')!;
    expect(beto.alertCount).toBe(1);
    const ana = view.participants.find(p => p.identity === 'Ana García')!;
    expect(ana.alertCount).toBe(0);
  });
});
