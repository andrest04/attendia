import { useEffect, useRef, useState } from 'react';
import { clearDashboardHandoff, readDashboardHandoff, saveDashboardHandoff } from './dashboardHandoffSession';

type PendingSession = { roomName: string; name: string } | null;

interface DashboardHandoff {
  dashboardActive: boolean;
  pendingSession: PendingSession;
  handleStartClass: (session: { roomName: string; name: string }) => void;
  handleStartBlankClass: () => void;
  handleReturnToDashboard: () => void;
}

/**
 * Owns the one-time "teacher landing dashboard, then drop into the prejoin flow" handoff
 * used by App.tsx. Extracted (rather than left inline) so the room-ended reset below — the
 * part App.tsx previously got wrong — can be covered by a real effect-flushing test instead
 * of a shallow-rendered one (shallow never fires useEffect).
 *
 * A class actually ran and ended (roomState left 'disconnected' and came back), not the
 * initial mount (which starts 'disconnected' too, with no prior transition). Without this
 * reset, `pendingSession` from the FIRST class the teacher started would stick around
 * forever: every later disconnect would re-render PreJoinScreens with that same stale class
 * instead of returning the teacher to the dashboard to pick their next one.
 *
 * The handoff itself (dashboard -> prejoin, with whichever session was picked) is mirrored
 * into sessionStorage via dashboardHandoffSession so a page refresh on the prejoin lobby
 * doesn't bounce the teacher back to the dashboard and discard the class they were joining.
 */
export default function useDashboardHandoff(initialRole: 'teacher' | 'student', roomState: string): DashboardHandoff {
  const persistedHandoff = initialRole === 'teacher' ? readDashboardHandoff() : null;
  const [dashboardActive, setDashboardActive] = useState(initialRole === 'teacher' && persistedHandoff === null);
  const [pendingSession, setPendingSession] = useState<PendingSession>(
    persistedHandoff ? persistedHandoff.pendingSession : null
  );

  const handleStartClass = (session: { roomName: string; name: string }) => {
    setPendingSession(session);
    setDashboardActive(false);
    saveDashboardHandoff(session);
  };

  const handleStartBlankClass = () => {
    setPendingSession(null);
    setDashboardActive(false);
    saveDashboardHandoff(null);
  };

  // Back affordance for the prejoin lobby ("Volver al panel"): abandons the pending
  // session (if any) and re-activates the dashboard without a class having run.
  const handleReturnToDashboard = () => {
    setPendingSession(null);
    setDashboardActive(true);
    clearDashboardHandoff();
  };

  const previousRoomStateRef = useRef(roomState);
  useEffect(() => {
    const previousRoomState = previousRoomStateRef.current;
    previousRoomStateRef.current = roomState;
    if (previousRoomState !== 'disconnected' && roomState === 'disconnected') {
      setPendingSession(null);
      clearDashboardHandoff();
      if (initialRole === 'teacher') {
        setDashboardActive(true);
      }
    }
  }, [roomState, initialRole]);

  return { dashboardActive, pendingSession, handleStartClass, handleStartBlankClass, handleReturnToDashboard };
}
