import { RequestHandler } from 'express';
import { sendError } from './http';
import { isRoomOwner } from './roomOwnership';
import { TeacherAuthorizationDatabase } from './teacherAuthorization';
import { teacherHandler } from './teacherHandler';
import { completeRoomVia, RoomCompletingClient as CompletingClient } from './twilioGateway';

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
 * Authorization runs through teacherHandler (verified uid → Firestore profile role) and
 * then requires roomOwners/{room} to name this uid (roomOwnership.ts): a teacher can only
 * end a class they own. The request body is never trusted for identity.
 *
 * Completing an already-completed (or never-created) room throws a 404; that is
 * treated as success so the endpoint is idempotent — the class is closed either way.
 * Any other Twilio error fails closed with a 503.
 */

export type RoomCompletingClient = CompletingClient;

// Minimal structural Firestore surface — only what is needed to read a user's
// profile doc and check their role. Decouples this unit from firebase-admin.
export type CompleteRoomDatabase = TeacherAuthorizationDatabase;

export function createCompleteRoomHandler(
  twilioClient: RoomCompletingClient,
  db: CompleteRoomDatabase,
): RequestHandler {
  return teacherHandler(
    db,
    {
      forbiddenMessage: 'not allowed',
      forbiddenExplanation: 'Solo el docente puede terminar la sesión para todos.',
      failure: {
        event: 'room_completion_failed',
        operation: 'POST /completeRoom',
        message: 'room completion failed',
        explanation: 'No pudimos terminar la sesión. Intenta de nuevo en unos segundos.',
      },
      preValidate: (req, res) => {
        if ((req.body ?? {}).room_name) return true;
        res.status(400).json({ error: { message: 'room_name is required' } });
        return false;
      },
    },
    async ({ uid, req, res }) => {
      const { room_name } = req.body;
      // Only the teacher who owns the room (roomOwners, claimed with their token) may end it.
      if (!(await isRoomOwner(db, room_name, uid))) {
        sendError(res, 403, 'room not owned', 'Solo el docente a cargo de esta clase puede terminarla para todos.');
        return;
      }

      // Idempotent: a 404 (already completed / never created) counts as success.
      await completeRoomVia(twilioClient, room_name);
      res.json({ completed: true });
    },
  );
}
