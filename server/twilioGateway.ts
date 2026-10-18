/**
 * Adapter over the Twilio REST SDK for the three places this server talks to it
 * (room lookup, room completion, composition media). It owns the Twilio-specific
 * semantics so route modules do not have to know them:
 *
 *   - a 404 from Twilio is a DOMAIN signal, not a failure (a freed unique room name
 *     means "the class is closed"; completing a missing room is already done);
 *   - the composition media endpoint has no typed resource in twilio-node, so its raw
 *     authenticated request and redirect handling live here, not in a handler.
 *
 * The client types are deliberately minimal structural slices (not the full Twilio
 * types), so each caller only needs to provide the capability it uses and tests can pass
 * tiny fakes. This module never constructs a client; see twilioClient.ts for that.
 */

/** twilio-node surfaces a missing resource as an error carrying `status: 404`. */
export function isTwilioNotFound(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { status?: unknown }).status === 404;
}

// ─── Rooms ──────────────────────────────────────────────────────────────────────

// Address the versioned resource (v1) directly. The un-versioned `video.rooms`
// shortcut still works but logs a deprecation warning in twilio-node v5.
export interface RoomFetchingClient {
  video: { v1: { rooms(roomName: string): { fetch(): Promise<unknown> } } };
}

export interface RoomCompletingClient {
  video: { v1: { rooms(roomName: string): { update(props: { status: 'completed' }): Promise<unknown> } } };
}

/**
 * Whether an in-progress room with this unique name exists. Fetching by unique name
 * returns the room, or a 404 once it has ended. Any non-404 error (network, throttling,
 * auth) is rethrown so callers fail closed instead of mistaking an outage for "missing".
 */
export async function roomExistsVia(client: RoomFetchingClient, roomName: string): Promise<boolean> {
  try {
    await client.video.v1.rooms(roomName).fetch();
    return true;
  } catch (error) {
    if (isTwilioNotFound(error)) return false;
    throw error;
  }
}

export interface RoomDetails {
  sid: string;
  uniqueName: string;
  /** When Twilio created the room (twilio-node parses it into a Date). */
  dateCreated?: Date;
}

export interface RoomDetailsClient {
  video: { v1: { rooms(roomSid: string): { fetch(): Promise<RoomDetails> } } };
}

/**
 * Looks a room up by SID — unlike a unique-name lookup, this still finds a COMPLETED
 * room, so it can answer "which room name did this SID belong to?" after the class ends.
 * A 404 (unknown SID) resolves null; any other error is rethrown so callers fail closed.
 */
export async function fetchRoomVia(client: RoomDetailsClient, roomSid: string): Promise<RoomDetails | null> {
  try {
    const room = await client.video.v1.rooms(roomSid).fetch();
    return { sid: room.sid, uniqueName: room.uniqueName, dateCreated: room.dateCreated };
  } catch (error) {
    if (isTwilioNotFound(error)) return null;
    throw error;
  }
}

/**
 * Completes the room (disconnecting everyone and freeing its unique name). Idempotent:
 * a 404 means it was already completed or never existed — the class is closed either way.
 */
export async function completeRoomVia(client: RoomCompletingClient, roomName: string): Promise<void> {
  try {
    await client.video.v1.rooms(roomName).update({ status: 'completed' });
  } catch (error) {
    if (isTwilioNotFound(error)) return;
    throw error;
  }
}

// ─── Composition media ──────────────────────────────────────────────────────────

export interface MediaRequestingClient {
  // Raw authenticated request, already signed with the client's own credentials.
  // Method is lowercase to match twilio-node's own HttpMethod type.
  request<T = any>(opts: {
    method: 'get' | 'post' | 'put' | 'patch' | 'delete';
    uri: string;
    headers?: { [key: string]: string };
    allowRedirects?: boolean;
  }): Promise<{ statusCode: number; body: T; headers: { [key: string]: any } }>;
}

/**
 * Resolves the short-lived, Twilio-signed URL of a composition's media. twilio-node has
 * no typed resource for the Composition Media redirect, so this issues a raw request
 * through the client's own pipeline (same API Key credentials as every other call) — the
 * Account SID/Auth Token never leave the server. Twilio answers either with a 302 and a
 * Location header, or (with the explicit JSON Accept header we send) a 200 body of
 * `{ redirect_to }`; both are handled.
 */
export async function resolveCompositionMediaUrl(client: MediaRequestingClient, compositionSid: string): Promise<string> {
  const response = await client.request<{ redirect_to?: string }>({
    method: 'get',
    uri: `https://video.twilio.com/v1/Compositions/${encodeURIComponent(compositionSid)}/Media?Ttl=3600`,
    headers: { Accept: 'application/json' },
    allowRedirects: false,
  });

  const mediaUrl = response.body?.redirect_to || response.headers?.location;
  if (!mediaUrl) {
    throw new Error('Twilio composition media response had no redirect location');
  }
  return mediaUrl;
}
