import React from 'react';
import { act, renderHook } from '@testing-library/react-hooks';
import useAttentionReportSaver from './useAttentionReportSaver';
import { AttentionContext } from '../../components/AttentionProvider';
import { useAppState } from '../../state';
import useVideoContext from '../useVideoContext/useVideoContext';
import {
  getPendingAttentionReports,
  savePendingAttentionReport,
} from '../../components/AttentionReport/pendingAttentionReports';
import { saveScheduledClassSession } from '../../classSession/classSessionContext';
import { MAX_REPORT_TIMELINE_POINTS } from '../../components/AttentionReport/reportMath';

jest.mock('../../state');
jest.mock('../useVideoContext/useVideoContext');

const mockUseAppState = useAppState as jest.Mock<any>;
const mockUseVideoContext = useVideoContext as jest.Mock<any>;

const attentionLevel = (score: number): 'high' | 'medium' | 'low' => {
  if (score <= 40) return 'low';
  if (score <= 70) return 'medium';
  return 'high';
};

const baseAttention = {
  source: 'live' as const,
  ranges: { lowMax: 40, mediumMax: 70 },
  groupAttention: 55,
  groupDataAvailable: true,
  attentionThreshold: 60,
  timeline: [
    { time: '10:00:00', value: 40 },
    { time: '10:00:01', value: 80 },
    { time: '10:00:02', value: 90 },
    { time: '10:00:03', value: 90 },
  ],
  fullTimeline: [
    { time: '10:00:00', value: 40 },
    { time: '10:00:01', value: 80 },
    { time: '10:00:02', value: 90 },
    { time: '10:00:03', value: 90 },
  ],
  self: { index: 0, components: { eyes: 0, posture: -1, head: 0 }, capture: 'inactive', lighting: 'ok' },
  participants: [
    {
      identity: 'Ana García',
      index: 85,
      level: 'high' as const,
      multiface: false,
      indexMin: 70,
      indexMax: 95,
      indexAvg: 83,
    },
    // No accumulated history — falls back to the latest index.
    { identity: 'Beto Díaz', index: 30, level: 'low' as const, multiface: true },
  ],
  proctoringAlerts: [
    { id: 'a1', identity: 'Beto Díaz', kind: 'multiface' as const, detectedAt: '10:02', confidence: 1 },
    { id: 'a2', identity: 'Beto Díaz', kind: 'away' as const, detectedAt: '10:05', confidence: 0.9 },
  ],
  attentionLevel,
};

const wrapperWith = (attention: any): React.FC => ({ children }) =>
  React.createElement(AttentionContext.Provider, { value: attention }, children);

