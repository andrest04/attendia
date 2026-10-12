import type { RequestHandler } from 'express';
import { getVerifiedUser, sendError } from './http';
import { logOperationalFailure } from './operationalEvents';
import { resolveIsTeacher, TeacherAuthorizationDatabase } from './teacherAuthorization';
import { completeRoomVia, RoomCompletingClient } from './twilioGateway';

/*
 * "End the session for everyone" for the classroom flow.
 *
 * Twilio's Room is the source of truth, and a client CANNOT force another client
 * out of a room — the only way to truly end a session for all participants is to
 * complete the room via the REST API from the server. Completing the room both
 * disconnects everyone AND frees the unique name, which is exactly the "class is
 * closed" signal the room-access guard relies on (a later join / auto-rejoin then
 * gets a 404 → 403 "class not open" instead of silently re-creating the room).
 *
 * Teacher authorization is now resolved SERVER-SIDE from the Firestore profile
 * using the verified Firebase uid (same pattern as resources.ts and userProfiles.ts).
 * The caller's Firestore role field is the authority — the request body is never
 * trusted for identity.
 *
 * Completing an already-completed (or never-created) room throws a 404; that is
 * treated as success so the endpoint is idempotent — the class is closed either way.
 * Any other Twilio error fails closed with a 503.
 */

export type { RoomCompletingClient };

// Minimal structural Firestore surface — only what is needed to read a user's
// profile doc and check their role. Decouples this unit from firebase-admin.
export type CompleteRoomDatabase = TeacherAuthorizationDatabase;

export function createCompleteRoomHandler(
  twilioClient: RoomCompletingClient,
  db: CompleteRoomDatabase,
): RequestHandler {
  return async (req, res) => {
    const body = req.body ?? {};
    const { room_name } = body;

    if (!room_name) {
      res.status(400).json({
        error: { message: 'room_name is required' },
      });
      return;
    }

    // Resolve teacher identity from the server-verified Firebase profile, not
    // from anything the client sends in the request body. Same pattern as
    // resources.ts and userProfiles.ts.
    const firebaseUser = getVerifiedUser(res);
    if (!firebaseUser) {
      res.status(401).send();
      return;
    }

    try {
      if (!(await resolveIsTeacher(db, firebaseUser.uid))) {
        sendError(res, 403, 'not allowed', 'Solo el docente puede terminar la sesión para todos.');
        return;
      }

      // Idempotent: a 404 (already completed / never created) counts as success.
      await completeRoomVia(twilioClient, room_name);
      res.json({ completed: true });
    } catch (error) {
      logOperationalFailure({
        event: 'room_completion_failed',
        operation: 'POST /completeRoom',
        uid: firebaseUser.uid,
        error,
      });
      sendError(res, 503, 'room completion failed', 'No pudimos terminar la sesión. Intenta de nuevo en unos segundos.');
    }
  };
}
