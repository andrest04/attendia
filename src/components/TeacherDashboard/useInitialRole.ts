import { useLocation, useParams } from 'react-router-dom';
import { useAppState } from '../../state';
import { getResumableSession } from '../PreJoinScreens/rejoinSession';
import { isTeacherIdentity } from '../PreJoinScreens/classSessionTypes';
import { firstResolved } from '../../utils/firstResolved';

/**
 * Resolves which role ('teacher' | 'student') a fresh page load should start as,
 * BEFORE any prejoin/session state exists. Priority (highest wins):
 *   1. A verified Firestore profile role (firebase auth mode) — wins over everything.
 *   2. A persisted rejoin-session identity for this exact room (refresh case) — its
 *      identity encodes the correct role via the [Profesor] suffix.
 *   3. A student deep link (`/room/:URLRoomName` with no resumable session) → student.
 *   4. The role selected on the login screen (`location.state.preJoinRole`).
 *   5. Default: teacher.
 *
 * Extracted from PreJoinScreens.tsx so App.tsx can use the same resolution to decide
 * whether to show the TeacherDashboard before the prejoin lobby. This is a pure
 * extraction — byte-for-byte the same priority chain PreJoinScreens used inline.
 */
type Role = 'teacher' | 'student';

interface RoleSignals {
  profileRole?: Role;
  resumableIdentity?: string;
  urlRoomName?: string;
  preJoinRole?: Role;
}

// The priority list, highest first (see the numbered list above). A rule that does not apply
// answers `undefined`, and the next one is asked.
const ROLE_RESOLVERS: Array<(signals: RoleSignals) => Role | undefined> = [
  ({ profileRole }) => profileRole,
  ({ resumableIdentity }) =>
    resumableIdentity === undefined ? undefined : isTeacherIdentity(resumableIdentity) ? 'teacher' : 'student',
  ({ urlRoomName }) => (urlRoomName ? 'student' : undefined),
  ({ preJoinRole }) => (preJoinRole === 'student' ? 'student' : undefined),
];

export default function useInitialRole(): Role {
  const { profile } = useAppState();
  const { URLRoomName } = useParams<{ URLRoomName?: string }>();
  const location = useLocation<{ preJoinRole?: Role }>();
  const resumable = getResumableSession(URLRoomName);

  return (
    firstResolved<RoleSignals, Role>(
      {
        profileRole: profile?.role,
        resumableIdentity: resumable?.identity,
        urlRoomName: URLRoomName,
        preJoinRole: location.state?.preJoinRole,
      },
      ROLE_RESOLVERS
    ) ?? 'teacher'
  );
}
