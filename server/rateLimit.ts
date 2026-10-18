import { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { sendError } from './http';

/*
 * Per-IP rate limit for the PUBLIC room probe (GET /rooms/:roomName/open). That route is
 * deliberately unauthenticated (see roomOpen.ts) and every hit is a Twilio REST call, so
 * without a limit anyone could hammer Twilio through it. A student probes once when
 * joining, so ~30 per minute per IP leaves plenty of headroom for a whole class behind
 * one school NAT while still cutting off a scripted flood.
 *
 * The key is `req.ip`. Behind a reverse proxy (Azure Container Apps ingress) `req.ip` is
 * the proxy's address unless Express is told how many hops to trust — that is the
 * TRUST_PROXY_HOPS setting in serverConfig.ts, applied in index.ts. Without it every
 * client shares one bucket; X-Forwarded-For is never trusted blindly.
 *
 * The store is in memory (per instance): good enough for a single container; a scaled-out
 * deployment would need a shared store for an exact global limit.
 */
export const ROOM_OPEN_RATE_LIMIT = { windowMs: 60 * 1000, limit: 30 };

export function createRoomOpenRateLimiter(
  options: { windowMs: number; limit: number } = ROOM_OPEN_RATE_LIMIT
): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      sendError(
        res,
        429,
        'too many requests',
        'Demasiadas consultas desde tu conexión. Espera un minuto e intenta de nuevo.'
      );
    },
  });
}
