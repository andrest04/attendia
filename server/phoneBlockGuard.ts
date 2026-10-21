import { RequestHandler } from 'express';
import { sendError } from './http';

/*
 * Phones are not supported by the platform; tablets and desktops are. Mounted on /token so a
 * phone cannot obtain a room token even if it bypasses the client screen.
 * Mirror of src/utils/isPhoneBlocked.ts — client and server share no code, keep them in sync.
 */
const PHONE_USER_AGENT = /iPhone|iPod|Mobi/i;

export const isPhoneUserAgent = (userAgent: unknown): boolean =>
  typeof userAgent === 'string' && PHONE_USER_AGENT.test(userAgent);

export function createPhoneBlockGuard(): RequestHandler {
  return (req, res, next) => {
    if (isPhoneUserAgent(req.headers && req.headers['user-agent'])) {
      sendError(
        res,
        403,
        'phones not supported',
        'Esta plataforma no está disponible en celulares. Ingresa desde un computador o tablet.'
      );
      return;
    }
    next();
  };
}
