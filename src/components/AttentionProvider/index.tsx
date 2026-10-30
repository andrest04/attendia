/**
 * AttentionProvider — real CV pipeline, empty when off
 * ─────────────────────────────────────────────────────
 * Layer 4a of the CV pipeline graduation.  The provider is the architectural
 * boundary between the UI and the computer-vision pipeline.
 *
 * REAL data (source 'live') when REACT_APP_ENABLE_ATTENTION_CV is on AND a Twilio Room is
 * connected, in two flavours:
 *   - `live`: the device is a desktop — local camera analysis + telemetry + real aggregates.
 *   - `mobile-beacon`: the device is a phone (CV is desktop-only by product decision; MediaPipe
 *     is too heavy to run alongside a video call on mobile). Local capture stays off and the
 *     device broadcasts an "unsupported" beat, but the aggregates from remote telemetry are
 *     still real — a teacher on a phone never sees mock data.
 *   "Desktop"/"phone" is the device as told by the user agent (utils.isMobile), NOT the window
 *   width: a narrowed laptop window is still a laptop.
 *
 * EMPTY value (`off` mode) when the flag is off or there is no room (e.g. prejoin, tests,
 * Storybook): no participants, no timeline, no alerts, `groupDataAvailable: false`. There is no
 * simulated data anywhere — the professor never sees numbers that were not measured.
 *
 * Which mode applies is decided by the pure
 * resolveAttentionMode (attentionMode.ts). The provider stays ONE component for every mode on
 * purpose: swapping the wrapper component per mode would remount the whole app tree below it
 * the moment a room connects. The rules behind the live data — who is measured, the group
 * average, the proctoring debounce — are pure functions in liveAttention.ts; the three
 * time-driven pieces are the hooks useAttendanceRoster, useGroupTimeline and useProctoringFeed.
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
 *   When posture becomes a measured signal, Layer 4b can replace -1 with the
 *   real value and the weighted index in attentionHeuristics.ts will incorporate it.
 *
 * Consumers (ProfessorRoomShell, GalleryView):
 *   All read exclusively through useAttention() and the AttentionContextValue
 *   shape. `source` is always 'live'; 'mock' survives only in legacy stored reports.
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

import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AttentionContextValue, AttentionLevel } from './types';
import { AttentionReport } from './reportTypes';
import { AttentionSeed, seedFromReport } from './liveSnapshot';
import { ATTENTION_RANGES, ATTENTION_THRESHOLD, attentionLevelFromScore } from './attentionFormula';
import { isLiveAttentionMode, resolveAttentionMode } from './attentionMode';
import { buildParticipants, studentsOnly, summarizeGroup } from './liveAttention';
import useAttendanceRoster from './useAttendanceRoster';
import useGroupTimeline from './useGroupTimeline';
import useProctoringFeed from './useProctoringFeed';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import { isTeacherIdentity } from '../../classSession/classSessionTypes';
import useParticipants from '../../hooks/useParticipants/useParticipants';
import useAttentionCapture from '../../hooks/useAttentionCapture/useAttentionCapture';
import useAttentionTelemetry from '../../hooks/useAttentionTelemetry/useAttentionTelemetry';
import useLatest from '../../hooks/useLatest/useLatest';
import { featureFlags } from '../../utils/featureFlags';
import useRequiredContext from '../../hooks/useRequiredContext/useRequiredContext';
import { selectCameraTrack } from '../../utils/trackSelectors';
import { isMobile } from '../../utils';

// null! mirrors the pattern used in ChatProvider and ParticipantProvider.
export const AttentionContext = createContext<AttentionContextValue>(null!);

/**
 * Lets the owner teacher's re-entry flow (useLiveReportSync) hand the provider the snapshot stored
 * on the server, so the report continues instead of starting empty. The default is a Null Object:
 * without a provider (tests, Storybook) restoring does nothing.
 */
export const AttentionRestoreContext = createContext<(report: AttentionReport) => void>(() => undefined);

