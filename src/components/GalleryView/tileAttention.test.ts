import { toTileAttention } from './tileAttention';

const row = (overrides: any = {}) => ({
  identity: 'student',
  index: 20,
  level: 'low' as const,
  multiface: false,
  cameraOff: false,
  faces: 1,
  unsupported: false,
  ...overrides,
});

describe('toTileAttention', () => {
  it('marks a student with a real reading as measured, keeping level and multiface', () => {
    expect(toTileAttention(row({ multiface: true, faces: 2 }))).toEqual({
      level: 'low',
      multiface: true,
      measured: true,
    });
  });

  it.each([
    ['a phone (unsupported device)', { unsupported: true, faces: 0 }],
    ['a camera-on student whose face is not detected', { faces: 0 }],
    ['a student whose camera is off', { cameraOff: true }],
    ['a student whose analysis has no reading yet', { pending: true, faces: 0 }],
  ])('does not mark %s as measured', (_label, overrides) => {
    expect(toTileAttention(row(overrides)).measured).toBe(false);
  });
});
