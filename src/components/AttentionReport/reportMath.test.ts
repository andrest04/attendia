import { AttentionTimelinePoint } from '../AttentionProvider/types';
import { averageOverTime, downsampleTimeline, MAX_REPORT_TIMELINE_POINTS, percentTimeAboveThreshold } from './reportMath';

const points = (n: number, value: (i: number) => number): AttentionTimelinePoint[] =>
  Array.from({ length: n }, (_, i) => ({ time: `t${i}`, value: value(i) }));

describe('averageOverTime', () => {
  it('returns 0 for an empty timeline', () => {
    expect(averageOverTime([])).toBe(0);
  });

  it('rounds the mean of the values', () => {
    expect(averageOverTime(points(3, i => [40, 80, 90][i]))).toBe(70); // 210/3 = 70
  });
});

describe('percentTimeAboveThreshold', () => {
  it('returns 0 for an empty timeline', () => {
    expect(percentTimeAboveThreshold([], 60)).toBe(0);
  });

  it('returns the rounded percentage of points at/above the threshold', () => {
    expect(percentTimeAboveThreshold(points(4, i => [40, 80, 90, 90][i]), 60)).toBe(75);
  });
});

describe('downsampleTimeline', () => {
  it('is a no-op when the input is already within budget', () => {
    const input = points(5, i => i * 10);
    expect(downsampleTimeline(input, 200)).toBe(input); // same reference — no copy
  });

  it('is a no-op at exactly maxPoints', () => {
    const input = points(200, i => i);
    expect(downsampleTimeline(input, 200)).toBe(input);
  });

  it('returns an empty array unchanged', () => {
    expect(downsampleTimeline([], 200)).toEqual([]);
  });

  it('is a no-op when maxPoints <= 0', () => {
    const input = points(10, i => i);
    expect(downsampleTimeline(input, 0)).toBe(input);
    expect(downsampleTimeline(input, -5)).toBe(input);
  });

  it('bucket-averages an exact multiple down to maxPoints, preserving every value', () => {
    // 10 points, 2 buckets of 5 each: [0..4] avg=2, [5..9] avg=7.
    const input = points(10, i => i);
    const result = downsampleTimeline(input, 2);
    expect(result.length).toBe(2);
    expect(result[0].value).toBe(2);
    expect(result[1].value).toBe(7);
    // Label = the bucket's last (most recent) point.
    expect(result[0].time).toBe('t4');
    expect(result[1].time).toBe('t9');
  });

  it('bucket-averages a non-exact multiple, distributing the remainder across buckets', () => {
    // 7 points into 3 buckets: sizes 3,2,2 (via floor((b*n)/maxPoints) boundaries).
    const input = points(7, i => i * 10); // 0,10,20,30,40,50,60
    const result = downsampleTimeline(input, 3);
    expect(result.length).toBe(3);
    // bucket boundaries: [0,2)->0,1 wait computed below via floor formula
    // b=0: start=floor(0*7/3)=0, end=floor(1*7/3)=2 -> [0,10] avg=5
    // b=1: start=floor(1*7/3)=2, end=floor(2*7/3)=4 -> [20,30] avg=25
    // b=2: start=floor(2*7/3)=4, end=floor(3*7/3)=7 -> [40,50,60] avg=50
    expect(result.map(p => p.value)).toEqual([5, 25, 50]);
  });

  it('the length invariant holds: min(input.length, maxPoints)', () => {
    expect(downsampleTimeline(points(50, i => i), 200).length).toBe(50);
    expect(downsampleTimeline(points(500, i => i), 200).length).toBe(200);
  });

  it('preserves the overall average across a large downsample (no data silently dropped)', () => {
    const size = MAX_REPORT_TIMELINE_POINTS + 1000;
    const input = points(size, i => (i % 2 === 0 ? 0 : 100)); // true mean 50
    const result = downsampleTimeline(input, MAX_REPORT_TIMELINE_POINTS);
    expect(result.length).toBeLessThanOrEqual(MAX_REPORT_TIMELINE_POINTS);
    expect(averageOverTime(result)).toBe(50);
  });
});
