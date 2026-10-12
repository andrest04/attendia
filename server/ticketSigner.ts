import crypto from 'crypto';
import { decodeBase64Url, encodeBase64Url } from './base64url';

/**
 * Short-lived HMAC-SHA256 tickets: `${base64url(JSON payload)}.${hex(hmac)}`.
 *
 * `window.open` cannot attach an Authorization header, so ticket-only endpoints
 * (e.g. the recording download) authorize with one of these instead of
 * firebaseAuthMiddleware. The signer only proves the payload was issued by this server
 * and has not been tampered with; the caller owns the payload's shape and expiry.
 */
export interface TicketSigner {
  issue(payload: object): string;
  /** Returns the decoded payload when the signature is valid, otherwise undefined. */
  verify(ticket: unknown): unknown | undefined;
}

export function createTicketSigner(secret: string): TicketSigner {
  const sign = (payloadB64: string): string =>
    crypto
      .createHmac('sha256', secret)
      .update(payloadB64)
      .digest('hex');

  return {
    issue(payload) {
      const payloadB64 = encodeBase64Url(JSON.stringify(payload));
      return `${payloadB64}.${sign(payloadB64)}`;
    },

    verify(ticket) {
      if (typeof ticket !== 'string') return undefined;
      const separatorIndex = ticket.lastIndexOf('.');
      if (separatorIndex <= 0) return undefined;

      const payloadB64 = ticket.slice(0, separatorIndex);
      const signatureBuffer = Buffer.from(ticket.slice(separatorIndex + 1), 'hex');
      const expectedBuffer = Buffer.from(sign(payloadB64), 'hex');
      // Constant-time comparison; a length mismatch is rejected up front because
      // timingSafeEqual throws on unequal lengths.
      if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        return undefined;
      }

      try {
        return JSON.parse(decodeBase64Url(payloadB64).toString('utf8'));
      } catch {
        return undefined;
      }
    },
  };
}
