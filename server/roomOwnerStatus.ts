import { RequestHandler } from 'express';
import { OwnershipReadDatabase, readRoomOwnerUid } from './roomOwnership';
import { TeacherAuthorizationDatabase } from './teacherAuthorization';
import { teacherHandler } from './teacherHandler';

/*
 * GET /rooms/:roomName/ownership -> { isOwner } for the verified uid.
 *
 * The client uses it to hide owner-only controls (end for everyone, recording, saving the
 * report) from a co-teacher. The server still refuses those actions on its own, so this is
 * only about not showing buttons that would fail.
 *
 * A room with NO owner doc yet reports isOwner true: nobody else owns it, so the caller must
 * never be shown as a co-teacher (the first claim will make them the owner). Only another
 * uid on record yields false.
 */
export type RoomOwnerStatusDatabase = TeacherAuthorizationDatabase & OwnershipReadDatabase;

export function createRoomOwnerStatusHandler(db: RoomOwnerStatusDatabase): RequestHandler {
  return teacherHandler(
    db,
    {
      forbiddenExplanation: 'Solo el docente puede consultar esta información.',
      failure: {
        event: 'room_owner_status_failed',
        operation: 'GET /rooms/:roomName/ownership',
        message: 'room ownership lookup failed',
        explanation: 'No pudimos verificar tu rol en la sala.',
      },
    },
    async ({ uid, req, res }) => {
      const ownerUid = await readRoomOwnerUid(db, req.params.roomName);
      res.json({ isOwner: ownerUid === undefined || ownerUid === uid });
    }
  );
}
