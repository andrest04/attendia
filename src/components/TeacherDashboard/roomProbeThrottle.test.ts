import { REPROBE_MIN_GAP_MS, shouldReprobe } from './roomProbeThrottle';

describe('shouldReprobe', () => {
  it('allows the very first probe', () => {
    expect(shouldReprobe(1000, null)).toBe(true);
  });

  it('ignores a request made within the minimum gap of the last probe', () => {
    expect(shouldReprobe(1000, 1000)).toBe(false);
    expect(shouldReprobe(1000 + REPROBE_MIN_GAP_MS - 1, 1000)).toBe(false);
  });

  it('allows a request once the minimum gap has passed', () => {
    expect(shouldReprobe(1000 + REPROBE_MIN_GAP_MS, 1000)).toBe(true);
  });

  it('honours a custom gap and tolerates a clock that went backwards', () => {
    expect(shouldReprobe(5000, 4000, 500)).toBe(true);
    expect(shouldReprobe(900, 1000)).toBe(true);
  });
});
