import { RequestHandler } from 'express';
import { encodeBase64Url } from './base64url';
import { getVerifiedUser, sendBadRequest, sendError } from './http';
import { logOperationalFailure } from './operationalEvents';
import { isParticipantConnectedVia, ParticipantFetchingClient } from './twilioGateway';

/*
 * One Twilio identity per uid per room.
 *
 * Twilio disconnects an already-connected participant when another client connects with
 * the same identity, and /token mints whatever identity the client sends. So a token for
 * an identity that is CURRENTLY CONNECTED in the room under another uid is refused (409).
 *
 *   roomIdentities/{identityReservationKey(roomName, identity)} = { uid, roomName, identity, reservedAt }
 *
 * Written in a transaction on every token request. The same uid refreshes its reservation;
 * another uid's reservation is overwritten once Twilio says that identity is no longer
 * connected (left, dropped, or the class closed). Any lookup error propagates so the guard
 * answers 503 (fail-closed).
 *
 * The id joins the base64url of both parts with `.`, which is outside the base64url
 * alphabet (so the split is unambiguous) and Firestore-safe.
 *
 * The identity checked and reserved is the exact string plugin-rtc mints. An identity with
 * leading/trailing whitespace is refused (400) instead of trimmed: honest clients already
 * trim display names, and checking a trimmed copy would let " Ana" bypass the reservation
 * of a participant connected as " Ana".
 */

export const ROOM_IDENTITIES_COLLECTION = 'roomIdentities';

export function identityReservationKey(roomName: string, identity: string): string {
  return `${encodeBase64Url(roomName)}.${encodeBase64Url(identity)}`;
}

interface ReservationSnapshot {
  data(): { [key: string]: any } | undefined;
}

interface ReservationDocumentReference {
  get(): Promise<ReservationSnapshot>;
}

export interface IdentityReservationDatabase {
  collection(name: string): { doc(id: string): ReservationDocumentReference };
  runTransaction<T>(
    updateFunction: (transaction: {
      get(reference: ReservationDocumentReference): Promise<ReservationSnapshot>;
      set(reference: ReservationDocumentReference, data: { [key: string]: any }): unknown;
    }) => Promise<T>
  ): Promise<T>;
}

/** Whether `identity` is connected to the in-progress room `roomName` right now. */
export type ParticipantConnectionChecker = (roomName: string, identity: string) => Promise<boolean>;

export function createParticipantConnectionChecker(client: ParticipantFetchingClient): ParticipantConnectionChecker {
  return (roomName, identity) => isParticipantConnectedVia(client, roomName, identity);
}

export interface IdentityReservationRequest {
  roomName: string;
  identity: string;
  uid: string;
}

export interface IdentityReservationDependencies {
  isConnected: ParticipantConnectionChecker;
  timestamp: () => unknown;
}

/** Resolves true once `uid` holds the identity, false while another uid is connected with it. */
export async function reserveIdentity(
  db: IdentityReservationDatabase,
  { roomName, identity, uid }: IdentityReservationRequest,
  { isConnected, timestamp }: IdentityReservationDependencies
): Promise<boolean> {
  const reservationRef = db.collection(ROOM_IDENTITIES_COLLECTION).doc(identityReservationKey(roomName, identity));
  return db.runTransaction(async transaction => {
    const reservation = (await transaction.get(reservationRef)).data();
    if (reservation && reservation.uid !== uid && (await isConnected(roomName, identity))) return false;
    transaction.set(reservationRef, { uid, roomName, identity, reservedAt: timestamp() });
    return true;
  });
}

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

/**
 * Middleware mounted on /token right after the room access guard. Requests without a room
 * name or identity pass through (the token function rejects them itself).
 */
export function createIdentityReservationGuard(
  db: IdentityReservationDatabase,
  isConnected: ParticipantConnectionChecker,
  timestamp: () => unknown
): RequestHandler {
  return async (req, res, next) => {
    const body = req.body ?? {};
    // The room name is used as sent: it must match the room the token function joins.
    const roomName = typeof body.room_name === 'string' && body.room_name.length > 0 ? body.room_name : undefined;
    const identity = nonEmptyString(body.user_identity);
    if (identity !== undefined && identity !== identity.trim()) {
      sendBadRequest(res, 'invalid identity', 'Tu nombre no puede empezar ni terminar con espacios.');
      return;
    }
    if (!roomName || !identity) {
      next();
      return;
    }

    const user = getVerifiedUser(res);
    if (!user) {
      sendError(res, 401, 'unauthorized', 'Inicia sesión para entrar a la clase.');
      return;
    }

    try {
      if (!(await reserveIdentity(db, { roomName, identity, uid: user.uid }, { isConnected, timestamp }))) {
        sendError(
          res,
          409,
          'identity in use',
          'Ese nombre ya está en uso en esta clase por otra cuenta. Elegí otro nombre para entrar.'
        );
        return;
      }
      next();
    } catch (err) {
      logOperationalFailure({ event: 'identity_reservation_failed', operation: 'POST /token', uid: user.uid, error: err });
      sendError(res, 503, 'identity verification failed', 'No pudimos verificar tu nombre en la sala. Intenta de nuevo en unos segundos.');
    }
  };
}