// Fixed ranges: the level of a score never depends on where the data comes from.
const attentionLevel = (score: number): AttentionLevel => attentionLevelFromScore(score, ATTENTION_RANGES);

// Posture is NOT measured by the CV pipeline — sentinel -1 keeps the shape valid without
// misrepresenting the signal as "0% posture". Consumers drive progress bars from the aggregate
// index (via attentionLevel), never from the raw posture component.
const POSTURE_NOT_MEASURED = -1;

// What every consumer sees while the pipeline is off: nothing measured, nothing invented. Built
// once, so its identity is stable and consumers are not re-rendered by a provider that has
// nothing new to say. Same shape the live path produces with zero participants.
const EMPTY_VALUE: AttentionContextValue = Object.freeze({
  source: 'live' as const,
  ranges: ATTENTION_RANGES,
  ...summarizeGroup([]),
  attentionThreshold: ATTENTION_THRESHOLD,
  timeline: [],
  fullTimeline: [],
  self: {
    index: 0,
    components: { eyes: 0, head: 0, posture: POSTURE_NOT_MEASURED },
    capture: 'inactive' as const,
    lighting: 'ok' as const,
  },
  participants: [],
  proctoringAlerts: [],
  attentionLevel,
});

export const AttentionProvider: React.FC = ({ children }) => {
  const { room, localTracks } = useVideoContext();

  // Production kill-switch (LEGAL GATE): the live CV pipeline performs real biometric analysis
  // of students, so it is OFF unless REACT_APP_ENABLE_ATTENTION_CV is explicitly 'true'. This
  // prevents the live pipeline from reaching production by accident before a student CONSENT
  // flow exists. Read per-render (not a module constant) so tests can toggle it.
  const mode = resolveAttentionMode({
    cvPipelineEnabled: featureFlags.isAttentionCvEnabled(),
    hasRoom: Boolean(room),
    // The DEVICE (user agent), never the window width: a teacher who narrows the laptop window
    // is still on a laptop, and flipping mode would wipe the timeline and proctoring history.
    isDesktop: !isMobile,
  });
  // Real aggregates (telemetry, roster, timeline, proctoring) run in both live modes; only the
  // local camera analysis is desktop-only.
  const isLive = isLiveAttentionMode(mode);
  const capturesLocally = mode === 'live';

  // The local camera, extracted the same way VideoProvider does. `undefined` keeps
  // useAttentionCapture inactive (no MediaPipe load) — always the case on a phone.
  const videoTrack = capturesLocally ? selectCameraTrack(localTracks) : undefined;

  // Layer 2: local camera analysis (inactive when videoTrack is undefined).
  const captureResult = useAttentionCapture(videoTrack);

  // Local camera-off: the desktop pipeline is active but there is no local camera video track (the
  // student toggled their camera off → removeLocalVideoTrack). Broadcast this so the professor sees
  // "Cámara apagada" instead of a frozen last value. Never on a phone: that one says "unsupported".
  const localCameraOff = capturesLocally && !videoTrack;

  // Unsupported device: the pipeline is enabled and a room is connected, but this is mobile (CV is
  // desktop-only). Capture never runs here, so we broadcast an explicit "unsupported" beat —
  // otherwise a mobile student is just silently absent from the professor's view
  // (indistinguishable from "not joined").
  const isMobileUnsupported = mode === 'mobile-beacon';

  // Layer 3: DataTrack transport — broadcast local + aggregate remotes. The hook is always
  // called (React rules), but it is inert in `off` mode: with the pipeline off nobody
  // publishes a telemetry track, receives it or runs its sweep.
  // Readings students buffered while no teacher was in the room arrive through `onBackfill` and
  // are merged by useGroupTimeline (declared below, hence the ref).
  const mergeBackfillRef = useRef<(identity: string, samples: unknown) => void>(() => undefined);
  const onBackfill = useCallback(
    (identity: string, samples: unknown) => mergeBackfillRef.current(identity, samples),
    []
  );
  const allRemoteAttention = useAttentionTelemetry(
    captureResult,
    localCameraOff,
    isMobileUnsupported,
    isLive,
    onBackfill
  );
  // Co-teachers publish telemetry too; attention is about students only.
  const remoteAttention = useMemo(() => studentsOnly(allRemoteAttention), [allRemoteAttention]);

  // Latest-value ref: the sampling intervals are created once (per isLive) and would otherwise
  // close over the telemetry from the render where isLive flipped true — empty at that instant.
  const remoteAttentionRef = useLatest(remoteAttention);

  // A snapshot restored once per live session (see AttentionRestoreContext). Dropped with the
  // pipeline so a later room never inherits it.
  const [seed, setSeed] = useState<AttentionSeed | null>(null);
  const isLiveRef = useLatest(isLive);
  const restoredRef = useRef(false);
  const restore = useCallback(
    (report: AttentionReport) => {
      if (!isLiveRef.current || restoredRef.current) return;
      restoredRef.current = true;
      setSeed(seedFromReport(report));
    },
    [isLiveRef]
  );
  useEffect(() => {
    if (isLive) return;
    restoredRef.current = false;
    setSeed(null);
  }, [isLive]);

  const allAttended = useAttendanceRoster(room, seed ? seed.attended : null);
  const attended = useMemo<ReadonlySet<string>>(
    () => new Set(Array.from(allAttended).filter(identity => !isTeacherIdentity(identity))),
    [allAttended]
  );
  // Who is in the room right now: a connected student with no telemetry is "no reading yet",
  // not "camera off" (that is only ever the student's own explicit report).
  const remoteParticipants = useParticipants();
  const connected = useMemo<ReadonlySet<string>>(() => new Set(studentsOnly(remoteParticipants).map(p => p.identity)), [
    remoteParticipants,
  ]);
  const { timeline, fullTimeline, history, mergeBackfill } = useGroupTimeline(remoteAttentionRef, isLive, seed);
  mergeBackfillRef.current = mergeBackfill;
  const { alerts: proctoringAlerts, log: proctoringLog } = useProctoringFeed(remoteAttentionRef, isLive, seed);

  return (
    <AttentionRestoreContext.Provider value={restore}>
      <AttentionContext.Provider
        value={useMemo<AttentionContextValue>(() => {
          // Pipeline off or no room: the empty value, never simulated data.
          if (!isLive) return EMPTY_VALUE;

          // Live path — real aggregates from telemetry (desktop or phone).
          const participants = buildParticipants({
            attended,
            connected,
            history: history.current,
            live: remoteAttention,
            attentionLevel,
          });
          const { groupAttention, groupDataAvailable } = summarizeGroup(participants);

          // Self: index is already computeLabAttentionIndex(eyes, head) from the capture hook.
          const self = {
            index: captureResult.index,
            components: {
              eyes: captureResult.components.eyes,
              head: captureResult.components.head,
              posture: POSTURE_NOT_MEASURED, // replace when posture is a real signal
            },
            capture: captureResult.capture,
            lighting: 'ok' as const, // lighting is a separate signal, out of scope for Layer 4a
          };

          return {
            source: 'live',
            ranges: ATTENTION_RANGES,
            groupAttention,
            groupDataAvailable,
            attentionThreshold: ATTENTION_THRESHOLD,
            timeline,
            fullTimeline,
            self,
            participants,
            // From the live event log assembled by useProctoringFeed — NOT recomputed per render.
            proctoringAlerts,
            proctoringLog,
            attentionLevel,
          };
          // `history` is a ref mutated in step with `timeline`/`fullTimeline`, which are therefore
          // the dependencies that carry its changes.
        }, [
          isLive,
          attended,
          connected,
          history,
          remoteAttention,
          captureResult,
          timeline,
          fullTimeline,
          proctoringAlerts,
          proctoringLog,
        ])}
      >
        {children}
      </AttentionContext.Provider>
    </AttentionRestoreContext.Provider>
  );
};

export function useAttention(): AttentionContextValue {
  return useRequiredContext(AttentionContext, 'useAttention', 'an AttentionProvider');
}
