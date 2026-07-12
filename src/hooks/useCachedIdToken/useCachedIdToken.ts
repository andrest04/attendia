import { useEffect, useRef } from 'react';
import { User } from 'firebase/auth';

// Refresh well inside Firebase's ~1h ID token lifetime so the cached value is
// always usable, without hammering getIdToken() on every render.
export const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Caches `user.getIdToken()` in a ref, refreshed on an interval while a firebase
 * `user` is present. A synchronous `beforeunload`/`pagehide` handler (see
 * Room.tsx) cannot await an async token fetch, so it reads `tokenRef.current`
 * instead — best-effort by construction: the value can be up to
 * REFRESH_INTERVAL_MS stale, but that's an acceptable tradeoff for a fire-and-
 * forget keepalive request backed by the localStorage retry queue.
 *
 * Same latest-value-ref idiom as useAttentionReportSaver/useSessionEnd: the
 * returned ref is referentially stable, its `.current` is always the freshest
 * fetched token.
 */
export default function useCachedIdToken(user: User | null | undefined) {
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      tokenRef.current = null;
      return;
    }

    let cancelled = false;
    const refresh = () => {
      user
        .getIdToken()
        .then(token => {
          if (!cancelled) {
            tokenRef.current = token;
          }
        })
        .catch(err => {
          console.error('useCachedIdToken: failed to refresh the cached id token', err);
        });
    };

    refresh();
    const intervalId = window.setInterval(refresh, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [user]);

  return tokenRef;
}
