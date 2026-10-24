/*
 * Best-effort "is this class open?" probe for the student prejoin step.
 *
 * Mirrors the server room-access guard's question — is there an in-progress Twilio
 * room with this unique name? — WITHOUT requesting a token, so the student UI can warn
 * "the class isn't open yet" before walking the student through the device-selection
 * waiting room, instead of only finding out when they hit "Entrar a la sala".
 *
 * Returns:
 *   true  -> the room is open
 *   false -> the room is not open (the server said so)
 *   null  -> we could not determine it (network/server error). The caller should fall
 *            back to letting the student proceed; the POST /token room-access guard is
 *            the real gate and will still block a genuinely closed room.
 */
import { acceptLanguageHeader } from '../i18n/locale';

export async function checkRoomOpen(roomName: string): Promise<boolean | null> {
  if (!roomName) return null;

  try {
    const response = await fetch(`/rooms/${encodeURIComponent(roomName)}/open`, {
      headers: { Accept: 'application/json', ...acceptLanguageHeader() },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return typeof data?.open === 'boolean' ? data.open : null;
  } catch {
    return null;
  }
}
