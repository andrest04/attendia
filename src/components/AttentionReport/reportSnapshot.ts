import { AttentionReportViewData } from './AttentionReportView';

/*
 * Hand-off channel for the "open report in a new tab" flow. The report data
 * lives in memory in the in-room tab (built from the live useAttention() context);
 * a new browser tab is a separate document with no access to that React tree or
 * the Twilio room. So at click time we snapshot the already-normalized view data
 * into localStorage (shared across same-origin tabs — sessionStorage is NOT) and
 * the /report page reads it back. The report is a point-in-time snapshot by
 * nature, so a static copy is exactly right; it never needs to update live.
 *
 * All reads/writes swallow storage errors (private mode, quota) — the same
 * defensive posture as rejoinSession/attentionConsent.
 */

export const REPORT_SNAPSHOT_KEY = 'attendia-report-snapshot';

/** Persist the report snapshot so a newly opened /report tab can render it. */
export function saveReportSnapshot(data: AttentionReportViewData): void {
  try {
    localStorage.setItem(REPORT_SNAPSHOT_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable — the /report tab will show its empty state */
  }
}

/**
 * Read back the report snapshot for the /report page. Returns null when there is
 * no snapshot (tab opened directly, storage cleared, or a parse/storage error).
 * JSON turns `reportDate` into a string, so it is revived back into a Date.
 */
export function loadReportSnapshot(): AttentionReportViewData | null {
  try {
    const raw = localStorage.getItem(REPORT_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AttentionReportViewData;
    return { ...parsed, reportDate: new Date(parsed.reportDate) };
  } catch {
    return null;
  }
}
