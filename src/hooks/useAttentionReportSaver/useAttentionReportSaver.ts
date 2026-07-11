import { useCallback, useContext, useRef } from 'react';
import { AttentionContext } from '../../components/AttentionProvider';
import { AttentionReport, ReportEndReason } from '../../components/AttentionProvider/reportTypes';
import { averageOverTime, percentTimeAboveThreshold } from '../../components/AttentionReport/reportMath';
import { useAppState } from '../../state';
import useParticipants from '../useParticipants/useParticipants';
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
}

export default function useAttentionReportSaver(): AttentionReportSaverApi {
  // Read the context directly (not via useAttention) so the hook degrades to a
  // silent no-op when no AttentionProvider is mounted — same defensive posture
  // as GalleryView, and what lets Room render in tests without the provider.
  const attention = useContext(AttentionContext);
  const { room } = useVideoContext();
  const participants = useParticipants();
  const { saveAttentionReport, user } = useAppState();

  // Latest-value refs (same pattern as remoteAttentionRef in AttentionProvider):
  // saveReport stays referentially stable while snapshotting fresh values.
  const attentionRef = useRef(attention);
  attentionRef.current = attention;
  const roomRef = useRef(room);
  roomRef.current = room;
  const participantsRef = useRef(participants);
  participantsRef.current = participants;
  const saveRef = useRef(saveAttentionReport);
  saveRef.current = saveAttentionReport;
  // A Room is only rendered after Video.connect succeeds. Capture that observed
  // connection time once, rather than deriving duration from the capped timeline.
  const startedAtRef = useRef<number | null>(room?.sid ? Date.now() : null);
  if (room?.sid && startedAtRef.current === null) {
    startedAtRef.current = Date.now();
  }

  const saveReport = useCallback(
    async (endReason: ReportEndReason) => {
      const save = saveRef.current;
      const currentRoom = roomRef.current;
      const data = attentionRef.current;

      // Skip silently: non-firebase modes have no saveAttentionReport, a room that
      // never connected has no SID, and a session with genuinely no data (no
      // timeline AND no live reading) has nothing worth persisting. Mock data IS
      // saved (source:'mock') so dev exercises the whole pipeline.
      if (!save || !data || !currentRoom?.sid) {
        return;
      }
      if (data.timeline.length === 0 && !data.groupDataAvailable) {
        return;
      }

      // Fold proctoring alerts per identity for the per-student table.
      const alertCountByIdentity: Record<string, number> = {};
      data.proctoringAlerts.forEach(alert => {
        alertCountByIdentity[alert.identity] = (alertCountByIdentity[alert.identity] || 0) + 1;
      });

      const endedAt = new Date();
      const startedAt = startedAtRef.current ?? endedAt.getTime();
      const scheduledClass = readScheduledClassSession(currentRoom.name);
      const report: AttentionReport = {
        roomSid: currentRoom.sid,
        roomName: currentRoom.name,
        ...(scheduledClass ? { classId: scheduledClass.classId } : {}),
        endReason,
        source: data.source,
        studentCount: participantsRef.current.length,
        attentionThreshold: data.attentionThreshold,
        ranges: data.ranges,
        // Same derivations as the in-room report view: session time-average with a
        // live-snapshot fallback, and the real share of time at/above the threshold.
        groupAverage: data.timeline.length > 0 ? averageOverTime(data.timeline) : data.groupAttention,
        percentAboveThreshold: percentTimeAboveThreshold(data.timeline, data.attentionThreshold),
        timeline: data.timeline,
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
    [user]
  );

  return { saveReport };
}
