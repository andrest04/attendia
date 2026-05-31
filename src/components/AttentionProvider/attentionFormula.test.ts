import { computeAttentionIndex } from './attentionFormula';

describe('computeAttentionIndex', () => {
  it('returns 100 when all components are 100', () => {
    expect(computeAttentionIndex({ eyes: 100, posture: 100, head: 100 })).toBe(100);
  });

  it('returns 0 when all components are 0', () => {
    expect(computeAttentionIndex({ eyes: 0, posture: 0, head: 0 })).toBe(0);
  });

  it('applies weights correctly: 0.40*eyes + 0.30*posture + 0.30*head', () => {
    // 0.40*80 + 0.30*60 + 0.30*50 = 32 + 18 + 15 = 65
    expect(computeAttentionIndex({ eyes: 80, posture: 60, head: 50 })).toBe(65);
  });

  it('rounds to nearest integer', () => {
    // 0.40*70 + 0.30*70 + 0.30*71 = 28 + 21 + 21.3 = 70.3 → 70
    expect(computeAttentionIndex({ eyes: 70, posture: 70, head: 71 })).toBe(70);
  });

  it('clamps values above 100 to 100', () => {
    expect(computeAttentionIndex({ eyes: 110, posture: 110, head: 110 })).toBe(100);
  });

  it('clamps values below 0 to 0', () => {
    expect(computeAttentionIndex({ eyes: -10, posture: -10, head: -10 })).toBe(0);
  });
});
