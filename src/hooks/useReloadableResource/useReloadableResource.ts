import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react';

interface ReloadableResourceOptions<T> {
  /** The value before the first load settles (and after a failed one). */
  initial: T;
  /** Shown when the failure carries no message of its own. */
  failureMessage: string;
  /** Prefix of the console error logged on failure. */
  logLabel: string;
}

/**
 * A remote value the screen loads on mount, can reload on demand, and also edits locally after
 * a mutation (`setData`): loading flag, last error, and the fetch-log-message-finally ritual the
 * teacher dashboard repeated for classes and for reports.
 *
 * `fetch` undefined means the API is not available (non-firebase mode): nothing loads. Memoize
 * `fetch`: its identity is what triggers the load, and `reload` changes with it.
 */
export default function useReloadableResource<T>(
  fetch: (() => Promise<T>) | undefined,
  { initial, failureMessage, logLabel }: ReloadableResourceOptions<T>
): {
  data: T;
  setData: Dispatch<SetStateAction<T>>;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [data, setData] = useState<T>(initial);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!fetch) return;
    setIsLoading(true);
    setError(null);
    fetch()
      .then(value => setData(() => value))
      .catch(err => {
        console.error(logLabel, err);
        setError(err.message || failureMessage);
      })
      .finally(() => setIsLoading(false));
    // `logLabel` and `failureMessage` are constants at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetch]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, setData, isLoading, error, reload };
}
