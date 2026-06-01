import { useEffect, useRef, useState } from 'react';

/**
 * Formats elapsed seconds as `H:MM:SS` (hours always shown), matching the
 * session-bar clock in the S4 wireframe (e.g. `0:45:23`).
 */
export function formatSessionElapsed(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${hours}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Ticks once per second and returns the elapsed session time as `H:MM:SS`,
 * counting from the moment the professor shell mounts.
 *
 * Local-only stub (US12-adjacent): when real session metadata lands, seed the
 * start time from the room's connect timestamp instead of mount time.
 */
export default function useSessionElapsed(): string {
  const startRef = useRef<number>(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(intervalId);
  }, []);

  return formatSessionElapsed(elapsedSeconds);
}
