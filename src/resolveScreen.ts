/** The one full-page screen the room app shows at a time. */
export type Screen = 'sessionEnded' | 'studentProfile' | 'dashboard' | 'prejoin' | 'room';

export interface ScreenInputs {
  /** The teacher ended the session for everyone. */
  sessionEndedByProfessor: boolean;
  isProfileRoute: boolean;
  initialRole: 'teacher' | 'student' | undefined;
  /** The "between classes" dashboard is active (teachers only, see useDashboardHandoff). */
  dashboardActive: boolean;
  /** The URL is one of the /dashboard/* tab routes. */
  isDashboardTabRoute: boolean;
  roomState: 'disconnected' | 'connected' | 'reconnecting';
}

/**
 * Which screen the room app shows. An ordered decision, first match wins: a session that was
 * ended for everyone trumps everything; the profile route renders for a student without the
 * dashboard around it; any teacher-dashboard condition comes next; otherwise it is the lobby
 * until the room is joined.
 */
export function resolveScreen({
  sessionEndedByProfessor,
  isProfileRoute,
  initialRole,
  dashboardActive,
  isDashboardTabRoute,
  roomState,
}: ScreenInputs): Screen {
  if (sessionEndedByProfessor) return 'sessionEnded';
  if (isProfileRoute && initialRole === 'student') return 'studentProfile';
  if (dashboardActive || isProfileRoute || isDashboardTabRoute) return 'dashboard';
  if (roomState === 'disconnected') return 'prejoin';
  return 'room';
}
