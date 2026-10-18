import { isLiveAttentionMode, resolveAttentionMode } from './attentionMode';

describe('resolveAttentionMode', () => {
  it.each([
    [true, true, true, 'live'],
    [true, true, false, 'mobile-beacon'],
    [true, false, true, 'mock'],
    [true, false, false, 'mock'],
    [false, true, true, 'mock'],
    [false, true, false, 'mock'],
    [false, false, true, 'mock'],
    [false, false, false, 'mock'],
  ])('flag=%p room=%p desktop=%p → %s', (cvPipelineEnabled, hasRoom, isDesktop, expected) => {
    expect(resolveAttentionMode({ cvPipelineEnabled, hasRoom, isDesktop })).toBe(expected);
  });
});

describe('isLiveAttentionMode', () => {
  it.each([
    ['live', true],
    ['mobile-beacon', true],
    ['mock', false],
  ] as const)('%s → %p', (mode, expected) => {
    expect(isLiveAttentionMode(mode)).toBe(expected);
  });
});
