import { renderHook } from '@testing-library/react-hooks';
import useOnChange from './useOnChange';

describe('the useOnChange hook', () => {
  it('does not fire for the value present on mount', () => {
    const onChange = jest.fn();
    renderHook(() => useOnChange(1, onChange));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('fires with the previous and current value when the value changes', () => {
    const onChange = jest.fn();
    const { rerender } = renderHook(({ value }) => useOnChange(value, onChange), { initialProps: { value: 1 } });

    rerender({ value: 2 });
    rerender({ value: 5 });

    expect(onChange.mock.calls).toEqual([
      [1, 2],
      [2, 5],
    ]);
  });

  it('does not fire when the value is unchanged', () => {
    const onChange = jest.fn();
    const { rerender } = renderHook(({ value }) => useOnChange(value, onChange), { initialProps: { value: 'a' } });

    rerender({ value: 'a' });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls the latest callback without needing it in the dependencies', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = renderHook(({ value, cb }) => useOnChange(value, cb), {
      initialProps: { value: 1, cb: first },
    });

    rerender({ value: 2, cb: second });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(1, 2);
  });
});
