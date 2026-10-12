/*
 * Attention-analysis consent persistence.
 *
 * When REACT_APP_ENABLE_ATTENTION_CV is 'true', students must accept the
 * attention-analysis consent prompt before joining a room. This module persists
 * that acceptance in sessionStorage (scoped to the room name) so that an
 * auto-rejoin after a page refresh does not re-prompt a student who already
 * consented in the same tab session.
 *
 * Mirrors the pattern in rejoinSession.ts:
 *  - sessionStorage: survives refresh, tab-scoped, cleared on tab close
 *  - all reads/writes swallow errors so storage failures never block joining
 */

import { createStorageSlot } from '../../utils/createStorageSlot';

const slot = createStorageSlot<string[]>({
  key: 'twilio-video-attention-consent',
  parse: stored => (Array.isArray(stored) ? (stored as string[]) : null),
});

/** Returns the set of room names for which consent has been given this session. */
function readConsentedRooms(): Set<string> {
  return new Set(slot.read() ?? []);
}

/** Saves the current set of consented rooms back to sessionStorage. */
function writeConsentedRooms(rooms: Set<string>): void {
  slot.write(Array.from(rooms));
}

/** Records that the student has consented to attention analysis for this room. */
export function saveConsent(roomName: string): void {
  const rooms = readConsentedRooms();
  rooms.add(roomName);
  writeConsentedRooms(rooms);
}

/** Returns true iff the student has already consented for this room in the current session. */
export function hasConsent(roomName: string): boolean {
  return readConsentedRooms().has(roomName);
}

/** Removes consent for a specific room (e.g. when the room changes or on explicit revocation). */
export function clearConsent(roomName: string): void {
  const rooms = readConsentedRooms();
  rooms.delete(roomName);
  writeConsentedRooms(rooms);
}
