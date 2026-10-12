import { useEffect, useState } from 'react';
import useLatest from '../useLatest/useLatest';

interface AsyncResourceOptions<T> {
  /** Shown when the failure carries no message of its own. */
  failureMessage: string;
  /**
   * Releases a loaded value when it is superseded, the component unmounts, or it arrives after
   * the request was already abandoned (e.g. revoking an object URL).
   */
  dispose?: (value: T) => void;
}

/**
 * Loads one resource when `load` changes and tracks its result. `null` means "nothing to load
 * (yet)": the hook stays idle. The standalone pages each hand-rolled this effect with a
 * `cancelled` flag; here a response that arrives after unmount or after `load` changed is
 * dropped instead of being written into state.
 *
 * Memoize `load` (useCallback/useMemo) on what it depends on: its identity is the effect's
 * trigger, so a fresh function every render would fetch on every render. State only changes
 * when a request settles (an error is cleared by the next success, not when a request starts),
 * so an identical outcome never causes another render.
 */
export default function useAsyncResource<T>(
  load: (() => Promise<T>) | null,
  { failureMessage, dispose }: AsyncResourceOptions<T>
): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const disposeRef = useLatest(dispose);
  const failureMessageRef = useLatest(failureMessage);

  useEffect(() => {
    if (!load) return;

    let cancelled = false;
    let loaded: { value: T } | null = null;
    const release = (value: T) => disposeRef.current?.(value);

    load().then(
      value => {
        if (cancelled) {
          release(value);
          return;
        }
        loaded = { value };
        setError(null);
        setData(value);
      },
      err => {
        if (!cancelled) setError((err && err.message) || failureMessageRef.current);
      }
    );

    return () => {
      cancelled = true;
      if (loaded) release(loaded.value);
    };
  }, [load, disposeRef, failureMessageRef]);

  return { data, error };
}
