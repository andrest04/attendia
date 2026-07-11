import { useEffect, useRef, useState } from 'react';

type PendingSession = { roomName: string; name: string } | null;

interface DashboardHandoff {
  dashboardActive: boolean;
  pendingSession: PendingSession;
  handleStartClass: (session: { roomName: string; name: string }) => void;
  handleStartBlankClass: () => void;
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
 */
export default function useDashboardHandoff(initialRole: 'teacher' | 'student', roomState: string): DashboardHandoff {
  const [dashboardActive, setDashboardActive] = useState(initialRole === 'teacher');
  const [pendingSession, setPendingSession] = useState<PendingSession>(null);

  const handleStartClass = (session: { roomName: string; name: string }) => {
    setPendingSession(session);
    setDashboardActive(false);
  };

  const handleStartBlankClass = () => {
    setPendingSession(null);
    setDashboardActive(false);
  };

  const previousRoomStateRef = useRef(roomState);
  useEffect(() => {
    const previousRoomState = previousRoomStateRef.current;
    previousRoomStateRef.current = roomState;
    if (previousRoomState !== 'disconnected' && roomState === 'disconnected') {
      setPendingSession(null);
      if (initialRole === 'teacher') {
        setDashboardActive(true);
      }
    }
  }, [roomState, initialRole]);

  return { dashboardActive, pendingSession, handleStartClass, handleStartBlankClass };
}
