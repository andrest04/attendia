import { classifyProctoring, PROCTORING_KINDS } from './proctoring';

const sample = (overrides: any = {}) => ({ cameraOff: false, faces: 1, index: 80, ...overrides });

describe('classifyProctoring', () => {
  it('raises nothing for an attentive student with one face', () => {
    expect(classifyProctoring(sample())).toBeNull();
  });

  it.each([
    ['camera off', sample({ cameraOff: true }), 'camera-off'],
    ['no face detected', sample({ faces: 0 }), 'absent'],
    ['more than one face', sample({ faces: 2 }), 'multiface'],
    ['sustained low attention with one face', sample({ index: 40 }), 'away'],
  ])('flags %s', (_label, input, kind) => {
    expect(classifyProctoring(input)).toBe(kind);
  });

  it('only flags "away" up to the low-attention boundary', () => {
    expect(classifyProctoring(sample({ index: 40 }))).toBe('away');
    expect(classifyProctoring(sample({ index: 41 }))).toBeNull();
  });

  it('applies the priority order: camera off beats no face beats multiple faces beats low attention', () => {
    expect(classifyProctoring(sample({ cameraOff: true, faces: 0, index: 0 }))).toBe('camera-off');
    expect(classifyProctoring(sample({ faces: 0, index: 0 }))).toBe('absent');
    expect(classifyProctoring(sample({ faces: 3, index: 0 }))).toBe('multiface');
  });

  it('never flags a student whose analysis has no reading yet (not an absence)', () => {
    expect(classifyProctoring({ cameraOff: false, faces: 0, index: 0, pending: true })).toBeNull();
  });

  it('never flags a device that cannot measure (mobile)', () => {
    expect(classifyProctoring(sample({ unsupported: true, cameraOff: true, faces: 0 }))).toBeNull();
  });
});

describe('PROCTORING_KINDS', () => {
  it('defines label, student warning and confidence for every kind', () => {
    (Object.keys(PROCTORING_KINDS) as Array<keyof typeof PROCTORING_KINDS>).forEach(kind => {
      const info = PROCTORING_KINDS[kind];
      expect(info.label).toBeTruthy();
      expect(info.studentWarning).toBeTruthy();
      expect(info.confidence).toBeGreaterThan(0);
      expect(info.confidence).toBeLessThanOrEqual(1);
    });
  });

  it('is softer about "away" (an inference) than about the binary signals', () => {
    expect(PROCTORING_KINDS.away.confidence).toBeLessThan(PROCTORING_KINDS.absent.confidence);
  });
});
