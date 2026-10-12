import type { RequestHandler } from 'express';
import { ExpressRequest, ExpressResponse, sendError } from './http';
import { logOperationalFailure } from './operationalEvents';
import type { RoomExistenceChecker } from './roomExists';

export type { RoomExistenceChecker };

/*
 * Honest-flow access gate for the /token endpoint.
 *
 * Twilio creates a room on demand: the plugin-rtc token function creates the room
 * when it issues a token (see node_modules/@twilio-labs/plugin-rtc/src/serverless/
 * functions/token.js), and Twilio also creates rooms ad-hoc on Video.connect() when
 * "Client-side Room Creation" is enabled in the Console. Either path means whoever
 * asks for a token first would CREATE and enter the room — so a student could
 * silently open a session the teacher never started.
 *
 * This guard stops that for the normal classroom flow: a student (no teacher suffix
 * in their identity, create_room defaulting to true) only gets a token for a room a
 * teacher has already opened. Teachers may create.
 *
 * IMPORTANT — this is a guardrail, NOT a security boundary. The role is derived from
 * the Twilio identity, which the client sets freely (the student UI just appends
 * `[Profesor]` for teachers), and Firebase authenticates the user, not their claimed
 * role. A determined caller can spoof the suffix, or send create_room:false and rely
 * on ad-hoc creation, to bypass it. To make this an actual control you need:
 *   1. an authenticated role (e.g. a Firebase custom claim) instead of the identity
 *      suffix, AND
 *   2. "Client-side Room Creation" DISABLED in the Twilio Console Room Settings, so a
 *      bare VideoGrant cannot materialise a room on connect (teachers still create
 *      via the server-side REST call in token.js).
 *
 * The suffix check below is intentionally kept in sync with `isTeacherIdentity` in
 * src/components/PreJoinScreens/classSessionTypes.ts (the app's display-side role).
 */

// Mirror of TEACHER_DISPLAY_SUFFIX in src/components/PreJoinScreens/classSessionTypes.ts.
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

/**
 * Strategy for "who is asking?". Today the role is read from the client-set identity
 * suffix (a guardrail, see the note above); making this an authenticated control only
 * means plugging in a resolver backed by something the client cannot forge (the
 * Firestore profile role, a custom claim) — the guard itself does not change.
 */
export type RoleResolver = (req: ExpressRequest, res: ExpressResponse) => ClassRole | Promise<ClassRole>;

export const identitySuffixRole: RoleResolver = req =>
  isTeacherIdentity((req.body ?? {}).user_identity) ? 'teacher' : 'student';

export function createRoomAccessGuard(
  roomExists: RoomExistenceChecker,
  resolveRole: RoleResolver = identitySuffixRole
): RequestHandler {
  return async (req, res, next) => {
    const body = req.body ?? {};
    const { room_name, create_room } = body;

    // Only gate requests that would create the room. create_room defaults to true to
    // match the token function; explicit create_room:false requests (e.g. the passcode
    // verification probe) never create a room here, so they pass straight through.
    const wouldCreateRoom = create_room !== false;

    if (!wouldCreateRoom || !room_name) {
      next();
      return;
    }

    try {
      if ((await resolveRole(req, res)) === 'teacher' || (await roomExists(room_name))) {
        next();
        return;
      }

      sendError(res, 403, 'room not found', 'La sala todavía no está abierta. Pedile al docente que inicie la sesión antes de entrar.');
    } catch (err) {
      logOperationalFailure({ event: 'room_access_check_failed', operation: 'POST /token', error: err });
      sendError(res, 503, 'room verification failed', 'No pudimos verificar la sala. Intenta de nuevo en unos segundos.');
    }
  };
}
