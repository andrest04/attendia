import { isLiveAttentionMode, resolveAttentionMode } from './attentionMode';

describe('resolveAttentionMode', () => {
  it.each([
    [true, true, true, 'live'],
    [true, true, false, 'mobile-beacon'],
    [true, false, true, 'off'],
    [true, false, false, 'off'],
    [false, true, true, 'off'],
    [false, true, false, 'off'],
    [false, false, true, 'off'],
    [false, false, false, 'off'],
  ])('flag=%p room=%p desktop=%p → %s', (cvPipelineEnabled, hasRoom, isDesktop, expected) => {
    expect(resolveAttentionMode({ cvPipelineEnabled, hasRoom, isDesktop })).toBe(expected);
  });
});

describe('isLiveAttentionMode', () => {
  it.each([
    ['live', true],
    ['mobile-beacon', true],
    ['off', false],
  ] as const)('%s → %p', (mode, expected) => {
    expect(isLiveAttentionMode(mode)).toBe(expected);
  });
});
