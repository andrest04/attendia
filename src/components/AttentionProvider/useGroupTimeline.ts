import { MutableRefObject, useEffect, useRef, useState } from 'react';
import { RemoteAttention } from '../../hooks/useAttentionTelemetry/useAttentionTelemetry';
import { AttentionTimelinePoint } from './types';
import { averageIndex, formatTimelineLabel, isMeasured, ParticipantHistory, recordHistory } from './liveAttention';
import { AttentionSeed, mergeHistory } from './liveSnapshot';

// Maximum timeline points kept in memory before the oldest are evicted.
// 90 points at 1-second intervals covers a 1.5-minute sliding window — enough
// density that the curve advances smoothly instead of jumping in coarse steps.
// This is the LIVE in-room "Grupo" tab's rolling-recent-window chart only —
// report generation reads `fullTimeline` instead.
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

export interface GroupTimeline {
  /** Rolling window for the live "Grupo" chart. */
  timeline: AttentionTimelinePoint[];
  /** Full-session series, the source of truth for reports. */
  fullTimeline: AttentionTimelinePoint[];
  /** Per-student index history (min/max/sum/count), accumulated at the same cadence. */
  history: MutableRefObject<ParticipantHistory>;
}

/**
 * Samples the group's attention once per second while the live pipeline is active, appending a
 * point to both timelines and folding each measured student into their session history. Resets
 * everything when the pipeline goes back to the fallback.
 *
 * `remoteAttention` is read through a ref: the interval is created once (per `isActive`) and
 * would otherwise close over the telemetry from the render where isActive flipped true — empty
 * at that instant, so every tick would write 0 forever.
 *
 * `seed` is a snapshot restored from the server when the owner teacher re-enters a class that kept
 * running: its timeline is prepended and its per-student history folded into the live one.
 */
export default function useGroupTimeline(
  remoteAttention: MutableRefObject<RemoteAttention[]>,
  isActive: boolean,
  seed: AttentionSeed | null = null
): GroupTimeline {
  const [timeline, setTimeline] = useState<AttentionTimelinePoint[]>([]);
  const [fullTimeline, setFullTimeline] = useState<AttentionTimelinePoint[]>([]);
  const timelineRef = useRef<AttentionTimelinePoint[]>([]);
  const fullTimelineRef = useRef<AttentionTimelinePoint[]>([]);
  const history = useRef<ParticipantHistory>(new Map());

  useEffect(() => {
    if (!isActive) {
      // Reset timeline + per-student history when we go back to fallback.
      timelineRef.current = [];
      setTimeline([]);
      fullTimelineRef.current = [];
      setFullTimeline([]);
      history.current.clear();
      return;
    }

    const push = () => {
      // The history is intentionally NEVER evicted on disconnect: it is keyed by identity, so a
      // student who leaves and rejoins continues the same entry, and a report built after a
      // student has left still has their min/max/avg to show.
      const measured = remoteAttention.current.filter(isMeasured);
      // No measured participants (low connection, all camera-off, no students): skip the point
      // entirely rather than recording a fake 0 that dives the "Evolución temporal" curve and
      // pollutes the report's time-average. The curve simply doesn't advance during the gap.
      const groupAverage = averageIndex(measured);
      if (groupAverage === null) return;

      recordHistory(history.current, measured);

      const point: AttentionTimelinePoint = { time: formatTimelineLabel(new Date()), value: groupAverage };

      const next = [...timelineRef.current, point].slice(-TIMELINE_MAX_POINTS);
      timelineRef.current = next;
      setTimeline(next);

      // Full-session series (uncapped in practice — only a generous defensive ceiling) that
      // report generation persists/displays, distinct from the 90-point rolling window above.
      const nextFull = [...fullTimelineRef.current, point].slice(-FULL_TIMELINE_HARD_CAP);
      fullTimelineRef.current = nextFull;
      setFullTimeline(nextFull);
    };

    // Seed one point immediately so the chart is never empty on first render.
    push();

    const id = window.setInterval(push, TIMELINE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isActive, remoteAttention]);

  useEffect(() => {
    if (!seed || !isActive) return;
    const merged = [...seed.fullTimeline, ...fullTimelineRef.current].slice(-FULL_TIMELINE_HARD_CAP);
    fullTimelineRef.current = merged;
    setFullTimeline(merged);
    mergeHistory(history.current, seed.history);
  }, [seed, isActive]);

  return { timeline, fullTimeline, history };
}