describe('useAttentionReportSaver', () => {
  let mockSave: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    mockSave = jest.fn(() => Promise.resolve());
    mockUseAppState.mockImplementation(() => ({ saveAttentionReport: mockSave }));
    mockUseVideoContext.mockImplementation(() => ({
      room: { sid: 'RM00000000000000000000000000000abc', name: 'matematicas-2a', isRecording: true },
    }));
  });

  it('saves a report with the derived group metrics and per-student rows', async () => {
    const { result } = renderHook(() => useAttentionReportSaver(), { wrapper: wrapperWith(baseAttention) });

    await act(async () => {
      await result.current.saveReport('ended-for-all');
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    const report = mockSave.mock.calls[0][0];

    expect(report.roomSid).toBe('RM00000000000000000000000000000abc');
    expect(report.roomName).toBe('matematicas-2a');
    expect(report.endReason).toBe('ended-for-all');
    expect(report.source).toBe('live');
    expect(report.studentCount).toBe(2);
    // Time-average of [40, 80, 90, 90] = 75; 3 of 4 points ≥ 60 → 75%.
    expect(report.groupAverage).toBe(75);
    expect(report.percentAboveThreshold).toBe(75);
    expect(report.timeline).toEqual(baseAttention.timeline);

    // Row with history: avg drives the level; alert counts folded per identity.
    expect(report.participants[0]).toEqual({
      identity: 'Ana García',
      indexAvg: 83,
      indexMin: 70,
      indexMax: 95,
      level: 'high',
      alertCount: 0,
    });
    // Row without history falls back to the latest index across avg/min/max.
    expect(report.participants[1]).toEqual({
      identity: 'Beto Díaz',
      indexAvg: 30,
      indexMin: 30,
      indexMax: 30,
      level: 'low',
      alertCount: 2,
    });

    // Alerts persist only the display fields (no id/confidence).
    expect(report.proctoringAlerts).toEqual([
      { identity: 'Beto Díaz', kind: 'multiface', detectedAt: '10:02' },
      { identity: 'Beto Díaz', kind: 'away', detectedAt: '10:05' },
    ]);
    expect(typeof report.endedAtIso).toBe('string');
    expect(typeof report.startedAtIso).toBe('string');
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
    expect(report.recordingWasActiveAtEnd).toBe(true);
  });

  it('adds classId only from the persisted matching scheduled-class context', async () => {
    saveScheduledClassSession({ classId: 'class-42', roomName: 'matematicas-2a' });
    const { result } = renderHook(() => useAttentionReportSaver(), { wrapper: wrapperWith(baseAttention) });

    await act(async () => {
      await result.current.saveReport('ended-for-all');
    });

    expect(mockSave.mock.calls[0][0]).toEqual(
      expect.objectContaining({ classId: 'class-42', roomName: 'matematicas-2a' })
    );
  });

  it('passes the "left" end reason through', async () => {
    const { result } = renderHook(() => useAttentionReportSaver(), { wrapper: wrapperWith(baseAttention) });

    await act(async () => {
      await result.current.saveReport('left');
    });

    expect(mockSave.mock.calls[0][0].endReason).toBe('left');
  });

  it('falls back to the live group snapshot when the timeline is empty but data is available', async () => {
    const attention = {
      ...baseAttention,
      timeline: [],
      fullTimeline: [],
      groupAttention: 62,
      groupDataAvailable: true,
    };
    const { result } = renderHook(() => useAttentionReportSaver(), { wrapper: wrapperWith(attention) });

    await act(async () => {
      await result.current.saveReport('left');
    });

    expect(mockSave.mock.calls[0][0].groupAverage).toBe(62);
    expect(mockSave.mock.calls[0][0].percentAboveThreshold).toBe(0);
  });

  it('saves mock data with source "mock" so dev exercises the pipeline', async () => {
    const attention = { ...baseAttention, source: 'mock' as const };
    const { result } = renderHook(() => useAttentionReportSaver(), { wrapper: wrapperWith(attention) });

    await act(async () => {
      await result.current.saveReport('ended-for-all');
    });

    expect(mockSave.mock.calls[0][0].source).toBe('mock');
  });

  it('still saves when there is genuinely no attention data (e.g. zero students joined)', async () => {
    const attention = { ...baseAttention, timeline: [], fullTimeline: [], groupDataAvailable: false };
    const { result } = renderHook(() => useAttentionReportSaver(), { wrapper: wrapperWith(attention) });

    await act(async () => {
      await result.current.saveReport('ended-for-all');
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave.mock.calls[0][0].timeline).toEqual([]);
  });

  it('skips silently when the room has no SID', async () => {
    mockUseVideoContext.mockImplementation(() => ({ room: null }));
    const { result } = renderHook(() => useAttentionReportSaver(), { wrapper: wrapperWith(baseAttention) });

    await act(async () => {
      await result.current.saveReport('ended-for-all');
    });

    expect(mockSave).not.toHaveBeenCalled();
  });

  it('skips silently in non-firebase modes (no saveAttentionReport in app state)', async () => {
    mockUseAppState.mockImplementation(() => ({}));
    const { result } = renderHook(() => useAttentionReportSaver(), { wrapper: wrapperWith(baseAttention) });

    await act(async () => {
      await result.current.saveReport('ended-for-all');
    });

    expect(mockSave).not.toHaveBeenCalled();
  });

  it('queues a failed save for the signed-in teacher and never blocks leave', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSave.mockRejectedValue(new Error('403 teacher only'));
    mockUseAppState.mockImplementation(() => ({ saveAttentionReport: mockSave, user: { uid: 'teacher-1' } }));
    const { result } = renderHook(() => useAttentionReportSaver(), { wrapper: wrapperWith(baseAttention) });

    await act(async () => {
      await expect(result.current.saveReport('ended-for-all')).resolves.toBeUndefined();
    });

    expect(consoleError).toHaveBeenCalled();
    expect(getPendingAttentionReports('teacher-1')).toEqual([
      expect.objectContaining({ roomSid: 'RM00000000000000000000000000000abc' }),
    ]);
    consoleError.mockRestore();
  });

  it('removes a previously queued entry for the room after a successful save, leaving other rooms queued', async () => {
    window.localStorage.clear();
    mockUseAppState.mockImplementation(() => ({ saveAttentionReport: mockSave, user: { uid: 'teacher-1' } }));
    savePendingAttentionReport('teacher-1', { roomSid: 'RM00000000000000000000000000000abc' } as any);
    savePendingAttentionReport('teacher-1', { roomSid: 'RM00000000000000000000000000000def' } as any);
    const { result } = renderHook(() => useAttentionReportSaver(), { wrapper: wrapperWith(baseAttention) });

    await act(async () => {
      await result.current.saveReport('ended-for-all');
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(getPendingAttentionReports('teacher-1')).toEqual([
      expect.objectContaining({ roomSid: 'RM00000000000000000000000000000def' }),
    ]);
    window.localStorage.clear();
  });

  it('is a no-op when no AttentionProvider is mounted', async () => {
    const { result } = renderHook(() => useAttentionReportSaver());

    await act(async () => {
      await expect(result.current.saveReport('ended-for-all')).resolves.toBeUndefined();
    });

    expect(mockSave).not.toHaveBeenCalled();
  });

  it('studentCount reflects the cumulative attendance roster, not a live room participant list', async () => {
    // data.participants is the AttentionProvider's cumulative roster (includes
    // students who already left) — this hook no longer reads the live Room at all.
    const attention = {
      ...baseAttention,
      participants: [
        ...baseAttention.participants,
        { identity: 'Carla Ruiz (left already)', index: 50, level: 'medium' as const, multiface: false },
      ],
    };
    const { result } = renderHook(() => useAttentionReportSaver(), { wrapper: wrapperWith(attention) });

    await act(async () => {
      await result.current.saveReport('ended-for-all');
    });

    expect(mockSave.mock.calls[0][0].studentCount).toBe(3);
  });

  it('persists a full-resolution timeline unchanged when under the report cap', async () => {
    const attention = { ...baseAttention };
    const { result } = renderHook(() => useAttentionReportSaver(), { wrapper: wrapperWith(attention) });

    await act(async () => {
      await result.current.saveReport('ended-for-all');
    });

    expect(mockSave.mock.calls[0][0].timeline).toEqual(baseAttention.fullTimeline);
  });

  it('downsamples an over-cap fullTimeline while computing stats from full resolution', async () => {
    // Build a fullTimeline of MAX_REPORT_TIMELINE_POINTS + 1000 points, alternating
    // 0/100 so the true mean is 50 — a value that would visibly differ from what a
    // handful of downsampled buckets would produce if computed from the WRONG array.
    const size = MAX_REPORT_TIMELINE_POINTS + 1000;
    const bigTimeline = Array.from({ length: size }, (_, i) => ({
      time: `t${i}`,
      value: i % 2 === 0 ? 0 : 100,
    }));
    const attention = { ...baseAttention, fullTimeline: bigTimeline, timeline: [] };
    const { result } = renderHook(() => useAttentionReportSaver(), { wrapper: wrapperWith(attention) });

    await act(async () => {
      await result.current.saveReport('ended-for-all');
    });

    const report = mockSave.mock.calls[0][0];
    expect(report.timeline.length).toBeLessThanOrEqual(MAX_REPORT_TIMELINE_POINTS);
    expect(report.timeline.length).toBeGreaterThan(0);
    // Full-resolution 0/100 alternation averages to 50, regardless of downsampling.
    expect(report.groupAverage).toBe(50);
  });
});
