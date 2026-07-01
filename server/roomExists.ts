/*
 * Returns whether an in-progress Twilio room with this unique name exists.
 *
 * Fetching a room by its unique name returns the in-progress room, or throws a 404
 * once the room has ended (the unique name is freed on completion). That 404 is
 * exactly the "is this class open?" signal the room-access guard relies on.
 *
 * Any non-404 error (network, throttling, auth) is rethrown so the guard fails closed
 * with a 503 instead of mistaking a Twilio outage for "room missing".
 */

// Minimal structural shape of the Twilio client used here — keeps this unit decoupled
// from the full Twilio types and trivially mockable in tests.
export interface RoomFetchingClient {
  video: {
    // Address the versioned resource (v1) directly. The un-versioned `video.rooms`
    // shortcut still works but logs a deprecation warning in twilio-node v5.
    v1: { rooms(roomName: string): { fetch(): Promise<unknown> } };
  };
}

export type RoomExistenceChecker = (roomName: string) => Promise<boolean>;

export function createRoomExists(twilioClient: RoomFetchingClient): RoomExistenceChecker {
  return async (roomName: string): Promise<boolean> => {
    try {
      await twilioClient.video.v1.rooms(roomName).fetch();
      return true;
    } catch (err: any) {
      if (err && err.status === 404) {
        return false;
      }
      throw err;
    }
  };
}
