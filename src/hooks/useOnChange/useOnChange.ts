import { useEffect, useRef } from 'react';
import useLatest from '../useLatest/useLatest';

/**
 * Calls `onChange(previous, current)` after a render in which `value` changed (by identity).
 * Never fires for the value present on mount, so already-existing state does not look like
 * an event. Replaces the hand-rolled `prev = useRef(value)` + `useEffect` + compare +
 * `prev.current = value` skeleton (and its `exhaustive-deps` suppression): the callback is
 * read through a ref, so it always sees fresh props without re-running the effect.
 */
export default function useOnChange<T>(value: T, onChange: (previous: T, current: T) => void) {
  const previous = useRef(value);
  const latest = useLatest(onChange);

  useEffect(() => {
    const before = previous.current;
    previous.current = value;
    if (!Object.is(before, value)) {
      latest.current(before, value);
    }
  }, [value, latest]);
}
