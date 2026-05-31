import { computeAverageLuminance, isLightingAdequate, LIGHTING_ADEQUATE_THRESHOLD } from './luminance';

// Builds an RGBA buffer of `count` pixels all set to (r, g, b, 255).
function solidPixels(count: number, r: number, g: number, b: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return data;
}

describe('computeAverageLuminance', () => {
  it('returns 0 for an empty buffer', () => {
    expect(computeAverageLuminance(new Uint8ClampedArray(0))).toBe(0);
  });

  it('returns 0 for pure black', () => {
    expect(computeAverageLuminance(solidPixels(16, 0, 0, 0))).toBe(0);
  });

  it('returns 255 for pure white', () => {
    expect(computeAverageLuminance(solidPixels(16, 255, 255, 255))).toBeCloseTo(255, 5);
  });

  it('weights green more heavily than red and blue (Rec. 601)', () => {
    const green = computeAverageLuminance(solidPixels(4, 0, 255, 0));
    const red = computeAverageLuminance(solidPixels(4, 255, 0, 0));
    const blue = computeAverageLuminance(solidPixels(4, 0, 0, 255));
    expect(green).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(blue);
    expect(green).toBeCloseTo(0.587 * 255, 5);
  });

  it('averages across pixels of differing brightness', () => {
    const data = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
    // One black pixel + one white pixel → average ~127.5
    expect(computeAverageLuminance(data)).toBeCloseTo(127.5, 1);
  });
});

describe('isLightingAdequate', () => {
  it('is false below the threshold', () => {
    expect(isLightingAdequate(LIGHTING_ADEQUATE_THRESHOLD - 1)).toBe(false);
  });

  it('is true at and above the threshold', () => {
    expect(isLightingAdequate(LIGHTING_ADEQUATE_THRESHOLD)).toBe(true);
    expect(isLightingAdequate(LIGHTING_ADEQUATE_THRESHOLD + 50)).toBe(true);
  });
});
