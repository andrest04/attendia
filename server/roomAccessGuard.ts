import { RequestHandler } from 'express';
import { ExpressRequest, ExpressResponse, getVerifiedUser, sendError } from './http';
import { logOperationalFailure } from './operationalEvents';
import { RoomExistenceChecker as RoomExistenceCheck } from './roomExists';
import { RoomClaimer } from './roomOwnership';
import { resolveIsTeacher, TeacherAuthorizationDatabase } from './teacherAuthorization';

export type RoomExistenceChecker = RoomExistenceCheck;

/*
 * Access gate for the /token endpoint.
 *
 * Twilio creates a room on demand: the plugin-rtc token function creates the room
 * when it issues a token (see node_modules/@twilio-labs/plugin-rtc/src/serverless/
 * functions/token.js), and Twilio also creates rooms ad-hoc on Video.connect() when
 * "Client-side Room Creation" is enabled in the Console. Either path means whoever
 * asks for a token first would CREATE and enter the room — so a student could
 * silently open a session the teacher never started.
 *
 * The guard therefore:
 *   - resolves the caller's role through a pluggable RoleResolver. Production wires
 *     `createProfileRoleResolver`: an identity carrying the teacher suffix is a teacher
 *     ONLY when the verified uid's Firestore profile says role=teacher; a suffix without
 *     that profile is answered 403 (it would otherwise impersonate the professor);
 *   - lets a student (no suffix) get a token only for a room that is already open;
 *   - for a teacher, claims roomOwners/{room} for the verified uid (roomOwnership.ts) and
 *     lets a second teacher into an OPEN room as co-teacher (no ownership change) and answers
 *     403 only while another teacher's fresh claim on that name has no open room yet;
 *   - treats create_room:false (join-only) as "the room must already exist" instead of
 *     a blind pass-through.
 *
 * Remaining caveats: the teacher role itself is still self-declared at registration
 * (product decision), and "Client-side Room Creation" should be DISABLED in the Twilio
 * Console so a bare VideoGrant cannot materialise a room on connect.
 *
 * The suffix check below is intentionally kept in sync with `isTeacherIdentity` in
 * src/classSession/classSessionTypes.ts (the app's display-side role).
 */

// Mirror of TEACHER_DISPLAY_SUFFIX in src/classSession/classSessionTypes.ts.
// Keep both in sync.
const TEACHER_DISPLAY_SUFFIX = '[Profesor]';

export function isTeacherIdentity(identity: unknown): boolean {
  if (typeof identity !== 'string') return false;
  return identity
    .trim()
    .toLowerCase()
    .endsWith(TEACHER_DISPLAY_SUFFIX.toLowerCase());
}

export type ClassRole = 'teacher' | 'student';

/** A teacher-suffixed identity whose verified profile is NOT a teacher. */
export type ResolvedRole = ClassRole | 'unverified-teacher';

/**
 * Strategy for "who is asking?". `identitySuffixRole` reads only the client-set identity
 * suffix (kept for tests and as the documented default); `createProfileRoleResolver`
 * backs the suffix with the Firestore profile role — the guard itself does not change.
 */
export type RoleResolver = (req: ExpressRequest, res: ExpressResponse) => ResolvedRole | Promise<ResolvedRole>;

export const identitySuffixRole: RoleResolver = req =>
  isTeacherIdentity((req.body ?? {}).user_identity) ? 'teacher' : 'student';

export function createProfileRoleResolver(db: TeacherAuthorizationDatabase): RoleResolver {
  return async (req, res) => {
    if (!isTeacherIdentity((req.body ?? {}).user_identity)) return 'student';
    const user = getVerifiedUser(res);
    if (!user) return 'unverified-teacher';
    return (await resolveIsTeacher(db, user.uid)) ? 'teacher' : 'unverified-teacher';
  };
}

const sendRoomNotOpen = (res: ExpressResponse) =>
  sendError(res, 403, 'room not found', 'La sala todavía no está abierta. Pedile al docente que inicie la sesión antes de entrar.');

export function createRoomAccessGuard(
  roomExists: RoomExistenceChecker,
  resolveRole: RoleResolver = identitySuffixRole,
  claimRoom?: RoomClaimer
): RequestHandler {
  return async (req, res, next) => {
    const body = req.body ?? {};
    const { room_name, create_room } = body;
    // create_room defaults to true to match the token function.
    const joinOnly = create_room === false;

    try {
      const role = await resolveRole(req, res);
      if (role === 'unverified-teacher') {
        sendError(res, 403, 'teacher role required', 'Solo una cuenta de docente puede entrar a la sala como profesor.');
        return;
      }

      if (!room_name) {
        if (joinOnly) {
          sendError(res, 400, 'room_name is required', 'Falta el nombre de la sala.');
          return;
        }
        // A room-creating request without a name is rejected by the token function itself.
        next();
        return;
      }

      // Join-only never creates the room, so it must already be open — for any role.
      const knownOpen = joinOnly ? await roomExists(room_name) : undefined;
      if (knownOpen === false) {
        sendRoomNotOpen(res);
        return;
      }

      if (role === 'teacher') {
        if (claimRoom) {
          const user = getVerifiedUser(res);
          if (!user) {
            sendError(res, 403, 'teacher role required', 'Solo una cuenta de docente puede entrar a la sala como profesor.');
            return;
          }
          if (!(await claimRoom(room_name, user.uid))) {
            sendError(
              res,
              403,
              'room owned by another teacher',
              'Ya hay una clase en curso con ese nombre a cargo de otro docente. Elegí otro nombre para tu sesión.'
            );
            return;
          }
        }
        next();
        return;
      }

      if (knownOpen || (await roomExists(room_name))) {
        next();
        return;
      }
      sendRoomNotOpen(res);
    } catch (err) {
      logOperationalFailure({ event: 'room_access_check_failed', operation: 'POST /token', error: err });
      sendError(res, 503, 'room verification failed', 'No pudimos verificar la sala. Intenta de nuevo en unos segundos.');
    }
  };
}
