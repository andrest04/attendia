import { Room, RemoteParticipant } from 'twilio-video';
import { useEffect } from 'react';
import useLatest from '../useLatest/useLatest';

export interface RosterCallbacks {
  /** The room (or its roster) is now this list — fired on mount and whenever the room changes. */
  onReset(participants: RemoteParticipant[]): void;
  onConnected(participant: RemoteParticipant): void;
  onDisconnected(participant: RemoteParticipant): void;
}

/**
 * Observer over a room's roster. Three hooks (the plain list, the speaker-view order and the
 * gallery-view order) each subscribed to participantConnected/participantDisconnected by hand,
 * with the same reset-on-room-change; they differ only in what they DO with the three events,
 * which is what the callbacks express. Callbacks may be inline — they are read through a ref.
 */
export default function useRosterEvents(room: Room | null | undefined, callbacks: RosterCallbacks) {
  const latest = useLatest(callbacks);

  useEffect(() => {
    if (!room) return;

    latest.current.onReset(Array.from(room.participants.values()));

    const handleConnected = (participant: RemoteParticipant) => latest.current.onConnected(participant);
    const handleDisconnected = (participant: RemoteParticipant) => latest.current.onDisconnected(participant);
    room.on('participantConnected', handleConnected);
    room.on('participantDisconnected', handleDisconnected);
    return () => {
      room.off('participantConnected', handleConnected);
      room.off('participantDisconnected', handleDisconnected);
    };
  }, [room, latest]);
}
