/*
 * Dashboard handoff persistence.
 *
 * `useDashboardHandoff` decides whether the teacher lands on the dashboard or the
 * prejoin lobby by initializing `dashboardActive` from `initialRole` alone. That's
 * fine on first login, but a page refresh remounts `App` and re-runs that same
 * initializer — so a teacher who left the dashboard for the prejoin lobby (to create
 * or pick a class) gets bounced back to the dashboard on refresh, discarding the
 * class they were about to join.
 *
 * sessionStorage mirrors rejoinSession.ts: it survives a refresh but is scoped to the
 * tab and cleared when the tab closes.
 */

type PendingSession = { roomName: string; name: string } | null;

interface DashboardHandoffSession {
  pendingSession: PendingSession;
}

const STORAGE_KEY = 'twilio-video-dashboard-handoff';

export function saveDashboardHandoff(pendingSession: PendingSession): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ pendingSession }));
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). This is a refresh
    // convenience, so a failure here should never break the dashboard-to-prejoin handoff.
  }
}

export function readDashboardHandoff(): DashboardHandoffSession | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const pendingSession = parsed.pendingSession;
    if (pendingSession === null) return { pendingSession: null };
    if (pendingSession && typeof pendingSession.roomName === 'string' && typeof pendingSession.name === 'string') {
      return { pendingSession: { roomName: pendingSession.roomName, name: pendingSession.name } };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearDashboardHandoff(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // See saveDashboardHandoff — never throw from storage access.
  }
}
