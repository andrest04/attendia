import type { RequestHandler } from 'express';
import { isTeacherIdentity } from './roomAccessGuard';

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
 * IMPORTANT — like the room-access guard, the teacher check here is a UX guardrail,
 * NOT a security boundary: the role is the client-set identity suffix. A determined
 * caller could spoof it. See roomAccessGuard.ts for the full threat-model note and
 * what real enforcement would require. The suffix check reuses isTeacherIdentity so
 * both stay in sync.
 *
 * Completing an already-completed (or never-created) room throws a 404; that is
 * treated as success so the endpoint is idempotent — the class is closed either way.
 * Any other Twilio error fails closed with a 503.
 */

// Minimal structural shape of the Twilio client used here — keeps this unit
// decoupled from the full Twilio types and trivially mockable in tests.
export interface RoomCompletingClient {
  video: {
    // Address the versioned resource (v1) directly. The un-versioned `video.rooms`
    // shortcut still works but logs a deprecation warning in twilio-node v5.
    v1: { rooms(roomName: string): { update(props: { status: 'completed' }): Promise<unknown> } };
  };
}

export function createCompleteRoomHandler(twilioClient: RoomCompletingClient): RequestHandler {
  return async (req, res) => {
    const body = req.body ?? {};
    const { room_name, user_identity } = body;

    if (!room_name) {
      res.status(400).json({
        error: { message: 'room_name is required' },
      });
      return;
    }

    // Only a teacher may end the session for everyone. Students get 403.
    if (!isTeacherIdentity(user_identity)) {
      res.status(403).json({
        error: {
          message: 'not allowed',
          explanation: 'Solo el docente puede terminar la sesión para todos.',
        },
      });
      return;
    }

    try {
      await twilioClient.video.v1.rooms(room_name).update({ status: 'completed' });
      res.json({ completed: true });
    } catch (err: any) {
      // 404 = the room was already completed or never existed; the class is closed
      // either way, so report success and keep the endpoint idempotent.
      if (err && err.status === 404) {
        res.json({ completed: true });
        return;
      }
      console.error('completeRoom: could not complete room', err);
      res.status(503).json({
        error: {
          message: 'room completion failed',
          explanation: 'No pudimos terminar la sesión. Intenta de nuevo en unos segundos.',
        },
      });
    }
  };
}
