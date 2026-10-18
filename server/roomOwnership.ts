import { encodeBase64Url } from './base64url';
import { RoomExistenceChecker } from './roomExists';

/*
 * Who owns a classroom room, recorded server-side.
 *
 *   roomOwners/{roomOwnerKey(roomName)} = { uid, roomName, claimedAt }
 *
 * Claimed when a PROFILE-VERIFIED teacher gets a token for the room (see the token guard
 * in roomAccessGuard.ts). A room name is reusable once its class is closed, so another
 * uid's claim only blocks while that room is currently open in Twilio; otherwise the
 * newcomer takes it over.
 *
 * The document id is the base64url of the room name: a room name is client input, and
 * Firestore rejects (or re-routes) ids containing `/`, `.`/`..` or `__x__`. The plain name
 * is kept as a field for readability.
 *
 * Like the other route leaves, this module has zero firebase-admin imports: the
 * structural interfaces below are satisfied by the real admin Firestore instance.
 */

export const ROOM_OWNERS_COLLECTION = 'roomOwners';

export interface OwnershipSnapshot {
  exists?: boolean;
  data(): { [key: string]: any } | undefined;
}

export interface OwnershipDocumentReference {
  get(): Promise<OwnershipSnapshot>;
}

export interface RoomClaimTransaction {
  get(reference: OwnershipDocumentReference): Promise<OwnershipSnapshot>;
  set(reference: OwnershipDocumentReference, data: { [key: string]: any }): unknown;
}

export interface RoomClaimDatabase {
  collection(name: string): { doc(id: string): OwnershipDocumentReference };
  runTransaction<T>(updateFunction: (transaction: RoomClaimTransaction) => Promise<T>): Promise<T>;
}

export interface RoomClaimDependencies {
  roomExists: RoomExistenceChecker;
  timestamp: () => unknown;
}

/** Resolves true once `uid` owns the room, false while another uid's class is open there. */
export type RoomClaimer = (roomName: string, uid: string) => Promise<boolean>;

export function roomOwnerKey(roomName: string): string {
  return encodeBase64Url(roomName);
}

/**
 * Claims roomOwners for `uid` in one transaction. Refuses (false) only when another uid
 * owns the name AND that room is open right now; a Twilio/Firestore failure propagates so
 * the caller fails closed.
 */
export async function claimRoomOwnership(
  db: RoomClaimDatabase,
  roomName: string,
  uid: string,
  { roomExists, timestamp }: RoomClaimDependencies
): Promise<boolean> {
  const ownerRef = db.collection(ROOM_OWNERS_COLLECTION).doc(roomOwnerKey(roomName));
  return db.runTransaction(async transaction => {
    const owner = (await transaction.get(ownerRef)).data();
    if (owner && owner.uid !== uid && (await roomExists(roomName))) return false;
    transaction.set(ownerRef, { uid, roomName, claimedAt: timestamp() });
    return true;
  });
}

export function createRoomClaimer(db: RoomClaimDatabase, dependencies: RoomClaimDependencies): RoomClaimer {
  return (roomName, uid) => claimRoomOwnership(db, roomName, uid, dependencies);
}
