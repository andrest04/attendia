import { classifyAttention } from './presence';

describe('classifyAttention', () => {
  it('measures a participant with the camera on and a detected face', () => {
    expect(classifyAttention({ cameraOff: false, faces: 1 })).toBe('measured');
    expect(classifyAttention({ cameraOff: false, faces: 2 })).toBe('measured');
  });

  it('treats a sample without a face count as measured (ad-hoc fixtures)', () => {
    expect(classifyAttention({ cameraOff: false })).toBe('measured');
  });

  it('flags a camera that is off', () => {
    expect(classifyAttention({ cameraOff: true, faces: 0 })).toBe('cameraOff');
  });

  it('flags a camera that is on but finds no face', () => {
    expect(classifyAttention({ cameraOff: false, faces: 0 })).toBe('noFace');
  });

  it('flags an unsupported device before anything else', () => {
    expect(classifyAttention({ cameraOff: true, unsupported: true, faces: 0 })).toBe('unsupported');
    expect(classifyAttention({ cameraOff: false, unsupported: true })).toBe('unsupported');
  });

  it('does not treat unsupported=false as unsupported', () => {
    expect(classifyAttention({ cameraOff: false, unsupported: false, faces: 1 })).toBe('measured');
  });
});
