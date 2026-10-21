import React, { useContext } from 'react';
import { renderHook, act } from '@testing-library/react-hooks';
import { useMediaQuery } from '@material-ui/core';
import { AttentionProvider, AttentionRestoreContext, useAttention } from './index';
import { AttentionReport } from './reportTypes';
import useAttentionCapture from '../../hooks/useAttentionCapture/useAttentionCapture';
import useAttentionTelemetry from '../../hooks/useAttentionTelemetry/useAttentionTelemetry';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import * as utils from '../../utils';

// The device kind comes from the UA-based utils.isMobile (a module-level constant), which the
// tests overwrite the same way the rest of the suite does (MenuBar, ChatInput, useRoom).
function setMobileDevice(value: boolean) {
  //@ts-ignore
  utils.isMobile = value;
}

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

// The provider must NOT depend on the viewport width. useMediaQuery stays mocked so tests can
// prove that a narrow window (true) on a desktop device does not change the mode.
jest.mock('@material-ui/core', () => {
  const actual = jest.requireActual('@material-ui/core');
  return {
    ...actual,
    useMediaQuery: jest.fn(() => false),
    useTheme: jest.fn(() => ({ breakpoints: { down: jest.fn(() => 'sm') } })),
  };
});

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

// ─── OFF: no room → empty, honest value ──────────────────────────────────────
describe('useAttention inside AttentionProvider — pipeline off (no room)', () => {
  beforeEach(() => {
    // Default: no room, no capture, no remotes → must hand out the empty value, never fake data
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

  it('hands out an empty value with no simulated data', () => {
    const { result } = renderHook(useAttention, { wrapper });
    const { attentionLevel, ...data } = result.current;
    expect(data).toEqual({
      source: 'live',
      ranges: { lowMax: 40, mediumMax: 70 },
      groupAttention: 0,
      groupDataAvailable: false,
      attentionThreshold: 60,
      timeline: [],
      fullTimeline: [],
      self: {
        index: 0,
        components: { eyes: 0, head: 0, posture: -1 },
        capture: 'inactive',
        lighting: 'ok',
      },
      participants: [],
      proctoringAlerts: [],
    });
    expect(typeof attentionLevel).toBe('function');
  });

  it('keeps the same value identity across re-renders', () => {
    const { result, rerender } = renderHook(useAttention, { wrapper });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('does not expose any analysis on/off control (no enabled/setEnabled)', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current).not.toHaveProperty('enabled');
    expect(result.current).not.toHaveProperty('setEnabled');
  });
});

// Minimal Twilio Room stub: a real EventEmitter-like object so the
// attendedIdentitiesRef effect (room.participants / room.on / room.off) has
// something to call. `participants` is a Map (matches the real SDK shape:
// keyed by participant SID, but only `.forEach`/`.values` are used here).
function createFakeRoom(name = 'test-room', identity = 'student-a') {
  const listeners: Record<string, Array<(...args: any[]) => void>> = {};
  return {
    name,
    localParticipant: { identity },
    participants: new Map(),
    on: jest.fn((event: string, handler: (...args: any[]) => void) => {
      (listeners[event] = listeners[event] || []).push(handler);
    }),
    off: jest.fn((event: string, handler: (...args: any[]) => void) => {
      listeners[event] = (listeners[event] || []).filter(h => h !== handler);
    }),
    emit(event: string, ...args: any[]) {
      (listeners[event] || []).forEach(h => h(...args));
    },
  };
}

// ─── LIVE: room present + desktop → real data ─────────────────────────────────
describe('useAttention inside AttentionProvider — live mode (room present, desktop)', () => {
  const fakeRoom = createFakeRoom();

  beforeEach(() => {
    // Live pipeline requires the production kill-switch flag to be ON.
    process.env.REACT_APP_ENABLE_ATTENTION_CV = 'true';
    // Simulate: we are on a desktop device with a wide window, room is present, capture is active.
    setMobileDevice(false);
    mockUseMediaQuery.mockReturnValue(false);
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

  it('stays live on a desktop device whose window is narrower than the md breakpoint', () => {
    // A teacher who narrows the laptop window is still on a laptop: the mode must not flip to
    // mobile-beacon (which would wipe the timeline/proctoring history).
    mockUseMediaQuery.mockReturnValue(true);
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

  it('flags groupDataAvailable false when no measured participants (placeholder 0, not real 0)', () => {
    mockUseAttentionTelemetry.mockReturnValue([]);
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.groupDataAvailable).toBe(false);
  });

  it('flags groupDataAvailable true when at least one camera-on remote is present', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.groupDataAvailable).toBe(true);
  });

  it('treats an all-camera-off group as no data (groupDataAvailable false)', () => {
    mockUseAttentionTelemetry.mockReturnValue([
      { identity: 'a', index: 0, multiface: false, faces: 0, cameraOff: true },
      { identity: 'b', index: 0, multiface: false, faces: 0, cameraOff: true },
    ]);
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.groupDataAvailable).toBe(false);
  });

  it('excludes a face-not-detected (faces 0) participant from the group average', () => {
    // The faces-0 student has a decayed placeholder index 0, NOT real 0% attention.
    // Average must be 80 (the measured one), not (80+0)/2 = 40.
    mockUseAttentionTelemetry.mockReturnValue([
      { identity: 'a', index: 80, multiface: false, faces: 1, cameraOff: false, unsupported: false },
      { identity: 'b', index: 0, multiface: false, faces: 0, cameraOff: false, unsupported: false },
    ]);
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.groupAttention).toBe(80);
    expect(result.current.groupDataAvailable).toBe(true);
  });

  it('excludes a mobile (unsupported) participant from the group average and proctoring', () => {
    mockUseAttentionTelemetry.mockReturnValue([
      { identity: 'a', index: 80, multiface: false, faces: 1, cameraOff: false, unsupported: false },
      { identity: 'mobile', index: 0, multiface: false, faces: 0, cameraOff: false, unsupported: true },
    ]);
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.groupAttention).toBe(80);
    // The mobile entry is still listed as a participant (so the UI can show it),
    // but carries the unsupported flag through.
    expect(result.current.participants.find(p => p.identity === 'mobile')!.unsupported).toBe(true);
  });

  it('groupDataAvailable false when the only remote has no detectable face', () => {
    mockUseAttentionTelemetry.mockReturnValue([
      { identity: 'a', index: 0, multiface: false, faces: 0, cameraOff: false, unsupported: false },
    ]);
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.groupDataAvailable).toBe(false);
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
        jest.setSystemTime(new Date('2026-06-20T10:23:00Z'));
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
      jest.setSystemTime(new Date('2026-06-20T10:23:00Z'));
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
      jest.setSystemTime(new Date('2026-06-20T10:23:50Z'));
      rerender();
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(result.current.proctoringAlerts.length).toBe(2);
      const latest = result.current.proctoringAlerts[result.current.proctoringAlerts.length - 1];
      expect(latest.kind).toBe('multiface');
      expect(latest.detectedAt).toBe('10:23');
      unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('expires an alert from the live feed after the TTL but keeps it in the full log', () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-06-20T10:22:00Z'));
      const { result, unmount } = renderHook(useAttention, { wrapper });
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(result.current.proctoringAlerts.length).toBe(1);

      act(() => {
        jest.advanceTimersByTime(2 * 60 * 1000);
      });
      expect(result.current.proctoringAlerts.length).toBe(0);
      expect(result.current.proctoringLog!.length).toBe(1);
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

  it('fullTimeline keeps growing past the 90-point live-chart cap', () => {
    // `timeline` (the live in-room chart) is a 90-point rolling window; `fullTimeline`
    // (report generation's source of truth) must NOT be capped at 90 — otherwise the
    // "Evolución temporal" report chart only ever shows the last ~90 seconds.
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-06-23T10:00:00Z'));
      const { result, unmount } = renderHook(useAttention, { wrapper });

      act(() => {
        jest.advanceTimersByTime(95_000); // 95 ticks — past the 90-point cap
      });

      expect(result.current.timeline.length).toBeLessThanOrEqual(90);
      expect(result.current.fullTimeline.length).toBeGreaterThan(90);
      unmount();
    } finally {
      jest.useRealTimers();
    }
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

  it('keeps a departed student in participants[] with their accumulated history (report accuracy)', () => {
    // A student who disconnects before the professor builds/saves the report must
    // still appear (with their historical min/max/avg) — the report must not
    // collapse to 0 just because everyone already left.
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-06-22T10:00:00Z'));
      const one = (index: number) => [{ identity: 'student-x', index, multiface: false, faces: 1, cameraOff: false }];

      mockUseAttentionTelemetry.mockReturnValue(one(50));
      const { result, rerender, unmount } = renderHook(useAttention, { wrapper }); // seed sample: 50

      mockUseAttentionTelemetry.mockReturnValue(one(90));
      rerender();
      act(() => {
        jest.advanceTimersByTime(1000); // sample: 90 → history { min:50, max:90 }
      });

      // student-x leaves: telemetry no longer reports them.
      mockUseAttentionTelemetry.mockReturnValue([]);
      rerender();
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      const sx = result.current.participants.find(p => p.identity === 'student-x')!;
      expect(sx).toBeDefined();
      expect(sx.indexMin).toBe(50);
      expect(sx.indexMax).toBe(90);
      expect(sx.indexAvg).toBe(70); // (50 + 90) / 2
      expect(sx.cameraOff).toBe(true); // honestly excluded from the live gauge
      unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('a same-identity rejoin CONTINUES the same history instead of resetting it', () => {
    // The opposite of double-counting: a student who leaves and rejoins with the
    // same identity must extend their existing min/max/avg, not start fresh (which
    // would also make them look like a second, separate student in the report).
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-06-22T10:00:00Z'));
      const one = (index: number) => [{ identity: 'student-x', index, multiface: false, faces: 1, cameraOff: false }];

      mockUseAttentionTelemetry.mockReturnValue(one(50));
      const { result, rerender, unmount } = renderHook(useAttention, { wrapper }); // seed sample: 50

      mockUseAttentionTelemetry.mockReturnValue(one(90));
      rerender();
      act(() => {
        jest.advanceTimersByTime(1000); // sample: 90 → history { min:50, max:90 }
      });

      // student-x leaves.
      mockUseAttentionTelemetry.mockReturnValue([]);
      rerender();
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // student-x rejoins with the same identity at a fresh index.
      mockUseAttentionTelemetry.mockReturnValue(one(70));
      rerender();
      act(() => {
        jest.advanceTimersByTime(1000); // sample: 70 → history extends to { min:50, max:90, +70 }
      });

      const sx = result.current.participants.find(p => p.identity === 'student-x')!;
      // Old 50/90 must survive the rejoin — history continues, doesn't reset.
      expect(sx.indexMin).toBe(50);
      expect(sx.indexMax).toBe(90);
      expect(sx.indexAvg).toBe(70); // (50 + 90 + 70) / 3
      // And critically: only ONE row for student-x, not two.
      expect(result.current.participants.filter(p => p.identity === 'student-x').length).toBe(1);
      unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('counts a student who joined the Room but was never measured by the CV pipeline', () => {
    // e.g. mobile/unsupported, or camera off the whole session — they must still
    // show up in the attendance roster, just with no measured attention data.
    const room = createFakeRoom();
    mockUseVideoContext.mockReturnValue({ room, localTracks: [] });
    mockUseAttentionTelemetry.mockReturnValue([]); // never produced a telemetry sample

    const { result, rerender } = renderHook(useAttention, { wrapper });

    room.emit('participantConnected', { identity: 'student-never-measured' });
    // Mutating the ref doesn't itself trigger a re-render (same pattern as the
    // "reads latest telemetry ref" test above) — force one to observe it.
    rerender();

    const row = result.current.participants.find(p => p.identity === 'student-never-measured');
    expect(row).toBeDefined();
    expect(row!.faces).toBe(0); // never measured → UI renders "sin medición"
    expect(row!.indexMin).toBeUndefined();
  });

  it('a student already in room.participants at mount is counted without a participantConnected event', () => {
    const room = createFakeRoom();
    room.participants.set('SID123', { identity: 'student-already-there' });
    mockUseVideoContext.mockReturnValue({ room, localTracks: [] });
    mockUseAttentionTelemetry.mockReturnValue([]);

    const { result, rerender } = renderHook(useAttention, { wrapper });
    rerender();

    expect(result.current.participants.some(p => p.identity === 'student-already-there')).toBe(true);
  });

  it('shows a connected student who has sent no telemetry yet as pending, not camera off', () => {
    const room = createFakeRoom();
    room.participants.set('SID456', { identity: 'student-loading' });
    mockUseVideoContext.mockReturnValue({ room, localTracks: [] });
    mockUseAttentionTelemetry.mockReturnValue([]);

    const { result } = renderHook(useAttention, { wrapper });

    const row = result.current.participants.find(p => p.identity === 'student-loading')!;
    expect(row).toMatchObject({ pending: true, cameraOff: false });
    expect(result.current.groupDataAvailable).toBe(false);
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

  it('KILL-SWITCH: hands out the empty value when REACT_APP_ENABLE_ATTENTION_CV is off, even on desktop with a room', () => {
    // The legal gate: without the flag, real biometric analysis must NOT run,
    // regardless of desktop + room + active capture.
    delete process.env.REACT_APP_ENABLE_ATTENTION_CV;
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.participants).toEqual([]);
    expect(result.current.groupDataAvailable).toBe(false);
    expect(result.current.self.capture).toBe('inactive');
  });

  it('KILL-SWITCH: keeps the telemetry transport OFF too — nothing is published or received while the pipeline is off', () => {
    delete process.env.REACT_APP_ENABLE_ATTENTION_CV;
    mockUseAttentionTelemetry.mockClear();

    renderHook(useAttention, { wrapper });

    expect(mockUseAttentionTelemetry).toHaveBeenCalled();
    mockUseAttentionTelemetry.mock.calls.forEach(call => expect(call[3]).toBe(false));
  });
});

// ─── RESTORE: a re-entering teacher continues from the stored snapshot ──────────
describe('useAttention inside AttentionProvider — restoring a stored snapshot', () => {
  const storedReport: AttentionReport = {
    roomSid: 'RM00000000000000000000000000000abc',
    roomName: 'test-room',
    endReason: 'left',
    source: 'live',
    studentCount: 1,
    attentionThreshold: 60,
    ranges: { lowMax: 40, mediumMax: 70 },
    groupAverage: 70,
    percentAboveThreshold: 50,
    timeline: [
      { time: '10:00:00', value: 60 },
      { time: '10:00:01', value: 80 },
    ],
    participants: [{ identity: 'student-z', indexAvg: 70, indexMin: 50, indexMax: 90, level: 'medium', alertCount: 1 }],
    proctoringAlerts: [{ identity: 'student-z', kind: 'away', detectedAt: '10:00' }],
    endedAtIso: '2026-07-03T10:00:02.000Z',
    startedAtIso: '2026-07-03T09:59:00.000Z',
    durationMs: 62000,
    recordingWasActiveAtEnd: false,
  };
  const useBoth = () => ({ attention: useAttention(), restore: useContext(AttentionRestoreContext) });

  beforeEach(() => {
    process.env.REACT_APP_ENABLE_ATTENTION_CV = 'true';
    setMobileDevice(false);
    mockUseMediaQuery.mockReturnValue(false);
    mockUseVideoContext.mockReturnValue({ room: createFakeRoom(), localTracks: [] });
    mockUseAttentionCapture.mockReturnValue({
      capture: 'inactive',
      index: 0,
      components: { eyes: 0, head: 0 },
      faces: 0,
      multiface: false,
    });
    mockUseAttentionTelemetry.mockReturnValue([]);
  });

  afterEach(() => {
    delete process.env.REACT_APP_ENABLE_ATTENTION_CV;
  });

  it('seeds the timeline, the roster, the per-student history and the proctoring log', () => {
    const { result } = renderHook(useBoth, { wrapper });

    act(() => result.current.restore(storedReport));

    const { attention } = result.current;
    expect(attention.fullTimeline).toEqual(storedReport.timeline);
    const student = attention.participants.find(p => p.identity === 'student-z');
    expect(student).toMatchObject({ indexMin: 50, indexMax: 90, indexAvg: 70 });
    expect(attention.proctoringLog).toEqual([expect.objectContaining({ identity: 'student-z', kind: 'away' })]);
    // Restored events are history: they never reappear in the live (expiring) feed.
    expect(attention.proctoringAlerts).toEqual([]);
  });

  it('is a no-op while the pipeline is off', () => {
    delete process.env.REACT_APP_ENABLE_ATTENTION_CV;
    const { result } = renderHook(useBoth, { wrapper });

    act(() => result.current.restore(storedReport));

    expect(result.current.attention.fullTimeline).toEqual([]);
    expect(result.current.attention.participants).toEqual([]);
  });
});

// ─── MOBILE: room present but mobile ──────────────────────────────────────────
describe('useAttention inside AttentionProvider — mobile (room present, isMobile)', () => {
  beforeEach(() => {
    // Mobile = the device is a phone (UA), regardless of the window width.
    setMobileDevice(true);
    mockUseMediaQuery.mockReturnValue(false);
    mockUseVideoContext.mockReturnValue({
      room: createFakeRoom(),
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

  afterEach(() => {
    setMobileDevice(false);
  });

  it('hands out the empty value on mobile when the CV pipeline flag is off', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.participants).toEqual([]);
    expect(result.current.groupDataAvailable).toBe(false);
  });

  it('hands out the live aggregate from remote telemetry when the pipeline is enabled (not the empty value)', () => {
    process.env.REACT_APP_ENABLE_ATTENTION_CV = 'true';
    mockUseAttentionTelemetry.mockReturnValue([
      { identity: 'student-b', index: 80, multiface: false, faces: 1, cameraOff: false },
      { identity: 'student-c', index: 30, multiface: false, faces: 1, cameraOff: false },
    ]);
    mockUseAttentionTelemetry.mockClear();
    try {
      const { result, unmount } = renderHook(useAttention, { wrapper });
      unmount(); // stop the 1 Hz sampling; the asserted value is the initial render's
      expect(result.current.source).toBe('live');
      expect(result.current.participants.map(p => p.identity).sort()).toEqual(['student-b', 'student-c']);
      expect(result.current.groupAttention).toBe(55);
      // The phone itself is not measured: capture inactive, same shape as live, posture sentinel.
      expect(result.current.self.capture).toBe('inactive');
      expect(result.current.self.components.posture).toBe(-1);
      // Local capture never receives a track on a phone (no MediaPipe load).
      mockUseAttentionCapture.mock.calls.forEach(call => expect(call[0]).toBeUndefined());
      // Broadcasts "unsupported", never "camera-off".
      mockUseAttentionTelemetry.mock.calls.forEach(call => {
        expect(call[1]).toBe(false);
        expect(call[2]).toBe(true);
        expect(call[3]).toBe(true);
      });
    } finally {
      delete process.env.REACT_APP_ENABLE_ATTENTION_CV;
    }
  });

  it('accumulates the group timeline from remote telemetry on a phone', () => {
    process.env.REACT_APP_ENABLE_ATTENTION_CV = 'true';
    mockUseAttentionTelemetry.mockReturnValue([
      { identity: 'student-b', index: 90, multiface: false, faces: 1, cameraOff: false },
    ]);
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-06-20T10:00:00Z'));
      const { result, unmount } = renderHook(useAttention, { wrapper });
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      expect(result.current.timeline.length).toBeGreaterThanOrEqual(2);
      expect(result.current.timeline[result.current.timeline.length - 1].value).toBe(90);
      unmount();
    } finally {
      jest.useRealTimers();
      delete process.env.REACT_APP_ENABLE_ATTENTION_CV;
    }
  });

  it('keeps the transport ON on mobile when the pipeline is enabled, to announce the device as unsupported', () => {
    process.env.REACT_APP_ENABLE_ATTENTION_CV = 'true';
    mockUseAttentionTelemetry.mockClear();
    try {
      renderHook(useAttention, { wrapper });
      expect(mockUseAttentionTelemetry).toHaveBeenCalledWith(expect.anything(), false, true, true);
    } finally {
      delete process.env.REACT_APP_ENABLE_ATTENTION_CV;
    }
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
