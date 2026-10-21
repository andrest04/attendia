import { createPhoneBlockGuard } from '../phoneBlockGuard';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148';
const ANDROID_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120.0 Mobile Safari/537.36';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Version/17.0 Safari/604.1';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36';

const run = (userAgent?: string) => {
  const req: any = { headers: userAgent === undefined ? {} : { 'user-agent': userAgent } };
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  const next = jest.fn();
  createPhoneBlockGuard()(req, res, next);
  return { res, next };
};

describe('createPhoneBlockGuard', () => {
  it.each([
    ['iPhone', IPHONE],
    ['Android phone', ANDROID_PHONE],
  ])('answers 403 JSON in Spanish for %s', (_n, ua) => {
    const { res, next } = run(ua);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    const body = res.json.mock.calls[0][0];
    expect(body.error.message).toBe('phones not supported');
    expect(body.error.explanation).toContain('celulares');
  });

  it.each([
    ['iPad', IPAD],
    ['desktop', DESKTOP],
  ])('lets %s through', (_n, ua) => {
    const { res, next } = run(ua);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('lets a request without a user agent through', () => {
    const { next } = run(undefined);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
