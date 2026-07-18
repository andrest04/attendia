/**
 * AttentionProvider — real CV pipeline with mock fallback
 * ────────────────────────────────────────────────────────
 * Layer 4a of the CV pipeline graduation.  The provider is the architectural
 * boundary between the UI and the computer-vision pipeline.
 *
 * ACTIVE (live) when:
 *   - A Twilio Room is connected, AND
 *   - The device is desktop (CV is desktop-only by product decision; MediaPipe
 *     is too heavy to run alongside a video call on mobile).
 *
 * INACTIVE → falls back to mockAttentionData (deterministic, stable) when:
 *   - No room (e.g. prejoin, tests, Storybook), OR
 *   - isMobile is true.
 *
 * Posture signal:
 *   useAttentionCapture measures eyes + head only.  Posture is NOT currently
 *   measured by the local CV pipeline (no accelerometer / body-pose model).
 *   In the live AttentionData we carry posture as -1 (the not-measured sentinel).
 *   The Individual-tab bar width is driven by the aggregate index, not the raw
 *   posture component — so the -1 never shows as a misleading "0% posture" to
 *   the professor.
 *
 * Formula:
 *   The live index comes directly from useAttentionCapture which calls
 *   computeLabAttentionIndex(eyes, head) — eyes+head only.
 *   computeAttentionIndex (the old formula with posture) is preserved in
 *   attentionFormula.ts for the mock fallback and remains unchanged.
 *   When posture becomes a measured signal, Layer 4b can replace -1 with the
 *   real value and computeLabAttentionIndex will incorporate it.
 *
 * Consumers (ProfessorRoomShell, GalleryView):
 *   All read exclusively through useAttention() and the AttentionContextValue
 *   shape.  The source === 'mock' "Datos simulados" disclosure tag disappears
 *   automatically when the pipeline is live.
 *
 * Students:
 *   Students have NO attention UI and NO control over the analysis
 *   (the "Mi Atención" panel and the enabled/setEnabled privacy toggle were
 *   removed by product decision, 2026-06-12).
 *
 * OUT OF SCOPE for this provider:
 *   Signaling actions (raise-hand, give-turn, proctoring responses) live in a
 *   dedicated SignalingProvider or equivalent — not here.
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useMediaQuery, useTheme } from '@material-ui/core';
import { LocalVideoTrack, RemoteParticipant } from 'twilio-video';
import { AttentionContextValue, AttentionLevel, AttentionTimelinePoint, ProctoringAlert } from './types';
import { mockAttentionData } from './mockAttentionData';
import { attentionLevelFromScore } from './attentionFormula';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import useAttentionCapture from '../../hooks/useAttentionCapture/useAttentionCapture';
import useAttentionTelemetry from '../../hooks/useAttentionTelemetry/useAttentionTelemetry';

// null! mirrors the pattern used in ChatProvider and ParticipantProvider.
export const AttentionContext = createContext<AttentionContextValue>(null!);

// Maximum timeline points kept in memory before the oldest are evicted.
// 90 points at 1-second intervals covers a 1.5-minute sliding window — enough
// density that the curve advances smoothly instead of jumping in coarse steps.
// This is the LIVE in-room "Grupo" tab's rolling-recent-window chart only —
// report generation reads `fullTimeline` (below) instead.
const TIMELINE_MAX_POINTS = 90;

// Defensive-only ceiling on the full-session timeline (report generation's
// source of truth) — 6h at 1Hz. Should never be hit in practice; a real class
// is downsampled at the report-save boundary well before this (see
// reportMath.MAX_REPORT_TIMELINE_POINTS), this just bounds memory for a room
// left open pathologically long.
const FULL_TIMELINE_HARD_CAP = 6 * 60 * 60;

// Interval (ms) at which a group-attention snapshot is pushed to the timeline.
// 1 s (aligned with the 1 Hz capture cadence) keeps the chart fluid: each tick
// appends a small segment rather than a 5 s jump. NOTE: this is purely the
// RENDER cadence — the underlying value is still smoothed over the capture's
// 10 s rolling window, so denser points make the motion fluid without making
// the signal noisier.
const TIMELINE_INTERVAL_MS = 1000;

// Stable confidence sentinel for live multiface proctoring alerts.
// The MediaPipe face count is binary (0/1/>1) rather than a probability score,
// so we expose 1.0 to signal "pipeline confirmed multiple faces" rather than an
// arbitrary partial-confidence number.
const LIVE_MULTIFACE_CONFIDENCE = 1.0;

// ─── Proctoring feed (live event log) ──────────────────────────────────────────
// The proctoring feed is a HISTORY, not a live mirror of the current state: an
// alert is appended when a condition first appears and STAYS in the feed even
// after the condition clears (e.g. the student turns the camera back on). Only
// the most recent PROCTORING_FEED_MAX events are kept.
const PROCTORING_FEED_MAX = 3;

// How often (ms) the remote telemetry is sampled to look for proctoring events.
// Aligned with the 1 Hz capture/telemetry cadence.
const PROCTORING_SAMPLE_MS = 1000;

// A condition must hold for this many CONSECUTIVE samples before it logs an
// event. This is the anti-flicker guard: a face detector that blinks for a
// single frame, or a momentary camera blip, never spams the feed.
const PROCTORING_DEBOUNCE_SAMPLES = 2;

// Per-kind confidence shown in the alert card. The MediaPipe signals are
// effectively binary (camera off / no face / multiple faces), so they report
// 1.0; 'away' (sustained low attention) is a softer inference, hence < 1.
const KIND_CONFIDENCE: Record<ProctoringAlert['kind'], number> = {
  multiface: LIVE_MULTIFACE_CONFIDENCE,
  'camera-off': 1.0,
  absent: 1.0,
  away: 0.9,
};

/**
 * Classify ONE remote telemetry sample into at most one proctoring condition.
 * The kinds are mutually exclusive per participant per sample (priority order:
 * camera off → no face → multiple faces → sustained low attention), so a single
 * participant never produces two simultaneous alerts. Returns null when the
 * participant shows no proctoring condition.
 */
