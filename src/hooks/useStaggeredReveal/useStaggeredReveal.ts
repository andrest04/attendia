import { useEffect, useState } from 'react';

/**
 * Reveals a list of items one-by-one over time, top to bottom.
 *
 * Returns how many items are currently "revealed". A row at index `i` is
 * revealed once the returned count is greater than `i`. Used by the pre-join
 * device checklist so the checks appear to run sequentially instead of
 * resolving all at once (detection is near-instant, so this is purely a
 * perceived-progress affordance).
 */
export default function useStaggeredReveal(count: number, intervalMs = 500, startDelayMs = 250): number {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    setRevealed(0);
    if (count <= 0) {
      return;
    }

    const timers: number[] = [];
    for (let i = 0; i < count; i++) {
      timers.push(window.setTimeout(() => setRevealed(i + 1), startDelayMs + i * intervalMs));
    }

    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [count, intervalMs, startDelayMs]);

  return revealed;
}
