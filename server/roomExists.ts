import { roomExistsVia, RoomFetchingClient } from './twilioGateway';

/*
 * Returns whether an in-progress Twilio room with this unique name exists.
 *
 * Fetching a room by its unique name returns the in-progress room, or throws a 404
 * once the room has ended (the unique name is freed on completion). That 404 is
 * exactly the "is this class open?" signal the room-access guard relies on; see
 * twilioGateway.ts for the Twilio-specific details.
 *
 * Any non-404 error (network, throttling, auth) is rethrown so the guard fails closed
 * with a 503 instead of mistaking a Twilio outage for "room missing".
 */
export type { RoomFetchingClient };

export type RoomExistenceChecker = (roomName: string) => Promise<boolean>;

export function createRoomExists(twilioClient: RoomFetchingClient): RoomExistenceChecker {
  return (roomName: string) => roomExistsVia(twilioClient, roomName);
}