function classifyProctoring(r: {
  cameraOff: boolean;
  faces: number;
  index: number;
  unsupported?: boolean;
}): ProctoringAlert['kind'] | null {
  // A mobile (unsupported) device cannot measure — it is not a proctoring event.
  if (r.unsupported) return null;
  if (r.cameraOff) return 'camera-off';
  if (r.faces === 0) return 'absent';
  if (r.faces > 1) return 'multiface';
  // Exactly one face present → flag only when attention is in the 'low' band.
  if (r.index <= mockAttentionData.ranges.lowMax) return 'away';
  return null;
}

/**
 * Format a Date as HH:MM — used for proctoring alert timestamps, which are
 * reported at minute resolution. Extracted so callers can unit-test without
 * real Date.now() spill.
 */
function formatTimeLabel(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Format a Date as HH:MM:SS for use as a timeline x-axis label.
 * Second-level resolution is required for the 1 Hz timeline: HH:MM alone would
 * collapse every point within the same minute onto a single tick, which reads
 * as a flat step instead of a fluid advance.
 */
function formatTimelineLabel(date: Date): string {
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${formatTimeLabel(date)}:${ss}`;
}

export const AttentionProvider: React.FC = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const { room, localTracks } = useVideoContext();

  // Production kill-switch (LEGAL GATE): the live CV pipeline performs real
  // biometric analysis of students, so it is OFF unless REACT_APP_ENABLE_ATTENTION_CV
  // is explicitly 'true'. This prevents the live pipeline from reaching production
  // by accident before a student CONSENT flow exists (consent is still pending —
  // see SecurityPage and the project graduation notes). Read per-render (not a
  // module constant) so tests can toggle it.
  const cvPipelineEnabled = process.env.REACT_APP_ENABLE_ATTENTION_CV === 'true';

  // Pipeline is desktop-only: never activate on mobile.
  const isDesktop = !isMobile;
  const isActive = cvPipelineEnabled && Boolean(room) && isDesktop;

  // Extract the local camera track the same way VideoProvider does.
  // Passing `undefined` keeps useAttentionCapture inactive (no MediaPipe load).
  const videoTrack = isActive
    ? (localTracks.find(t => !t.name.includes('screen') && t.kind === 'video') as LocalVideoTrack | undefined)
    : undefined;

  // Layer 2: local camera analysis (inactive when videoTrack is undefined).
  const captureResult = useAttentionCapture(videoTrack);

  // Local camera-off: the pipeline is active but there is no local camera video
  // track (the student toggled their camera off → removeLocalVideoTrack). Broadcast
  // this so the professor sees "Cámara apagada" instead of a frozen last value.
  const localCameraOff = isActive && !videoTrack;

  // Unsupported device: the pipeline is enabled and a room is connected, but this
  // is mobile (CV is desktop-only). The capture/telemetry never runs here, so we
  // broadcast an explicit "unsupported" beat — otherwise a mobile student is just
  // silently absent from the professor's view (indistinguishable from "not joined").
  const isMobileUnsupported = cvPipelineEnabled && isMobile && Boolean(room);

  // Layer 3: DataTrack transport — broadcast local + aggregate remotes.
  // The hook is always called (React rules), but it short-circuits internally
  // when room is null (no DataTrack published).
  const remoteAttention = useAttentionTelemetry(captureResult, localCameraOff, isMobileUnsupported);

  // Latest-value ref: the timeline interval is created once (deps [isActive]) and
  // would otherwise close over the remoteAttention from the render where isActive
  // flipped true — empty at that instant, so every tick wrote 0 forever while the
  // gauge (computed each render) showed the real average. Mirror the latest value
  // into a ref, updated every render, so push() always reads fresh telemetry.
  const remoteAttentionRef = useRef(remoteAttention);
  remoteAttentionRef.current = remoteAttention;

  // Live timeline: accumulated group-attention snapshots, capped at TIMELINE_MAX_POINTS.
  // A ref holds the mutable list; state triggers re-renders only when a point is added.
  const timelineRef = useRef<AttentionTimelinePoint[]>([]);
  const [timeline, setTimeline] = useState<AttentionTimelinePoint[]>([]);

  // Full-session timeline (report generation's source of truth) — same push
  // cadence as `timeline` above but capped only defensively, not for display.
  const fullTimelineRef = useRef<AttentionTimelinePoint[]>([]);
  const [fullTimeline, setFullTimeline] = useState<AttentionTimelinePoint[]>([]);

  // Every identity that has ever joined the Twilio Room, for as long as this
  // Room is connected — used to build a cumulative attendance roster for the
  // report even for students who never produced a single measured CV sample
  // (mobile/unsupported, camera off the whole time, or the CV pipeline
  // disabled). Never shrinks: a student who leaves stays counted, and a
  // rejoin under the same identity is a no-op on a Set (no double count).
  const attendedIdentitiesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    attendedIdentitiesRef.current = new Set();
    if (!room) return;
    room.participants.forEach(p => attendedIdentitiesRef.current.add(p.identity));
    const onConnected = (p: RemoteParticipant) => attendedIdentitiesRef.current.add(p.identity);
    room.on('participantConnected', onConnected);
    // Intentionally no participantDisconnected handler — the roster must never shrink.
    return () => {
      room.off('participantConnected', onConnected);
    };
  }, [room]);

  // Per-student index history (min/max + running sum/count for the average),
  // accumulated at the timeline sampling cadence from camera-on samples only.
  // Lives in a ref because it mutates on the interval, not per render; the 1 Hz
  // setTimeline re-render is what flushes the updated values into `participants`.
  const participantHistoryRef = useRef<Map<string, { min: number; max: number; sum: number; count: number }>>(
    new Map()
  );

  // Proctoring feed: a capped, append-only LOG of detected events (last 3). State
  // drives re-render; a ref holds the mutable list so the sampling interval can
  // read/extend it without stale closures.
  const [proctoringAlerts, setProctoringAlerts] = useState<ProctoringAlert[]>([]);
  const proctoringLogRef = useRef<ProctoringAlert[]>([]);
  // Keys (`identity::kind`) whose condition is currently confirmed-active and
  // already logged — suppresses re-logging while the same condition persists.
  const proctoringActiveRef = useRef<Set<string>>(new Set());
  // Consecutive-sample streak per key, backing the debounce.
  const proctoringStreakRef = useRef<Map<string, number>>(new Map());
  // Monotonic sequence for unique alert ids — the same identity can re-trigger
  // the same kind later, so ids cannot be identity-based alone.
  const proctoringSeqRef = useRef(0);

  useEffect(() => {
    if (!isActive) {
      // Reset timeline + per-student history when we go back to fallback.
      timelineRef.current = [];
      setTimeline([]);
      fullTimelineRef.current = [];
      setFullTimeline([]);
      participantHistoryRef.current.clear();
      return;
    }

    const push = () => {
      // participantHistoryRef is intentionally NEVER evicted on disconnect: it is
      // keyed by identity, so a student who leaves and rejoins naturally continues
      // the same entry instead of starting over — and a report built after a
      // student has left still has their min/max/avg to show. See the `participants`
      // construction below, which reads this Map for identities no longer live.

      // Read the latest telemetry from the ref — NOT the captured remoteAttention,
      // which would be stale (see remoteAttentionRef above).
      // Exclude camera-off participants from the timeline average, consistent with
      // groupAttention — a camera-off student has no live attention to contribute.
      // Measured = camera on, device able to run CV, AND a face actually detected
      // (faces 0 = decayed placeholder, not a real reading). Exclude all three from
      // the group average so "can't measure her" never drags the number down.
      const measured = remoteAttentionRef.current.filter(r => !r.cameraOff && !r.unsupported && r.faces > 0);
      // No measured participants (low connection, all camera-off, no students):
      // skip the point entirely rather than recording a fake 0 that dives the
      // "Evolución temporal" curve and pollutes the report's time-average. The
      // curve simply doesn't advance during the gap and resumes when data returns.
      if (measured.length === 0) return;
      const groupAvg = Math.round(measured.reduce((sum, r) => sum + r.index, 0) / measured.length);

      // Accumulate each camera-on student's index into the session history.
      const history = participantHistoryRef.current;
      measured.forEach(r => {
        const h = history.get(r.identity);
        if (!h) {
          history.set(r.identity, { min: r.index, max: r.index, sum: r.index, count: 1 });
        } else {
          h.min = Math.min(h.min, r.index);
          h.max = Math.max(h.max, r.index);
          h.sum += r.index;
          h.count += 1;
        }
      });

      const point: AttentionTimelinePoint = {
        time: formatTimelineLabel(new Date()),
        value: groupAvg,
      };

      const next = [...timelineRef.current, point].slice(-TIMELINE_MAX_POINTS);
      timelineRef.current = next;
      setTimeline(next);

      // Full-session series (uncapped in practice — only a generous defensive
      // ceiling) that report generation persists/displays, distinct from the
      // 90-point rolling window above which stays the live in-room chart's UX.
      const nextFull = [...fullTimelineRef.current, point].slice(-FULL_TIMELINE_HARD_CAP);
      fullTimelineRef.current = nextFull;
      setFullTimeline(nextFull);
    };

    // Seed one point immediately so the chart is never empty on first render.
    push();

    const id = window.setInterval(push, TIMELINE_INTERVAL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // Live proctoring feed: sample remote telemetry on an interval, detect when a
  // condition first appears (debounced), and append it to the capped log. The
  // log is reset whenever the pipeline goes back to fallback.
  useEffect(() => {
    if (!isActive) {
      proctoringLogRef.current = [];
      setProctoringAlerts([]);
      proctoringActiveRef.current.clear();
      proctoringStreakRef.current.clear();
      proctoringSeqRef.current = 0;
      return;
    }

    const sample = () => {
      const streak = proctoringStreakRef.current;
      const active = proctoringActiveRef.current;

      // Currently-active conditions this tick → `identity::kind` (mutually
      // exclusive per participant). Read from the ref for the freshest telemetry.
      const rawActive = new Map<string, { identity: string; kind: ProctoringAlert['kind'] }>();
      remoteAttentionRef.current.forEach(r => {
        const kind = classifyProctoring(r);
        if (kind) rawActive.set(`${r.identity}::${kind}`, { identity: r.identity, kind });
      });

      let changed = false;

      // Bump streaks; log a fresh event once a condition clears the debounce and
      // is not already an open (logged) condition.
      rawActive.forEach(({ identity, kind }, key) => {
        const n = (streak.get(key) ?? 0) + 1;
        streak.set(key, n);
        if (n >= PROCTORING_DEBOUNCE_SAMPLES && !active.has(key)) {
          active.add(key);
          proctoringSeqRef.current += 1;
          const alert: ProctoringAlert = {
            id: `live-${kind}-${identity}-${proctoringSeqRef.current}`,
            identity,
            kind,
            detectedAt: formatTimeLabel(new Date()),
            confidence: KIND_CONFIDENCE[kind],
          };
          proctoringLogRef.current = [...proctoringLogRef.current, alert].slice(-PROCTORING_FEED_MAX);
          changed = true;
        }
      });

      // Clear streak + open flag for conditions that ended, so a later recurrence
      // logs a brand-new event instead of staying suppressed forever.
      streak.forEach((_, key) => {
        if (!rawActive.has(key)) {
          streak.delete(key);
          active.delete(key);
        }
      });

      if (changed) setProctoringAlerts(proctoringLogRef.current);
    };

    const id = window.setInterval(sample, PROCTORING_SAMPLE_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // ─── attentionLevel helper — fixed ranges, stays the same regardless of source ─
  const ranges = mockAttentionData.ranges; // ATTENTION_RANGES from attentionFormula.ts
  const attentionLevel = (score: number): AttentionLevel => attentionLevelFromScore(score, ranges);

  // ─── Assemble AttentionData ───────────────────────────────────────────────────

  if (!isActive) {
    // Fallback: mock data (tests, mobile, no room).
    const value: AttentionContextValue = {
      ...mockAttentionData,
      fullTimeline: mockAttentionData.timeline,
      attentionLevel,
    };
    return <AttentionContext.Provider value={value}>{children}</AttentionContext.Provider>;
  }

  // Live path — pipeline is active.

  // Participant list: the union of every identity ever attended (roster),
  // ever measured (history), and currently live (remoteAttention) — so a
  // student who has already left the room still has a row, decorated with
  // whatever data survives them. Still-connected students keep today's
  // exact live-value behavior; departed students fall back to their
  // accumulated history (or, if never measured at all, an honest
  // "sin medición" row via faces:0).
  const liveByIdentity = new Map(remoteAttention.map(r => [r.identity, r]));
  const allIdentities = new Set<string>([
    ...attendedIdentitiesRef.current,
    ...participantHistoryRef.current.keys(),
    ...remoteAttention.map(r => r.identity),
  ]);
  const participants = Array.from(allIdentities).map(identity => {
    const r = liveByIdentity.get(identity);
    const h = participantHistoryRef.current.get(identity);
    if (r) {
      return {
        identity,
        index: r.index,
        multiface: r.multiface,
        level: attentionLevel(r.index),
        cameraOff: r.cameraOff,
        faces: r.faces,
        unsupported: r.unsupported,
        indexMin: h ? h.min : r.index,
        indexMax: h ? h.max : r.index,
        indexAvg: h ? Math.round(h.sum / h.count) : r.index,
      };
    }
    // Disconnected before this snapshot was built: historical-only row.
    const avg = h ? Math.round(h.sum / h.count) : 0;
    return {
      identity,
      index: avg,
      multiface: false,
      level: attentionLevel(avg),
      cameraOff: true, // honestly excluded from the live group gauge below
      faces: h ? 1 : 0, // 0 = never measured at all → UI renders "sin medición"
      unsupported: false,
      indexMin: h ? h.min : undefined,
      indexMax: h ? h.max : undefined,
      indexAvg: h ? avg : undefined,
    };
  });

  // Group attention: average of remote participant indexes, EXCLUDING camera-off
  // participants (their last value is stale and must not pollute the average).
  // When no measured remotes are present, 0 is the honest neutral.
  // Exclude camera-off, mobile-unsupported, AND face-not-detected (faces 0 = a
  // decayed placeholder index, not real attention) from the group average and the
  // groupDataAvailable flag — same honesty rule as the group-level no-data fix.
  const measuredParticipants = participants.filter(p => !p.cameraOff && !p.unsupported && p.faces !== 0);
  // groupDataAvailable distinguishes "real reading" from "placeholder 0": when no
  // measured participants are present the index is NOT 0 attention, it is NO DATA
  // (low connection / all camera-off / no students). The UI gates the gauge value
  // and the below-threshold alarm on this flag.
  const groupDataAvailable = measuredParticipants.length > 0;
  const groupAttention = groupDataAvailable
    ? Math.round(measuredParticipants.reduce((sum, p) => sum + p.index, 0) / measuredParticipants.length)
    : 0;

  // Self: index is already computeLabAttentionIndex(eyes, head) from the capture hook.
  // Posture is NOT measured — sentinel -1 keeps the shape valid without misrepresenting
  // the signal as "0% posture". Consumers drive progress bars from the aggregate index
  // (via attentionLevel), never from the raw posture component.
  const self = {
    index: captureResult.index,
    components: {
      eyes: captureResult.components.eyes,
      head: captureResult.components.head,
      posture: -1 as number, // NOT MEASURED — sentinel; replace when posture is a real signal
    },
    capture: captureResult.capture,
    lighting: 'ok' as const, // lighting is a separate signal, out of scope for Layer 4a
  };

  // Proctoring alerts come from the live event log (state), assembled by the
  // sampling effect above — NOT recomputed from the current render state.

  const value: AttentionContextValue = {
    source: 'live',
    ranges,
    groupAttention,
    groupDataAvailable,
    attentionThreshold: mockAttentionData.attentionThreshold,
    timeline,
    fullTimeline,
    self,
    participants,
    proctoringAlerts,
    attentionLevel,
  };

  return <AttentionContext.Provider value={value}>{children}</AttentionContext.Provider>;
};

export function useAttention(): AttentionContextValue {
  const context = useContext(AttentionContext);
  if (!context) {
    throw new Error('useAttention must be used within an AttentionProvider');
  }
  return context;
}
