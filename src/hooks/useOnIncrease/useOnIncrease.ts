import useOnChange from '../useOnChange/useOnChange';

/**
 * Calls `callback()` after a render in which the numeric `value` went up. Built on
 * useOnChange, so the value present on mount never counts as an increase (already-existing
 * state must not look like an event); decreases and no-ops are ignored.
 */
export default function useOnIncrease(value: number, callback: () => void) {
  useOnChange(value, (previous, current) => {
    if (current > previous) callback();
  });
}
