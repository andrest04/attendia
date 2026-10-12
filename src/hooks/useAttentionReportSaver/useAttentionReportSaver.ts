import { useCallback, useContext, useEffect, useRef } from 'react';
import { AttentionContext } from '../../components/AttentionProvider';
import { AttentionReport, ReportEndReason } from '../../components/AttentionProvider/reportTypes';
import { buildAttentionReport } from '../../components/AttentionReport/buildAttentionReport';
import { useAppState } from '../../state';
import useVideoContext from '../useVideoContext/useVideoContext';
import useLatest from '../useLatest/useLatest';
import { savePendingAttentionReport } from '../../components/AttentionReport/pendingAttentionReports';
import { readScheduledClassSession } from '../../classSession/classSessionContext';

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
  const attentionRef = useLatest(attention);
  const roomRef = useLatest(room);
  const saveRef = useLatest(saveAttentionReport);
  // A Room is only rendered after Video.connect succeeds. Capture that observed
  // connection time once, rather than deriving duration from the capped timeline.
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (room?.sid && startedAtRef.current === null) {
      startedAtRef.current = Date.now();
    }
  }, [room]);

  const buildReport = useCallback(
    (endReason: ReportEndReason): AttentionReport | null => {
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

      const scheduledClass = readScheduledClassSession(currentRoom.name);
      return buildAttentionReport({
        data,
        room: currentRoom,
        endReason,
        startedAtMs: startedAtRef.current,
        classId: scheduledClass ? scheduledClass.classId : undefined,
      });
    },
    [attentionRef, roomRef]
  );

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
    [buildReport, user, saveRef]
  );

  return { saveReport, buildReport };
}
