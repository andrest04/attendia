import { ATTENTION_LEVEL_STYLE } from './attentionLevelStyle';

describe('ATTENTION_LEVEL_STYLE', () => {
  it('defines a complete style for every level', () => {
    (['high', 'medium', 'low'] as const).forEach(level => {
      const style = ATTENTION_LEVEL_STYLE[level];
      Object.values(style).forEach(value => expect(value).toBeTruthy());
    });
  });

  it('names the levels in Spanish', () => {
    expect(ATTENTION_LEVEL_STYLE.high.label).toBe('Alto');
    expect(ATTENTION_LEVEL_STYLE.medium.label).toBe('Medio');
    expect(ATTENTION_LEVEL_STYLE.low.label).toBe('Bajo');
  });

  it('keeps the live badge and the report chip apart: only "medium" differs between them', () => {
    expect(ATTENTION_LEVEL_STYLE.medium.badgeBg).not.toBe(ATTENTION_LEVEL_STYLE.medium.reportChipBg);
    expect(ATTENTION_LEVEL_STYLE.high.badgeBg).toBe(ATTENTION_LEVEL_STYLE.high.reportChipBg);
    expect(ATTENTION_LEVEL_STYLE.low.badgeBg).toBe(ATTENTION_LEVEL_STYLE.low.reportChipBg);
  });

  it('is immutable, so a consumer cannot corrupt the shared styles', () => {
    expect(Object.isFrozen(ATTENTION_LEVEL_STYLE)).toBe(true);
    expect(Object.isFrozen(ATTENTION_LEVEL_STYLE.high)).toBe(true);
    expect(() => {
      (ATTENTION_LEVEL_STYLE.high as any).color = '#000';
    }).toThrow();
  });
});
