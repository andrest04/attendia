import { readFileSync } from 'fs';
import { createRoomOpenRateLimiter, ROOM_OPEN_RATE_LIMIT } from '../rateLimit';

const makeReq = (ip: string) =>
  ({
    ip,
    method: 'GET',
    path: '/rooms/clase/open',
    headers: {},
    app: { get: () => false },
  } as any);

const makeRes = () => {
  const res: any = { headersSent: false, statusCode: 200 };
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.setHeader = jest.fn();
  res.getHeader = jest.fn();
  res.append = jest.fn();
  res.on = jest.fn();
  return res;
};

const hit = async (limiter: any, ip: string) => {
  const res = makeRes();
  const next = jest.fn();
  await limiter(makeReq(ip), res, next);
  return { res, next };
};

describe('createRoomOpenRateLimiter', () => {
  it('allows about 30 probes per minute per IP', () => {
    expect(ROOM_OPEN_RATE_LIMIT).toEqual({ windowMs: 60 * 1000, limit: 30 });
  });

  it('answers a JSON 429 with a Spanish explanation once an IP exceeds the limit', async () => {
    const limiter = createRoomOpenRateLimiter({ windowMs: 60 * 1000, limit: 2 });

    expect((await hit(limiter, '203.0.113.1')).next).toHaveBeenCalled();
    expect((await hit(limiter, '203.0.113.1')).next).toHaveBeenCalled();
    const { res, next } = await hit(limiter, '203.0.113.1');

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        message: 'too many requests',
        explanation: 'Demasiadas consultas desde tu conexión. Espera un minuto e intenta de nuevo.',
      },
    });
  });

  it('counts each IP separately', async () => {
    const limiter = createRoomOpenRateLimiter({ windowMs: 60 * 1000, limit: 1 });

    expect((await hit(limiter, '203.0.113.1')).next).toHaveBeenCalled();
    expect((await hit(limiter, '203.0.113.2')).next).toHaveBeenCalled();
    expect((await hit(limiter, '203.0.113.1')).next).not.toHaveBeenCalled();
  });

  it('is mounted only on the public room probe', () => {
    const source = readFileSync(require.resolve('../index'), 'utf8').replace(/\r\n/g, '\n');
    expect(source).toMatch(
      /app\.get\('\/rooms\/:roomName\/open', createRoomOpenRateLimiter\(\), createRoomOpenHandler/
    );
    expect(source.match(/createRoomOpenRateLimiter\(/g)).toHaveLength(1);
  });

  it('trusts X-Forwarded-For only when TRUST_PROXY_HOPS is configured', () => {
    const source = readFileSync(require.resolve('../index'), 'utf8').replace(/\r\n/g, '\n');
    expect(source).toMatch(
      /if \(config\.trustProxyHops !== undefined\) \{\n\s*app\.set\('trust proxy', config\.trustProxyHops\);/
    );
  });
});
