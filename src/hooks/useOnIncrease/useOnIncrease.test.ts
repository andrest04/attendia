import { renderHook } from '@testing-library/react-hooks';
import useOnIncrease from './useOnIncrease';

describe('the useOnIncrease hook', () => {
  it('does not fire for the value present on mount', () => {
    const callback = jest.fn();
    renderHook(() => useOnIncrease(3, callback));
    expect(callback).not.toHaveBeenCalled();
  });

  it('fires each time the value increases', () => {
    const callback = jest.fn();
    const { rerender } = renderHook(({ value }) => useOnIncrease(value, callback), { initialProps: { value: 0 } });

    rerender({ value: 1 });
    rerender({ value: 2 });

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('does not fire when the value decreases or stays the same', () => {
    const callback = jest.fn();
    const { rerender } = renderHook(({ value }) => useOnIncrease(value, callback), { initialProps: { value: 5 } });

    rerender({ value: 5 });
    rerender({ value: 2 });

    expect(callback).not.toHaveBeenCalled();
  });
});
