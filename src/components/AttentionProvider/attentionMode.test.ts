import { resolveAttentionMode } from './attentionMode';

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
