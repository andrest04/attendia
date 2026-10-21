/*
 * Phones are not supported by the platform (tablets and desktops are). Matches iPhone/iPod,
 * Android phones (the Android UA carries "Mobile"; tablets omit it) and any generic "Mobi" UA.
 * Mirror of server/phoneBlockGuard.ts — client and server share no code, keep them in sync.
 */
const PHONE_USER_AGENT = /iPhone|iPod|Mobi/i;

export function isPhoneBlocked(userAgent?: string | null): boolean {
  return typeof userAgent === 'string' && PHONE_USER_AGENT.test(userAgent);
}
