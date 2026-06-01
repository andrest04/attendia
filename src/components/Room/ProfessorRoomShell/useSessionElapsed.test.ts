import { formatSessionElapsed } from './useSessionElapsed';

describe('formatSessionElapsed', () => {
  it('formats sub-minute durations as 0:00:SS', () => {
    expect(formatSessionElapsed(5)).toBe('0:00:05');
  });

  it('formats minutes and seconds with zero-padding', () => {
    expect(formatSessionElapsed(2723)).toBe('0:45:23');
  });

  it('shows hours once the duration crosses an hour', () => {
    expect(formatSessionElapsed(3661)).toBe('1:01:01');
  });

  it('floors fractional seconds', () => {
    expect(formatSessionElapsed(65.9)).toBe('0:01:05');
  });

  it('clamps negative values to zero', () => {
    expect(formatSessionElapsed(-10)).toBe('0:00:00');
  });
});
