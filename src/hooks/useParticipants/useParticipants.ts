import { useContext, useState } from 'react';
import { RemoteParticipant, Room } from 'twilio-video';
import useVideoContext from '../useVideoContext/useVideoContext';
import useRosterEvents from '../useRosterEvents/useRosterEvents';
import { RoomStateContext } from '../../components/ParticipantProvider/roomStateContext';

/**
 * This hook returns an array of the video room's participants. Unlike the hooks
 * "useSpeakerViewParticipants" and "useGalleryViewParticipants", this hook does not reorder
 * the list of participants whenever the dominantSpeaker changes. This will prevent unnecessary
 * re-renders because components that use this hook will only update when a participant connects
 * to or disconnects from the room.
 */

/** The roster state machine, parameterized by room so the shared provider can reuse it. */
export function useRoomParticipants(room: Room | null | undefined): RemoteParticipant[] {
  const [participants, setParticipants] = useState<RemoteParticipant[]>(() =>
    Array.from(room?.participants.values() ?? [])
  );

  useRosterEvents(room, {
    onReset: setParticipants,
    onConnected: participant => setParticipants(prevParticipants => [...prevParticipants, participant]),
    onDisconnected: participant => setParticipants(prevParticipants => prevParticipants.filter(p => p !== participant)),
  });

  return participants;
}

export default function useParticipants() {
  const { room } = useVideoContext();
  const shared = useContext(RoomStateContext);

  // With a shared roster in place the local subscription is switched off by handing it no room.
  const own = useRoomParticipants(shared ? undefined : room);

  return shared ? shared.participants : own;
}
