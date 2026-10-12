import { MutableRefObject, useEffect, useRef } from 'react';

/**
 * Keeps a ref pointing at the latest value, so a long-lived callback (an event listener,
 * an interval, a data-channel handler) can read fresh props/state without being torn down
 * and re-registered on every change.
 *
 * The ref is updated in an effect after each commit — never during render — which is the
 * same idiom the codebase used by hand (`ref.current = x` inside a `useEffect`) in a dozen
 * places. Declare it BEFORE any effect that reads it so the value is current by then.
 */
export default function useLatest<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
