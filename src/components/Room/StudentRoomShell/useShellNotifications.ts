import { useEffect, useRef, useState } from 'react';
import { Participant } from 'twilio-video';
import { isTeacherIdentity } from '../../../classSession/classSessionTypes';
import { t } from '../../../i18n/translate';
import { ShellNotification } from '../shellNotification';

/** The student panel is a lightweight activity log, not a firehose — keep only the most recent few. */
const MAX_PANEL_NOTIFICATIONS = 3;

/**
 * Builds the student left-rail "Notificaciones" feed: a short log of CLASSMATES
 * joining/leaving the session. The professor's presence and the local student's
 * own raise-hand are intentionally NOT logged here — those are surfaced as
 * transient toasts instead (see useNotificationToasts). The list is capped to the
 * last few entries so it never fills up with noise.
 */
export default function useShellNotifications(participants: Participant[]) {
  const [notifications, setNotifications] = useState<ShellNotification[]>([]);
  const prevParticipantIds = useRef<string[]>(participants.map(p => p.sid));
  const prevParticipantIdentityMap = useRef<Record<string, string>>(
    participants.reduce((acc, participant) => ({ ...acc, [participant.sid]: participant.identity }), {})
  );

  useEffect(() => {
    const currentIds = participants.map(p => p.sid);
    const previousIds = prevParticipantIds.current;

    // Only classmates (non-teacher remote participants) belong in the panel log.
    const joined = participants.filter(p => !previousIds.includes(p.sid) && !isTeacherIdentity(p.identity));

    if (joined.length) {
      setNotifications(prev =>
        [
          ...prev,
          ...joined.map(p => ({
            id: `joined-${p.sid}-${Date.now()}`,
            text: t('{{name}} se unió a la sesión', { name: p.identity }),
            kind: 'participant' as const,
            createdAt: Date.now(),
          })),
        ].slice(-MAX_PANEL_NOTIFICATIONS)
      );
    }

    const left = previousIds
      .filter(id => !currentIds.includes(id))
      .map(leftId => prevParticipantIdentityMap.current[leftId])
      .filter(identity => identity && !isTeacherIdentity(identity));

    if (left.length) {
      setNotifications(prev =>
        [
          ...prev,
          ...left.map(identity => ({
            id: `left-${identity}-${Date.now()}`,
            text: t('{{name}} salió de la sesión', { name: identity }),
            kind: 'participant' as const,
            createdAt: Date.now(),
          })),
        ].slice(-MAX_PANEL_NOTIFICATIONS)
      );
    }

    prevParticipantIds.current = currentIds;
    prevParticipantIdentityMap.current = participants.reduce(
      (acc, participant) => ({ ...acc, [participant.sid]: participant.identity }),
      {} as Record<string, string>
    );
  }, [participants]);

  return notifications;
}
