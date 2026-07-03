import React from 'react';
import { act, renderHook } from '@testing-library/react-hooks';
import useAttentionReportSaver from './useAttentionReportSaver';
import { AttentionContext } from '../../components/AttentionProvider';
import { useAppState } from '../../state';
import useParticipants from '../useParticipants/useParticipants';
import useVideoContext from '../useVideoContext/useVideoContext';

jest.mock('../../state');
jest.mock('../useParticipants/useParticipants');
jest.mock('../useVideoContext/useVideoContext');

const mockUseAppState = useAppState as jest.Mock<any>;
const mockUseParticipants = useParticipants as jest.Mock<any>;
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
    mockSave = jest.fn(() => Promise.resolve());
    mockUseAppState.mockImplementation(() => ({ saveAttentionReport: mockSave }));
    mockUseParticipants.mockImplementation(() => [{ identity: 'Ana García' }, { identity: 'Beto Díaz' }]);
    mockUseVideoContext.mockImplementation(() => ({
      room: { sid: 'RM00000000000000000000000000000abc', name: 'matematicas-2a' },
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
  });

  it('passes the "left" end reason through', async () => {
    const { result } = renderHook(() => useAttentionReportSaver(), { wrapper: wrapperWith(baseAttention) });

    await act(async () => {
      await result.current.saveReport('left');
    });

    expect(mockSave.mock.calls[0][0].endReason).toBe('left');
  });

  it('falls back to the live group snapshot when the timeline is empty but data is available', async () => {
    const attention = { ...baseAttention, timeline: [], groupAttention: 62, groupDataAvailable: true };
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

  it('skips silently when there is genuinely no data (empty timeline, no live reading)', async () => {
    const attention = { ...baseAttention, timeline: [], groupDataAvailable: false };
    const { result } = renderHook(() => useAttentionReportSaver(), { wrapper: wrapperWith(attention) });

    await act(async () => {
      await result.current.saveReport('ended-for-all');
    });

    expect(mockSave).not.toHaveBeenCalled();
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

  it('never throws: a rejected save is swallowed with a console.error', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSave.mockRejectedValue(new Error('403 teacher only'));
    const { result } = renderHook(() => useAttentionReportSaver(), { wrapper: wrapperWith(baseAttention) });

    await act(async () => {
      await expect(result.current.saveReport('ended-for-all')).resolves.toBeUndefined();
    });

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('is a no-op when no AttentionProvider is mounted', async () => {
    const { result } = renderHook(() => useAttentionReportSaver());

    await act(async () => {
      await expect(result.current.saveReport('ended-for-all')).resolves.toBeUndefined();
    });

    expect(mockSave).not.toHaveBeenCalled();
  });
});
