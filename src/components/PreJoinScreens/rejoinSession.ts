/*
 * Auto-rejoin session persistence.
 *
 * A full page refresh tears down the Twilio `Room` (the app's source of truth),
 * so the app falls back to the lobby even though the URL still points at /room/:name.
 * To reconnect automatically we persist just enough to re-derive the whole session:
 * the room name and the Twilio identity used to join. The role (teacher/student) is
 * encoded in the identity itself (see `isTeacherIdentity`), so the identity alone
 * restores the correct room shell after reconnecting.
 *
 * sessionStorage is intentional: it survives a refresh but is scoped to the tab and
 * cleared when the tab closes, avoiding a new tab on the same link auto-joining with
 * a stale identity.
 */

import { createStorageSlot } from '../../utils/createStorageSlot';

export interface RejoinSession {
  roomName: string;
  identity: string;
}

const slot = createStorageSlot<RejoinSession>({
  key: 'twilio-video-rejoin-session',
  parse: stored => {
    const parsed = stored as { roomName?: unknown; identity?: unknown } | null;
    return parsed && typeof parsed.roomName === 'string' && typeof parsed.identity === 'string'
      ? { roomName: parsed.roomName, identity: parsed.identity }
      : null;
  },
});

// Storage can be unavailable (private mode, blocked cookies). Auto-rejoin is a convenience, so a
// failure here never breaks joining a room (see createStorageSlot).
export const saveRejoinSession = (session: RejoinSession): void => slot.write(session);

export const readRejoinSession = (): RejoinSession | null => slot.read();

export const clearRejoinSession = (): void => slot.clear();

/**
 * Returns the stored session only when it belongs to the room currently in the URL.
 * This guards against a stale session hijacking a fresh /room/:name deep link.
 */
export function getResumableSession(urlRoomName: string | undefined | null): RejoinSession | null {
  if (!urlRoomName) return null;

  const session = readRejoinSession();
  if (!session) return null;

  return session.roomName === urlRoomName ? session : null;
}
