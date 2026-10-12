import { renderHook } from '@testing-library/react-hooks';
import useLatest from './useLatest';

describe('the useLatest hook', () => {
  it('starts with the initial value', () => {
    const { result } = renderHook(() => useLatest('a'));
    expect(result.current.current).toBe('a');
  });

  it('follows the latest value while keeping the same ref object', () => {
    const { result, rerender } = renderHook(({ value }) => useLatest(value), { initialProps: { value: 1 } });
    const ref = result.current;

    rerender({ value: 2 });

    expect(result.current).toBe(ref);
    expect(ref.current).toBe(2);
  });
});
