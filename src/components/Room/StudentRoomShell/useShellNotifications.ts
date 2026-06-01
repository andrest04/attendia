import { useEffect, useMemo, useRef, useState } from 'react';
import { Participant } from 'twilio-video';

export type ShellNotification = {
  id: string;
  text: string;
  kind: 'participant' | 'local-hand';
  createdAt: number;
};

export default function useShellNotifications(participants: Participant[], handRaised: boolean) {
  const [notifications, setNotifications] = useState<ShellNotification[]>([]);
  const prevParticipantIds = useRef<string[]>(participants.map(p => p.sid));
  const prevParticipantIdentityMap = useRef<Record<string, string>>(
    participants.reduce((acc, participant) => ({ ...acc, [participant.sid]: participant.identity }), {})
  );
  const prevHandRaised = useRef(handRaised);

  useEffect(() => {
    const currentIds = participants.map(p => p.sid);
    const previousIds = prevParticipantIds.current;
    const joined = participants.filter(p => !previousIds.includes(p.sid));

    if (joined.length) {
      setNotifications(prev => [
        ...prev,
        ...joined.map(p => ({
          id: `joined-${p.sid}-${Date.now()}`,
          text: `${p.identity} se unió a la sesión`,
          kind: 'participant' as const,
          createdAt: Date.now(),
        })),
      ]);
    }

    const left = previousIds
      .filter(id => !currentIds.includes(id))
      .map(leftId => prevParticipantIdentityMap.current[leftId]);

    if (left.length) {
      setNotifications(prev => [
        ...prev,
        ...left.map(identity => ({
          id: `left-${identity}-${Date.now()}`,
          text: `${identity} salió de la sesión`,
          kind: 'participant' as const,
          createdAt: Date.now(),
        })),
      ]);
    }

    prevParticipantIds.current = currentIds;
    prevParticipantIdentityMap.current = participants.reduce(
      (acc, participant) => ({ ...acc, [participant.sid]: participant.identity }),
      {} as Record<string, string>
    );
  }, [participants]);

  useEffect(() => {
    if (prevHandRaised.current !== handRaised) {
      setNotifications(prev => [
        ...prev,
        {
          id: `hand-${Date.now()}`,
          text: handRaised ? 'Levantaste la mano' : 'Bajaste la mano',
          kind: 'local-hand',
          createdAt: Date.now(),
        },
      ]);
      prevHandRaised.current = handRaised;
    }
  }, [handRaised]);

  return useMemo(() => notifications, [notifications]);
}
