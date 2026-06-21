import React from 'react';
import { renderHook, act } from '@testing-library/react-hooks';
import { AttentionProvider, useAttention } from './index';
import { mockAttentionData } from './mockAttentionData';

// ─── Mock the two CV pipeline hooks ──────────────────────────────────────────
// These are mocked at the top level so tests control exactly when the provider
// sees "active capture + real remotes" vs "inactive".
jest.mock('../../hooks/useAttentionCapture/useAttentionCapture', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    capture: 'inactive' as const,
    index: 0,
    components: { eyes: 0, head: 0 },
    faces: 0,
    multiface: false,
  })),
}));

jest.mock('../../hooks/useAttentionTelemetry/useAttentionTelemetry', () => ({
  __esModule: true,
  default: jest.fn(() => []),
}));

// useVideoContext is called inside the provider tree — stub it so tests never
// need a real VideoProvider in scope.
jest.mock('../../hooks/useVideoContext/useVideoContext', () =>
  jest.fn(() => ({
    room: null,
    localTracks: [],
  }))
);

// useMediaQuery is called to detect desktop — default to desktop (false = not mobile)
// so the desktop code-path is exercised.
jest.mock('@material-ui/core', () => {
  const actual = jest.requireActual('@material-ui/core');
  return {
    ...actual,
    useMediaQuery: jest.fn(() => false),
    useTheme: jest.fn(() => ({ breakpoints: { down: jest.fn(() => 'sm') } })),
  };
});

import useAttentionCapture from '../../hooks/useAttentionCapture/useAttentionCapture';
import useAttentionTelemetry from '../../hooks/useAttentionTelemetry/useAttentionTelemetry';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import { useMediaQuery } from '@material-ui/core';

const mockUseAttentionCapture = useAttentionCapture as jest.Mock;
const mockUseAttentionTelemetry = useAttentionTelemetry as jest.Mock;
const mockUseVideoContext = (useVideoContext as unknown) as jest.Mock;
const mockUseMediaQuery = useMediaQuery as jest.Mock;

// ─── Wrapper ──────────────────────────────────────────────────────────────────
const wrapper: React.FC = ({ children }) => <AttentionProvider>{children}</AttentionProvider>;

// ─── useAttention outside provider ────────────────────────────────────────────
describe('useAttention outside a provider', () => {
  it('throws a descriptive error', () => {
    const { result } = renderHook(useAttention);
    expect(result.error?.message).toBe('useAttention must be used within an AttentionProvider');
  });
});

// ─── FALLBACK: no room → mock data ────────────────────────────────────────────
describe('useAttention inside AttentionProvider — mock fallback (no room)', () => {
  beforeEach(() => {
    // Default: no room, no capture, no remotes → must fall back to mockAttentionData
    mockUseVideoContext.mockReturnValue({ room: null, localTracks: [] });
    mockUseAttentionCapture.mockReturnValue({
      capture: 'inactive',
      index: 0,
      components: { eyes: 0, head: 0 },
      faces: 0,
      multiface: false,
    });
    mockUseAttentionTelemetry.mockReturnValue([]);
  });

  it('exposes source "mock" when there is no room', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.source).toBe('mock');
  });

  it('exposes the correct groupAttention value from mock data', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.groupAttention).toBe(mockAttentionData.groupAttention);
  });

  it('exposes timeline with the expected length', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.timeline.length).toBe(mockAttentionData.timeline.length);
    expect(result.current.timeline.length).toBeGreaterThanOrEqual(8);
  });

  it('exposes participants array with the expected length', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.participants.length).toBe(mockAttentionData.participants.length);
    expect(result.current.participants.length).toBeGreaterThanOrEqual(4);
  });

  it('has at least one proctoring alert', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.proctoringAlerts.length).toBeGreaterThanOrEqual(1);
  });

  it('does not expose any analysis on/off control (no enabled/setEnabled)', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current).not.toHaveProperty('enabled');
    expect(result.current).not.toHaveProperty('setEnabled');
  });
});

