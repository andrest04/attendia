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
 *   The Individual-tab bar uses levelPercent[attentionLevel(index)] — driven by
 *   the aggregate index, not the raw posture component — so the -1 never shows
 *   as a misleading "0% posture" to the professor.
 *
 * Formula:
 *   The live index comes directly from useAttentionCapture which calls
 *   computeLabAttentionIndex(eyes, head) — eyes+head only.
 *   computeAttentionIndex (the old formula with posture) is preserved in
 *   attentionFormula.ts for the mock fallback and remains unchanged.
 *   When posture becomes a measured signal, Layer 4b can replace -1 with the
 *   real value and computeLabAttentionIndex will incorporate it.
 *
 * Consumers (ProfessorRoomShell, AttentionReportOverlay, GalleryView):
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
import { LocalVideoTrack } from 'twilio-video';
import { AttentionContextValue, AttentionLevel, AttentionTimelinePoint, ProctoringAlert } from './types';
import { mockAttentionData } from './mockAttentionData';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import useAttentionCapture from '../../hooks/useAttentionCapture/useAttentionCapture';
import useAttentionTelemetry from '../../hooks/useAttentionTelemetry/useAttentionTelemetry';

// null! mirrors the pattern used in ChatProvider and ParticipantProvider.
export const AttentionContext = createContext<AttentionContextValue>(null!);

// Maximum timeline points kept in memory before the oldest are evicted.
// 60 points at 5-second intervals covers a 5-minute window — long enough to
// show meaningful trends without unbounded memory growth.
const TIMELINE_MAX_POINTS = 60;

// Interval (ms) at which a group-attention snapshot is pushed to the timeline.
// 5 s is a reasonable sampling cadence for a trend chart.
const TIMELINE_INTERVAL_MS = 5000;

// Stable confidence sentinel for live multiface proctoring alerts.
// The MediaPipe face count is binary (0/1/>1) rather than a probability score,
// so we expose 1.0 to signal "pipeline confirmed multiple faces" rather than an
// arbitrary partial-confidence number.
const LIVE_MULTIFACE_CONFIDENCE = 1.0;

/**
 * Format a Date as HH:MM for use as a timeline x-axis label.
 * Extracted so callers can unit-test without real Date.now() spill.
 */
function formatTimeLabel(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export const AttentionProvider: React.FC = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const { room, localTracks } = useVideoContext();

  // Pipeline is desktop-only: never activate on mobile.
  const isDesktop = !isMobile;
  const isActive = Boolean(room) && isDesktop;

  // Extract the local camera track the same way VideoProvider does.
  // Passing `undefined` keeps useAttentionCapture inactive (no MediaPipe load).
  const videoTrack = isActive
    ? (localTracks.find(t => !t.name.includes('screen') && t.kind === 'video') as LocalVideoTrack | undefined)
    : undefined;

  // Layer 2: local camera analysis (inactive when videoTrack is undefined).
  const captureResult = useAttentionCapture(videoTrack);

  // Layer 3: DataTrack transport — broadcast local + aggregate remotes.
  // The hook is always called (React rules), but it short-circuits internally
  // when room is null (no DataTrack published).
  const remoteAttention = useAttentionTelemetry(captureResult);

  // Live timeline: accumulated group-attention snapshots, capped at TIMELINE_MAX_POINTS.
  // A ref holds the mutable list; state triggers re-renders only when a point is added.
  const timelineRef = useRef<AttentionTimelinePoint[]>([]);
  const [timeline, setTimeline] = useState<AttentionTimelinePoint[]>([]);

  useEffect(() => {
    if (!isActive) {
      // Reset timeline when we go back to fallback.
      timelineRef.current = [];
      setTimeline([]);
      return;
    }

    const push = () => {
      const groupAvg =
        remoteAttention.length === 0
          ? 0
          : Math.round(remoteAttention.reduce((sum, r) => sum + r.index, 0) / remoteAttention.length);

      const point: AttentionTimelinePoint = {
        time: formatTimeLabel(new Date()),
        value: groupAvg,
      };

      const next = [...timelineRef.current, point].slice(-TIMELINE_MAX_POINTS);
      timelineRef.current = next;
      setTimeline(next);
    };

    // Seed one point immediately so the chart is never empty on first render.
    push();

    const id = window.setInterval(push, TIMELINE_INTERVAL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // ─── attentionLevel helper — fixed ranges, stays the same regardless of source ─
  const ranges = mockAttentionData.ranges; // { lowMax: 40, mediumMax: 70 }
  const attentionLevel = (score: number): AttentionLevel => {
    if (score <= ranges.lowMax) return 'low';
    if (score <= ranges.mediumMax) return 'medium';
    return 'high';
  };

  // ─── Assemble AttentionData ───────────────────────────────────────────────────

  if (!isActive) {
    // Fallback: mock data (tests, mobile, no room).
    const value: AttentionContextValue = {
      ...mockAttentionData,
      attentionLevel,
    };
    return <AttentionContext.Provider value={value}>{children}</AttentionContext.Provider>;
  }

  // Live path — pipeline is active.

  // Participant list: map RemoteAttention[] → ParticipantAttention[].
  const participants = remoteAttention.map(r => ({
    identity: r.identity,
    index: r.index,
    multiface: r.multiface,
    level: attentionLevel(r.index),
  }));

  // Group attention: average of remote participant indexes.
  // When no remotes are present yet, 0 is the honest neutral (gauge renders 0 correctly).
  const groupAttention =
    participants.length === 0 ? 0 : Math.round(participants.reduce((sum, p) => sum + p.index, 0) / participants.length);

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

  // Proctoring alerts: one per remote participant where multiface === true.
  // ID is stable for the lifetime of the session (identity-based, no random seed).
  // detectedAt uses real wall-clock time because alerts are genuinely timestamped.
  const proctoringAlerts: ProctoringAlert[] = participants
    .filter(p => p.multiface)
    .map(p => ({
      id: `live-multiface-${p.identity}`,
      identity: p.identity,
      kind: 'multiface' as const,
      detectedAt: formatTimeLabel(new Date()),
      confidence: LIVE_MULTIFACE_CONFIDENCE,
    }));

  const value: AttentionContextValue = {
    source: 'live',
    ranges,
    groupAttention,
    attentionThreshold: mockAttentionData.attentionThreshold,
    timeline,
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
