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
      { identity: 'student-b', index: 80, multiface: false, faces: 1, cameraOff: false },
      { identity: 'student-c', index: 30, multiface: true, faces: 2, cameraOff: false },
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

  it('logs a multiface proctoring alert once the condition survives the debounce', () => {
    // The feed is an event LOG sampled on an interval — an alert appears only
    // after the condition holds for PROCTORING_DEBOUNCE_SAMPLES (2) samples, not
    // synchronously on first render.
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-06-20T10:22:00Z'));
      const { result, unmount } = renderHook(useAttention, { wrapper });
      // Nothing yet — the debounce window has not elapsed.
      expect(result.current.proctoringAlerts.length).toBe(0);
      act(() => {
        jest.advanceTimersByTime(2000); // two samples → debounce cleared
      });
      const { proctoringAlerts } = result.current;
      // student-c has multiface=true (faces=2)
      expect(proctoringAlerts.length).toBe(1);
      expect(proctoringAlerts[0].identity).toBe('student-c');
      expect(proctoringAlerts[0].kind).toBe('multiface');
      expect(proctoringAlerts[0].id).toContain('student-c');
      unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not log until the condition outlives the debounce window (anti-flicker)', () => {
    jest.useFakeTimers();
    try {
      const { result, unmount } = renderHook(useAttention, { wrapper });
      act(() => {
        jest.advanceTimersByTime(1000); // a single sample — below the debounce
      });
      expect(result.current.proctoringAlerts.length).toBe(0);
      act(() => {
        jest.advanceTimersByTime(1000); // second consecutive sample → logs
      });
      expect(result.current.proctoringAlerts.length).toBe(1);
      unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('stamps detectedAt when the alert is logged and keeps it stable afterwards', () => {
    // detectedAt captures the instant the event is logged (after the debounce),
    // and must NOT drift forward while the same condition persists.
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-06-20T10:22:00Z')); // TZ=utc → "10:22"
      const { result, unmount } = renderHook(useAttention, { wrapper });
      act(() => {
        jest.advanceTimersByTime(2000); // logs at ~10:22
      });
      expect(result.current.proctoringAlerts[0].detectedAt).toBe('10:22');

      // Clock moves forward; student-c is still multiface — no new event, same stamp.
      act(() => {
        jest.setSystemTime(new Date('2026-06-20T10:25:00Z'));
        jest.advanceTimersByTime(3000);
      });
      expect(result.current.proctoringAlerts.length).toBe(1);
      expect(result.current.proctoringAlerts[0].detectedAt).toBe('10:22');
      unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps a logged alert after its condition clears and appends a fresh event on recurrence', () => {
    // The feed is HISTORY: an alert is NOT removed when the condition resolves
    // (e.g. the student fixes their framing). A later recurrence appends a NEW
    // event with a NEW timestamp instead of mutating the old one.
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-06-20T10:22:00Z'));
      const { result, rerender, unmount } = renderHook(useAttention, { wrapper });
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(result.current.proctoringAlerts.length).toBe(1);
      expect(result.current.proctoringAlerts[0].detectedAt).toBe('10:22');

      // Multiface clears for everyone (and attention recovers → no 'away' either).
      // rerender() runs OUTSIDE act (it self-wraps in act) so the telemetry ref is
      // refreshed BEFORE the interval ticks read it — matching this file's pattern.
      mockUseAttentionTelemetry.mockReturnValue([
        { identity: 'student-b', index: 80, multiface: false, faces: 1, cameraOff: false },
        { identity: 'student-c', index: 80, multiface: false, faces: 1, cameraOff: false },
      ]);
      jest.setSystemTime(new Date('2026-06-20T10:25:00Z'));
      rerender();
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      // The original event is still in the feed — history is never erased.
      expect(result.current.proctoringAlerts.length).toBe(1);
      expect(result.current.proctoringAlerts[0].detectedAt).toBe('10:22');

      // Multiface returns for student-c at a new time → a NEW event is appended.
      mockUseAttentionTelemetry.mockReturnValue([
        { identity: 'student-b', index: 80, multiface: false, faces: 1, cameraOff: false },
        { identity: 'student-c', index: 30, multiface: true, faces: 2, cameraOff: false },
      ]);
      jest.setSystemTime(new Date('2026-06-20T10:30:00Z'));
      rerender();
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(result.current.proctoringAlerts.length).toBe(2);
      const latest = result.current.proctoringAlerts[result.current.proctoringAlerts.length - 1];
      expect(latest.kind).toBe('multiface');
      expect(latest.detectedAt).toBe('10:30');
      unmount();
    } finally {
      jest.useRealTimers();
    }
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

  it('accumulates timeline points at ~1 Hz so the chart moves fluidly, not in 5 s steps', () => {
    // Fluidity #2: the render cadence drives a new point every second (not every
    // 5 s). Denser points + monotone interpolation make the curve advance smoothly.
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-06-20T10:00:00Z'));
      const { result, unmount } = renderHook(useAttention, { wrapper });
      const seededLength = result.current.timeline.length; // one immediate seed point

      act(() => {
        jest.advanceTimersByTime(3000); // three seconds
      });

      // At 1 Hz, ~3 more points should have been pushed in 3 seconds.
      expect(result.current.timeline.length).toBeGreaterThanOrEqual(seededLength + 2);
      // Unmount under fake timers so the interval is cleared before we hand control
      // back to real timers — otherwise a live interval leaks into the next test.
      unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('timeline value tracks the CURRENT group average, not a stale empty snapshot (regression)', () => {
    // Bug: push() closed over remoteAttention from the render where isActive
    // flipped true (empty at that instant), so every interval tick wrote 0 even
    // after remotes arrived — the gauge read 91 while the chart sat flat at 0.
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-06-20T10:00:00Z'));
      // Start with NO remotes (telemetry has not aggregated yet).
      mockUseAttentionTelemetry.mockReturnValue([]);
      const { result, rerender, unmount } = renderHook(useAttention, { wrapper });

      // Remotes arrive after activation: one participant at index 90.
      mockUseAttentionTelemetry.mockReturnValue([
        { identity: 'student-b', index: 90, multiface: false, faces: 1, cameraOff: false },
      ]);
      // Re-render (library wraps this in act) so the latest-value ref picks up the
      // new telemetry, THEN advance the timer so the interval tick reads it.
      rerender();
      act(() => {
        jest.advanceTimersByTime(1000); // one tick AFTER the remote arrived
      });

      const last = result.current.timeline[result.current.timeline.length - 1];
      expect(last.value).toBe(90);
      unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('tracks per-student index history (min/max/avg) over the session', () => {
    // The per-student report detail needs each student's lowest, highest, and
    // time-averaged index — accumulated at 1 Hz from their telemetry, not just
    // the latest snapshot.
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-06-21T10:00:00Z'));
      const one = (index: number) => [{ identity: 'student-x', index, multiface: false, faces: 1, cameraOff: false }];

      mockUseAttentionTelemetry.mockReturnValue(one(50));
      const { result, rerender, unmount } = renderHook(useAttention, { wrapper }); // seed sample: 50

      mockUseAttentionTelemetry.mockReturnValue(one(90));
      rerender();
      act(() => {
        jest.advanceTimersByTime(1000); // sample: 90
      });

      mockUseAttentionTelemetry.mockReturnValue(one(70));
      rerender();
      act(() => {
        jest.advanceTimersByTime(1000); // sample: 70
      });

      const sx = result.current.participants.find(p => p.identity === 'student-x')!;
      expect(sx.indexMin).toBe(50);
      expect(sx.indexMax).toBe(90);
      expect(sx.indexAvg).toBe(70); // (50 + 90 + 70) / 3
      unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('labels live timeline points with second-level resolution (HH:MM:SS)', () => {
    // Fluidity #3: HH:MM labels collapse all points of the same minute onto one
    // tick, which reads as a flat step. Second-level labels let the axis advance.
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-06-20T10:00:07Z')); // TZ=utc → "10:00:07"
      const { result } = renderHook(useAttention, { wrapper });
      expect(result.current.timeline[0].time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps proctoring alert detectedAt at minute resolution (HH:MM), not seconds', () => {
    // The timeline gained seconds, but alert timestamps must stay HH:MM — a
    // proctoring event is reported by the minute, and existing tests depend on it.
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-06-20T10:22:33Z'));
      const { result, unmount } = renderHook(useAttention, { wrapper });
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(result.current.proctoringAlerts[0].detectedAt).toBe('10:22');
      unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('logs an "absent" alert when a participant has the camera on but no face detected', () => {
    mockUseAttentionTelemetry.mockReturnValue([
      { identity: 'student-b', index: 0, multiface: false, faces: 0, cameraOff: false },
    ]);
    jest.useFakeTimers();
    try {
      const { result, unmount } = renderHook(useAttention, { wrapper });
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      const alert = result.current.proctoringAlerts.find(a => a.kind === 'absent');
      expect(alert).toBeDefined();
      expect(alert!.identity).toBe('student-b');
      unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('logs an "away" alert when a single-face participant has sustained low attention', () => {
    mockUseAttentionTelemetry.mockReturnValue([
      { identity: 'student-b', index: 20, multiface: false, faces: 1, cameraOff: false },
    ]);
    jest.useFakeTimers();
    try {
      const { result, unmount } = renderHook(useAttention, { wrapper });
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      const alert = result.current.proctoringAlerts.find(a => a.kind === 'away');
      expect(alert).toBeDefined();
      expect(alert!.identity).toBe('student-b');
      unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps only the last 3 events when more conditions fire than the feed holds', () => {
    mockUseAttentionTelemetry.mockReturnValue([
      { identity: 's1', index: 0, multiface: false, faces: 0, cameraOff: false },
      { identity: 's2', index: 0, multiface: false, faces: 0, cameraOff: false },
      { identity: 's3', index: 0, multiface: false, faces: 0, cameraOff: false },
      { identity: 's4', index: 0, multiface: false, faces: 0, cameraOff: false },
    ]);
    jest.useFakeTimers();
    try {
      const { result, unmount } = renderHook(useAttention, { wrapper });
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(result.current.proctoringAlerts.length).toBe(3);
      unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('excludes a camera-off participant from the group average', () => {
    mockUseAttentionTelemetry.mockReturnValue([
      { identity: 'student-b', index: 80, multiface: false, faces: 1, cameraOff: false },
      { identity: 'student-c', index: 91, multiface: false, faces: 1, cameraOff: true },
    ]);
    const { result } = renderHook(useAttention, { wrapper });
    // Only the camera-on participant (80) counts; the stale 91 is excluded.
    expect(result.current.groupAttention).toBe(80);
  });

  it('camera-off participant carries cameraOff:true in participants[]', () => {
    mockUseAttentionTelemetry.mockReturnValue([
      { identity: 'student-b', index: 80, multiface: false, faces: 1, cameraOff: false },
      { identity: 'student-c', index: 91, multiface: false, faces: 1, cameraOff: true },
    ]);
    const { result } = renderHook(useAttention, { wrapper });
    const studentC = result.current.participants.find(p => p.identity === 'student-c');
    expect(studentC).toBeDefined();
    expect(studentC!.cameraOff).toBe(true);
  });

  it('emits a camera-off proctoring alert for a cameraOff participant', () => {
    mockUseAttentionTelemetry.mockReturnValue([
      { identity: 'student-b', index: 80, multiface: false, faces: 1, cameraOff: false },
      { identity: 'student-c', index: 91, multiface: false, faces: 1, cameraOff: true },
    ]);
    jest.useFakeTimers();
    try {
      const { result, unmount } = renderHook(useAttention, { wrapper });
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      const cameraOffAlert = result.current.proctoringAlerts.find(a => a.kind === 'camera-off');
      expect(cameraOffAlert).toBeDefined();
      expect(cameraOffAlert!.identity).toBe('student-c');
      expect(cameraOffAlert!.id).toContain('student-c');
      unmount();
    } finally {
      jest.useRealTimers();
    }
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
