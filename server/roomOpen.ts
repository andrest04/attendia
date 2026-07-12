import type { RequestHandler } from 'express';
import type { RoomExistenceChecker } from './roomExists';

/*
 * Read-only "is this class open?" probe for the student prejoin flow.
 *
 * Unlike POST /token, this endpoint NEVER creates a room — it only reports whether
 * an in-progress Twilio room with this unique name exists, so the student UI can
 * tell a student that a session isn't open yet BEFORE walking them through the
 * device-selection waiting room (instead of only when they hit "Entrar a la sala").
 *
 * IMPORTANT — this is a UX affordance, NOT the enforcement point. The real gate is
 * the room-access guard on POST /token (see roomAccessGuard.ts); this only moves the
 * feedback earlier. For that reason it is intentionally NOT behind authMiddleware:
 * it leaks nothing more than a room-name existence boolean, and requiring the
 * mode-specific token (firebase) here would couple the early check to the auth layer
 * for no security benefit (the role itself is already a client-set guardrail).
 *
 * It fails loud (503) on a Twilio error rather than reporting { open: false }, so the
 * client can fall back to "let the student proceed and let the /token guard decide"
 * instead of wrongly blocking a class that is actually open during a Twilio hiccup.
 */
export function createRoomOpenHandler(roomExists: RoomExistenceChecker): RequestHandler {
  return async (req, res) => {
    const roomName = req.params?.roomName;

    if (!roomName) {
      res.status(400).json({
        error: { message: 'room_name is required' },
      });
      return;
    }

    try {
      const open = await roomExists(roomName);
      res.json({ open });
    } catch (err) {
      console.error('roomOpen: could not verify room existence', err);
      res.status(503).json({
        error: {
          message: 'room verification failed',
          explanation: 'No pudimos verificar la sala. Intenta de nuevo en unos segundos.',
        },
      });
    }
  };
}
