import { act, renderHook } from '@testing-library/react-hooks';
import useStaggeredReveal from './useStaggeredReveal';

describe('useStaggeredReveal', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('starts with nothing revealed', () => {
    const { result } = renderHook(() => useStaggeredReveal(4, 500, 250));
    expect(result.current).toBe(0);
  });

  it('reveals items one at a time, top to bottom', () => {
    const { result } = renderHook(() => useStaggeredReveal(3, 500, 250));

    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(result.current).toBe(1);

    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current).toBe(2);

    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current).toBe(3);
  });

  it('does not exceed the requested count', () => {
    const { result } = renderHook(() => useStaggeredReveal(2, 500, 250));
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(2);
  });

  it('reveals nothing for a count of zero', () => {
    const { result } = renderHook(() => useStaggeredReveal(0));
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(0);
  });

  it('clears pending timers on unmount', () => {
    const clearSpy = jest.spyOn(window, 'clearTimeout');
    const { unmount } = renderHook(() => useStaggeredReveal(4, 500, 250));
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
