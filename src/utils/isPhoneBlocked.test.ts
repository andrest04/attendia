import { isPhoneBlocked } from './isPhoneBlocked';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPOD = 'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const ANDROID_PHONE =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const ANDROID_TABLET =
  'Mozilla/5.0 (Linux; Android 14; SM-X900) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const IPAD =
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1';
const DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

describe('isPhoneBlocked', () => {
  it.each([
    ['iPhone', IPHONE],
    ['iPod', IPOD],
    ['Android phone', ANDROID_PHONE],
    ['generic Mobi', 'Foo/1.0 Mobi'],
  ])('blocks %s', (_name, ua) => {
    expect(isPhoneBlocked(ua)).toBe(true);
  });

  it.each([
    ['Android tablet', ANDROID_TABLET],
    ['iPad', IPAD],
    ['desktop', DESKTOP],
  ])('allows %s', (_name, ua) => {
    expect(isPhoneBlocked(ua)).toBe(false);
  });

  it('allows an empty or missing user agent', () => {
    expect(isPhoneBlocked('')).toBe(false);
    expect(isPhoneBlocked(undefined)).toBe(false);
  });
});