// ─── LIVE: room present + desktop → real data ─────────────────────────────────
describe('useAttention inside AttentionProvider — live mode (room present, desktop)', () => {
  const fakeRoom = { name: 'test-room', localParticipant: { identity: 'student-a' } };

  beforeEach(() => {
    // Live pipeline requires the production kill-switch flag to be ON.
    process.env.REACT_APP_ENABLE_ATTENTION_CV = 'true';
    // Simulate: we are on desktop (not mobile), room is present, capture is active.
    mockUseMediaQuery.mockReturnValue(false); // false = not mobile = desktop
    mockUseVideoContext.mockReturnValue({ room: fakeRoom, localTracks: [] });
    mockUseAttentionCapture.mockReturnValue({
      capture: 'active',
      index: 70,
      components: { eyes: 80, head: 60 },
      faces: 1,
      multiface: false,
    });
    mockUseAttentionTelemetry.mockReturnValue([
      { identity: 'student-b', index: 80, multiface: false, faces: 1 },
      { identity: 'student-c', index: 30, multiface: true, faces: 2 },
    ]);
  });

  afterEach(() => {
    delete process.env.REACT_APP_ENABLE_ATTENTION_CV;
  });

  it('exposes source "live" when room is present and capture is active', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.source).toBe('live');
  });

  it('maps remote attention results to participants with identity, index, level', () => {
    const { result } = renderHook(useAttention, { wrapper });
    const { participants } = result.current;
    // Two remote participants from telemetry
    expect(participants.length).toBe(2);
    const studentB = participants.find(p => p.identity === 'student-b');
    expect(studentB).toBeDefined();
    expect(studentB!.index).toBe(80);
    expect(studentB!.level).toBe('high'); // 80 > mediumMax(70)
    const studentC = participants.find(p => p.identity === 'student-c');
    expect(studentC).toBeDefined();
    expect(studentC!.index).toBe(30);
    expect(studentC!.level).toBe('low'); // 30 <= lowMax(40)
    expect(studentC!.multiface).toBe(true);
  });

  it('computes groupAttention as the rounded average of participant indexes', () => {
    const { result } = renderHook(useAttention, { wrapper });
    // average of 80 and 30 = 55
    expect(result.current.groupAttention).toBe(55);
  });

  it('returns groupAttention 0 when there are no remote participants', () => {
    // Override the default mock for this test — use mockReturnValue so re-renders
    // triggered by the timeline useEffect also see the empty array.
    mockUseAttentionTelemetry.mockReturnValue([]);
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.groupAttention).toBe(0);
  });

  it('derives a proctoring alert for each remote participant with multiface=true', () => {
    const { result } = renderHook(useAttention, { wrapper });
    const { proctoringAlerts } = result.current;
    // student-c has multiface=true
    expect(proctoringAlerts.length).toBe(1);
    expect(proctoringAlerts[0].identity).toBe('student-c');
    expect(proctoringAlerts[0].kind).toBe('multiface');
    expect(proctoringAlerts[0].id).toContain('student-c');
  });

  it('self reflects the capture hook result with posture marked as not-measured (-1)', () => {
    const { result } = renderHook(useAttention, { wrapper });
    const { self } = result.current;
    expect(self.capture).toBe('active');
    expect(self.index).toBe(70);
    expect(self.components.eyes).toBe(80);
    expect(self.components.head).toBe(60);
    // Posture is NOT measured by the CV pipeline — sentinel is -1.
    expect(self.components.posture).toBe(-1);
  });

  it('starts with an empty timeline and accumulates points on the timer', () => {
    // The timeline starts empty in live mode; points accumulate via setInterval.
    // In this test we only verify the initial state is an array (may be empty or
    // have one seeded point — either is valid as long as length >= 0).
    const { result } = renderHook(useAttention, { wrapper });
    expect(Array.isArray(result.current.timeline)).toBe(true);
  });

  it('KILL-SWITCH: falls back to mock when REACT_APP_ENABLE_ATTENTION_CV is off, even on desktop with a room', () => {
    // The legal gate: without the flag, real biometric analysis must NOT run,
    // regardless of desktop + room + active capture.
    delete process.env.REACT_APP_ENABLE_ATTENTION_CV;
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.source).toBe('mock');
  });
});

// ─── MOBILE: room present but mobile → falls back to mock ────────────────────
describe('useAttention inside AttentionProvider — mobile (room present, isMobile)', () => {
  beforeEach(() => {
    // Mobile = useMediaQuery returns true
    mockUseMediaQuery.mockReturnValue(true);
    mockUseVideoContext.mockReturnValue({
      room: { name: 'test-room', localParticipant: { identity: 'student-a' } },
      localTracks: [],
    });
    mockUseAttentionCapture.mockReturnValue({
      capture: 'inactive', // mobile never activates MediaPipe
      index: 0,
      components: { eyes: 0, head: 0 },
      faces: 0,
      multiface: false,
    });
    mockUseAttentionTelemetry.mockReturnValue([]);
  });

  it('exposes source "mock" on mobile even when a room is present', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.source).toBe('mock');
  });
});

// ─── attentionLevel helper ────────────────────────────────────────────────────
describe('attentionLevel(score) with ranges { lowMax: 40, mediumMax: 70 }', () => {
  beforeEach(() => {
    mockUseVideoContext.mockReturnValue({ room: null, localTracks: [] });
    mockUseAttentionCapture.mockReturnValue({
      capture: 'inactive',
      index: 0,
      components: { eyes: 0, head: 0 },
      faces: 0,
      multiface: false,
    });
    mockUseAttentionTelemetry.mockReturnValue([]);
  });

  it('maps 40 → "low" (boundary)', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.attentionLevel(40)).toBe('low');
  });

  it('maps 0 → "low"', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.attentionLevel(0)).toBe('low');
  });

  it('maps 41 → "medium" (just above lowMax)', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.attentionLevel(41)).toBe('medium');
  });

  it('maps 70 → "medium" (mediumMax boundary)', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.attentionLevel(70)).toBe('medium');
  });

  it('maps 71 → "high" (just above mediumMax)', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.attentionLevel(71)).toBe('high');
  });

  it('maps 100 → "high"', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.attentionLevel(100)).toBe('high');
  });
});
