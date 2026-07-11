import { useLocation, useParams } from 'react-router-dom';
import { useAppState } from '../../state';
import { getResumableSession } from '../PreJoinScreens/rejoinSession';
import { isTeacherIdentity } from '../PreJoinScreens/classSessionTypes';

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
export default function useInitialRole(): 'teacher' | 'student' {
  const { profile } = useAppState();
  const { URLRoomName } = useParams<{ URLRoomName?: string }>();
  const location = useLocation<{ preJoinRole?: 'teacher' | 'student' }>();
  const preJoinRole = location.state?.preJoinRole;
  const resumable = getResumableSession(URLRoomName);

  return profile
    ? profile.role
    : resumable
    ? isTeacherIdentity(resumable.identity)
      ? 'teacher'
      : 'student'
    : URLRoomName
    ? 'student'
    : preJoinRole === 'student'
    ? 'student'
    : 'teacher';
}
