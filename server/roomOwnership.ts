import { RequestHandler } from 'express';
import { encodeBase64Url } from './base64url';
import { timestampMillis } from './firestoreTime';
import { sendBadRequest, sendError } from './http';
import { RoomExistenceChecker } from './roomExists';
import { TeacherAuthorizationDatabase } from './teacherAuthorization';
import { teacherHandler } from './teacherHandler';
import { fetchRoomVia, RoomDetails, RoomDetailsClient } from './twilioGateway';

/*
 * Who owns a classroom room, recorded server-side.
 *
 *   roomOwners/{roomOwnerKey(roomName)} = { uid, roomName, claimedAt, refreshedAt }
 *
 * Claimed when a PROFILE-VERIFIED teacher gets a token for the room (see the token guard
 * in roomAccessGuard.ts). A room name is reusable once its class is closed, so another
 * uid's claim only blocks while that room is currently open in Twilio, or while the claim
 * is fresh (FRESH_CLAIM_WINDOW_MS: plugin-rtc creates the room only AFTER the guard, so a
 * just-claimed room may not exist yet); otherwise the newcomer takes it over.
 *
 * `claimedAt` marks when THIS uid's ownership began: it is set on the first claim and on a
 * takeover, and kept on every same-uid re-claim (refresh, auto-rejoin, reopening the room
 * later). `refreshedAt` is bumped on every claim and only feeds the fresh window. The
 * session binder uses `claimedAt` to refuse a room SID created before the current owner
 * took the name over (a previous teacher's class).
 *
 * The document id is the base64url of the room name: a room name is client input, and
 * Firestore rejects (or re-routes) ids containing `/`, `.`/`..` or `__x__`. The plain name
 * is kept as a field for readability.
 *
 *   roomSessions/{roomSid} = { uid, roomName, boundAt }
 *
 * Binds one Twilio room SID (one class session) to the teacher who ran it. Created on the
 * first POST /reports, after Twilio confirms the SID's unique name is the report's room
 * and roomOwners says this uid has owned that room since before it was created; first writer wins (`create()`). Recording
 * requests require it, so a teacher cannot request a composition of someone else's class.
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
  /** Clock for the fresh-claim window (defaults to Date.now). */
  now?: () => number;
}

/** Another uid's claim younger than this counts as live even before its room exists. */
export const FRESH_CLAIM_WINDOW_MS = 60 * 1000;

/** Tolerated drift between Firestore's claim timestamp and Twilio's room creation time. */
export const ROOM_CLAIM_CLOCK_SKEW_MS = 5 * 1000;

/** Resolves true once `uid` owns the room, false while another uid's class is open there. */
export type RoomClaimer = (roomName: string, uid: string) => Promise<boolean>;

export function roomOwnerKey(roomName: string): string {
  return encodeBase64Url(roomName);
}

function isFreshClaim(owner: { [key: string]: any }, now: number): boolean {
  const times = [timestampMillis(owner.claimedAt), timestampMillis(owner.refreshedAt)].filter(
    (value): value is number => value !== null
  );
  return times.length > 0 && now - Math.max(...times) < FRESH_CLAIM_WINDOW_MS;
}

/**
 * Claims roomOwners for `uid` in one transaction. Refuses (false) only when another uid
 * owns the name AND (its claim is fresh OR that room is open right now); a Twilio/Firestore
 * failure propagates so the caller fails closed.
 */
export async function claimRoomOwnership(
  db: RoomClaimDatabase,
  roomName: string,
  uid: string,
  { roomExists, timestamp, now = Date.now }: RoomClaimDependencies
): Promise<boolean> {
  const ownerRef = db.collection(ROOM_OWNERS_COLLECTION).doc(roomOwnerKey(roomName));
  return db.runTransaction(async transaction => {
    const owner = (await transaction.get(ownerRef)).data();
    if (owner && owner.uid !== uid && (isFreshClaim(owner, now()) || (await roomExists(roomName)))) return false;
    const keepClaimedAt = owner !== undefined && owner.uid === uid && owner.claimedAt !== undefined;
    const claimedAt = keepClaimedAt ? owner!.claimedAt : timestamp();
    transaction.set(ownerRef, { uid, roomName, claimedAt, refreshedAt: timestamp() });
    return true;
  });
}

export function createRoomClaimer(db: RoomClaimDatabase, dependencies: RoomClaimDependencies): RoomClaimer {
  return (roomName, uid) => claimRoomOwnership(db, roomName, uid, dependencies);
}

// ─── Ownership reads ─────────────────────────────────────────────────────────────

export const ROOM_SESSIONS_COLLECTION = 'roomSessions';

/** Any Firestore slice that can read a document by collection + id. */
export interface OwnershipReadDatabase {
  collection(name: string): { doc(id: string): OwnershipDocumentReference };
}

async function readOwnerUid(db: OwnershipReadDatabase, collection: string, id: string): Promise<string | undefined> {
  const data = (await db.collection(collection).doc(id).get()).data();
  return data && typeof data.uid === 'string' ? data.uid : undefined;
}

async function readRoomOwner(db: OwnershipReadDatabase, roomName: string): Promise<{ [key: string]: any } | undefined> {
  return (await db.collection(ROOM_OWNERS_COLLECTION).doc(roomOwnerKey(roomName)).get()).data();
}

