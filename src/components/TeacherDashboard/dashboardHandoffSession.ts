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

import { createStorageSlot } from '../../utils/createStorageSlot';

type PendingSession = { roomName: string; name: string; classId?: string } | null;

interface DashboardHandoffSession {
  pendingSession: PendingSession;
}

const slot = createStorageSlot<DashboardHandoffSession>({
  key: 'twilio-video-dashboard-handoff',
  parse: stored => {
    if (!stored || typeof stored !== 'object') return null;

    const pendingSession = (stored as { pendingSession?: any }).pendingSession;
    if (pendingSession === null) return { pendingSession: null };
    if (pendingSession && typeof pendingSession.roomName === 'string' && typeof pendingSession.name === 'string') {
      return {
        pendingSession: {
          roomName: pendingSession.roomName,
          name: pendingSession.name,
          classId: typeof pendingSession.classId === 'string' ? pendingSession.classId : undefined,
        },
      };
    }
    return null;
  },
});

// A refresh convenience: a storage failure never breaks the dashboard-to-prejoin handoff.
export const saveDashboardHandoff = (pendingSession: PendingSession): void => slot.write({ pendingSession });

export const readDashboardHandoff = (): DashboardHandoffSession | null => slot.read();

export const clearDashboardHandoff = (): void => slot.clear();
