import { useCallback, useContext, useEffect, useRef } from 'react';
import { AttentionContext } from '../../components/AttentionProvider';
import { AttentionReport, ReportEndReason } from '../../components/AttentionProvider/reportTypes';
import {
  averageOverTime,
  downsampleTimeline,
  MAX_REPORT_TIMELINE_POINTS,
  percentTimeAboveThreshold,
} from '../../components/AttentionReport/reportMath';
import { useAppState } from '../../state';
import useVideoContext from '../useVideoContext/useVideoContext';
import { savePendingAttentionReport } from '../../components/AttentionReport/pendingAttentionReports';
import { readScheduledClassSession } from '../../components/TeacherDashboard/classSessionContext';

/*
 * Snapshots the in-room attention data into a persisted AttentionReport when the
 * professor ends or leaves the class. The provider CLEARS its history the moment
 * it goes inactive (room disconnect), so the snapshot must be taken synchronously
 * BEFORE room.disconnect() — hence the latest-value refs: `saveReport` is stable
 * (safe to keep in useSessionEnd's ref) yet always reads fresh data. The in-flight
 * POST survives the disconnect because the SPA never unloads on leave.
 *
 * Saving must never block leaving the room. A failed write is retained in
 * durable browser storage for the signed-in teacher and surfaced on the dashboard.
 */

export interface AttentionReportSaverApi {
  /** Snapshot the current attention data and persist it. Never throws. */
  saveReport: (endReason: ReportEndReason) => Promise<void>;
  /**
   * Pure, synchronous snapshot of the current attention data into the exact
   * AttentionReport shape `saveReport` persists — without touching the network.
   * Returns null when there is nothing worth persisting (same skip conditions
   * as `saveReport`). Used by the `beforeunload`/`pagehide` handler in Room.tsx,
   * where an async POST can't be awaited but a synchronous localStorage write can.
   */
  buildReport: (endReason: ReportEndReason) => AttentionReport | null;
}

export default function useAttentionReportSaver(): AttentionReportSaverApi {
  // Read the context directly (not via useAttention) so the hook degrades to a
  // silent no-op when no AttentionProvider is mounted — same defensive posture
  // as GalleryView, and what lets Room render in tests without the provider.
  const attention = useContext(AttentionContext);
  const { room } = useVideoContext();
  const { saveAttentionReport, user } = useAppState();

  // Latest-value refs (same pattern as remoteAttentionRef in AttentionProvider):
  // saveReport stays referentially stable while snapshotting fresh values.
  const attentionRef = useRef(attention);
  const roomRef = useRef(room);
  const saveRef = useRef(saveAttentionReport);
  // A Room is only rendered after Video.connect succeeds. Capture that observed
  // connection time once, rather than deriving duration from the capped timeline.
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    attentionRef.current = attention;
    roomRef.current = room;
    saveRef.current = saveAttentionReport;
    if (room?.sid && startedAtRef.current === null) {
      startedAtRef.current = Date.now();
    }
  }, [attention, room, saveAttentionReport]);

  const buildReport = useCallback((endReason: ReportEndReason): AttentionReport | null => {
    const currentRoom = roomRef.current;
    const data = attentionRef.current;

    // Skip silently only when the room never actually connected (no SID) or the
    // AttentionProvider never mounted — there is nothing to attribute a report
    // to. A class that connected and ended is a real event worth a history
    // entry even with zero students / no attention data: the report view
    // already renders that honestly ("—"/"Sin datos") instead of a fake 0, so
    // there is no reason to suppress the record itself.
    if (!data || !currentRoom?.sid) {
      return null;
    }

    // Fold proctoring alerts per identity for the per-student table.
    const alertCountByIdentity: Record<string, number> = {};
    data.proctoringAlerts.forEach(alert => {
      alertCountByIdentity[alert.identity] = (alertCountByIdentity[alert.identity] || 0) + 1;
    });

    const endedAt = new Date();
    const startedAt = startedAtRef.current ?? endedAt.getTime();
    const scheduledClass = readScheduledClassSession(currentRoom.name);
    return {
      roomSid: currentRoom.sid,
      roomName: currentRoom.name,
      ...(scheduledClass ? { classId: scheduledClass.classId } : {}),
      endReason,
      source: data.source,
      // data.participants is the cumulative attendance roster (identities ever
      // seen, not just currently connected) — see AttentionProvider — so this
      // stays accurate even after every student has already left the room.
      studentCount: data.participants.length,
      attentionThreshold: data.attentionThreshold,
      ranges: data.ranges,
      // Same derivations as the in-room report view: session time-average with a
      // live-snapshot fallback, and the real share of time at/above the threshold.
      // Computed from the full-resolution session series (not the persisted,
      // possibly-downsampled one) for accuracy.
      groupAverage: data.fullTimeline.length > 0 ? averageOverTime(data.fullTimeline) : data.groupAttention,
      percentAboveThreshold: percentTimeAboveThreshold(data.fullTimeline, data.attentionThreshold),
      // Downsampled only if the session exceeded MAX_REPORT_TIMELINE_POINTS
      // (a no-op for any realistic class length — see reportMath.ts).
      timeline: downsampleTimeline(data.fullTimeline, MAX_REPORT_TIMELINE_POINTS),
      participants: data.participants.map(participant => {
        const avg = participant.indexAvg ?? participant.index;
        return {
          identity: participant.identity,
          indexAvg: avg,
          indexMin: participant.indexMin ?? participant.index,
          indexMax: participant.indexMax ?? participant.index,
          level: data.attentionLevel(avg),
          alertCount: alertCountByIdentity[participant.identity] || 0,
        };
      }),
      proctoringAlerts: data.proctoringAlerts.map(alert => ({
        identity: alert.identity,
        kind: alert.kind,
        detectedAt: alert.detectedAt,
      })),
      endedAtIso: endedAt.toISOString(),
      startedAtIso: new Date(startedAt).toISOString(),
      durationMs: Math.max(0, endedAt.getTime() - startedAt),
      // The SDK has no recording-composition status or media URL API in this app.
      // This is only the truthful final in-room state, not a download guarantee.
      recordingWasActiveAtEnd: Boolean(currentRoom.isRecording),
    };
  }, []);

  const saveReport = useCallback(
    async (endReason: ReportEndReason) => {
      const save = saveRef.current;
      // Non-firebase modes have no saveAttentionReport — skip without building.
      if (!save) {
        return;
      }
      const report = buildReport(endReason);
      if (!report) {
        return;
      }

      try {
        await save(report);
      } catch (err) {
        savePendingAttentionReport(user && 'uid' in user ? user.uid : undefined, report);
        console.error('attention-report-persistence: report save failed and was queued for retry', {
          roomSid: report.roomSid,
          error: err,
        });
      }
    },
    [buildReport, user]
  );

  return { saveReport, buildReport };
}
