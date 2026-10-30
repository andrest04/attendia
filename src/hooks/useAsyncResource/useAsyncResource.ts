import { useEffect, useState } from 'react';
import useLatest from '../useLatest/useLatest';

// Only ordinary Error instances with an own data message are interchangeable by text.
// Accessor-backed messages (such as localized API errors) can diverge on a later render.
function staticErrorMessage(reason: any): string | undefined {
  if (!reason || Object.getPrototypeOf(reason) !== Error.prototype) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(reason, 'message');
  return descriptor && 'value' in descriptor && typeof descriptor.value === 'string' ? descriptor.value : undefined;
}

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
 * so an identical outcome need not cause another render.
 */
export default function useAsyncResource<T>(
  load: (() => Promise<T>) | null,
  { failureMessage, dispose }: AsyncResourceOptions<T>
): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [failure, setFailure] = useState<{ reason: any; fallback: string } | null>(null);
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
        setFailure(null);
        setData(value);
      },
      err => {
        if (!cancelled) {
          const fallback = failureMessageRef.current;
          setFailure(previous => {
            if (previous && previous.fallback === fallback) {
              if (Object.is(previous.reason, err)) return previous;
              const priorMessage = staticErrorMessage(previous.reason);
              if (priorMessage !== undefined && priorMessage === staticErrorMessage(err)) return previous;
            }
            return { reason: err, fallback };
          });
        }
      }
    );

    return () => {
      cancelled = true;
      if (loaded) release(loaded.value);
    };
  }, [load, disposeRef, failureMessageRef]);

  const error = failure ? (failure.reason && failure.reason.message) || failure.fallback : null;
  return { data, error };
}
