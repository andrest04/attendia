/** Focus, tab-visible and manual re-checks closer together than this are ignored (the endpoint is rate-limited). */
export const REPROBE_MIN_GAP_MS = 3000;

/** Whether an on-demand re-probe may run now, given when the previous probe ran (null = never). */
export function shouldReprobe(nowMs: number, lastProbeAtMs: number | null, minGapMs = REPROBE_MIN_GAP_MS): boolean {
  if (lastProbeAtMs === null) return true;
  const elapsed = nowMs - lastProbeAtMs;
  return elapsed < 0 || elapsed >= minGapMs;
}