export async function isRoomOwner(db: OwnershipReadDatabase, roomName: string, uid: string): Promise<boolean> {
  return (await readOwnerUid(db, ROOM_OWNERS_COLLECTION, roomOwnerKey(roomName))) === uid;
}

/** `roomSid` must already be validated (ROOM_SID_PATTERN) — it is used as a document id. */
export async function isRoomSessionOwner(db: OwnershipReadDatabase, roomSid: string, uid: string): Promise<boolean> {
  return (await readOwnerUid(db, ROOM_SESSIONS_COLLECTION, roomSid)) === uid;
}

// ─── Room session binding ────────────────────────────────────────────────────────

export type RoomDetailsFetcher = (roomSid: string) => Promise<RoomDetails | null>;

export function createRoomDetailsFetcher(client: RoomDetailsClient): RoomDetailsFetcher {
  return roomSid => fetchRoomVia(client, roomSid);
}

export interface RoomSessionDocumentReference extends OwnershipDocumentReference {
  create(data: { [key: string]: any }): Promise<unknown>;
}

export interface RoomSessionDatabase {
  collection(name: string): { doc(id: string): RoomSessionDocumentReference };
}

export interface RoomSessionClaim {
  roomSid: string;
  roomName: string;
  uid: string;
}

export type RoomSessionVerdict =
  | 'bound'
  | 'foreign-session'
  | 'room-mismatch'
  | 'not-room-owner'
  | 'stale-owner'
  | 'room-not-found';

/** Binds (or confirms) roomSessions/{roomSid} for the claim; Twilio/Firestore errors propagate. */
export type RoomSessionBinder = (claim: RoomSessionClaim) => Promise<RoomSessionVerdict>;

/**
 * The owner may bind a SID only if its ownership began before Twilio created that room
 * (within the clock skew). A later claimedAt means the name changed hands after this class
 * started: the SID belongs to the previous owner. Unknown times fail closed.
 */
function claimPredatesRoom(owner: { [key: string]: any }, room: RoomDetails): boolean {
  const claimedAt = timestampMillis(owner.claimedAt);
  const createdAt = timestampMillis(room.dateCreated);
  return claimedAt !== null && createdAt !== null && claimedAt <= createdAt + ROOM_CLAIM_CLOCK_SKEW_MS;
}

function verdictForBoundSession(session: { [key: string]: any }, { roomName, uid }: RoomSessionClaim): RoomSessionVerdict {
  if (session.uid !== uid) return 'foreign-session';
  return session.roomName === roomName ? 'bound' : 'room-mismatch';
}

// firebase-admin surfaces gRPC ALREADY_EXISTS as code 6 on a create() collision.
function isAlreadyExists(error: unknown): boolean {
  const code = !!error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  return code === 6 || code === 'already-exists';
}

export function createRoomSessionBinder(
  db: RoomSessionDatabase,
  fetchRoom: RoomDetailsFetcher,
  timestamp: () => unknown
): RoomSessionBinder {
  return async claim => {
    const sessionRef = db.collection(ROOM_SESSIONS_COLLECTION).doc(claim.roomSid);
    const existing = (await sessionRef.get()).data();
    if (existing) return verdictForBoundSession(existing, claim);

    // A completed room still fetches by SID, so a report saved after the class works.
    const room = await fetchRoom(claim.roomSid);
    if (!room) return 'room-not-found';
    if (room.uniqueName !== claim.roomName) return 'room-mismatch';
    const owner = await readRoomOwner(db, claim.roomName);
    if (!owner || owner.uid !== claim.uid) return 'not-room-owner';
    if (!claimPredatesRoom(owner, room)) return 'stale-owner';

    try {
      await sessionRef.create({ uid: claim.uid, roomName: claim.roomName, boundAt: timestamp() });
      return 'bound';
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
      // Lost a create race: the winner decides.
      const winner = (await sessionRef.get()).data();
      return winner ? verdictForBoundSession(winner, claim) : 'foreign-session';
    }
  };
}

// ─── /recordingrules gate ────────────────────────────────────────────────────────

/**
 * Middleware in front of plugin-rtc's recordingrules function (which updates the rules of
 * whatever room_sid it is given): only a teacher who owns the room behind room_sid passes.
 */
export function createRecordingRulesGuard(db: TeacherAuthorizationDatabase, fetchRoom: RoomDetailsFetcher): RequestHandler {
  return teacherHandler(
    db,
    {
      forbiddenExplanation: 'Solo el docente puede cambiar la grabación de la clase.',
      failure: {
        event: 'recording_rules_check_failed',
        operation: 'POST /recordingrules',
        message: 'recording rules check failed',
        explanation: 'No pudimos verificar la sala. Intenta de nuevo en unos segundos.',
      },
      preValidate: (req, res) => {
        const roomSid = (req.body ?? {}).room_sid;
        if (typeof roomSid === 'string' && roomSid.length > 0) return true;
        sendBadRequest(res, 'room_sid is required', 'Falta el identificador de la sala.');
        return false;
      },
    },
    async ({ uid, req, res, next }) => {
      const room = await fetchRoom(req.body.room_sid);
      if (!room || !(await isRoomOwner(db, room.uniqueName, uid))) {
        sendError(res, 403, 'room not owned', 'Solo el docente a cargo de esta clase puede cambiar su grabación.');
        return;
      }
      next();
    }
  );
}
