import { act, renderHook } from '@testing-library/react-hooks';
import useConfirmDialog from './useConfirmDialog';

describe('useConfirmDialog', () => {
  it('starts closed and without a target', () => {
    const { result } = renderHook(() => useConfirmDialog<{ id: string }>());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.target).toBeNull();
  });

  it('opens on a target', () => {
    const { result } = renderHook(() => useConfirmDialog<{ id: string }>());

    act(() => result.current.open({ id: 'a' }));

    expect(result.current.isOpen).toBe(true);
    expect(result.current.target).toEqual({ id: 'a' });
  });

  it('keeps the target while closing, so the exit animation does not flash', () => {
    const { result } = renderHook(() => useConfirmDialog<{ id: string }>());
    act(() => result.current.open({ id: 'a' }));

    act(() => result.current.close());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.target).toEqual({ id: 'a' });
  });

  it('replaces the target on the next open', () => {
    const { result } = renderHook(() => useConfirmDialog<{ id: string }>());
    act(() => result.current.open({ id: 'a' }));
    act(() => result.current.close());

    act(() => result.current.open({ id: 'b' }));

    expect(result.current.target).toEqual({ id: 'b' });
  });

  it('opens a dialog that is not about anything', () => {
    const { result } = renderHook(() => useConfirmDialog());

    act(() => result.current.open());

    expect(result.current.isOpen).toBe(true);
    expect(result.current.target).toBeNull();
  });

  it('keeps open and close stable across renders', () => {
    const { result, rerender } = renderHook(() => useConfirmDialog());
    const { open, close } = result.current;

    act(() => result.current.open());
    rerender();

    expect(result.current.open).toBe(open);
    expect(result.current.close).toBe(close);
  });
});
