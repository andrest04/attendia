import { useContext, useEffect, useState } from 'react';
import useVideoContext from '../useVideoContext/useVideoContext';
import { RemoteParticipant, Room } from 'twilio-video';
import { RoomStateContext } from '../../components/ParticipantProvider/roomStateContext';

/** The subscription itself, parameterized by room so the shared provider can own it. */
export function useRoomDominantSpeaker(room: Room | null | undefined, includeNull = false) {
  const [dominantSpeaker, setDominantSpeaker] = useState<RemoteParticipant | null>(room?.dominantSpeaker ?? null);

  useEffect(() => {
    if (room) {
      // Sometimes, the 'dominantSpeakerChanged' event can emit 'null', which means that
      // there is no dominant speaker. If we change the main participant when 'null' is
      // emitted, the effect can be jarring to the user. Here we ignore any 'null' values
      // and continue to display the previous dominant speaker as the main participant.
      const handleDominantSpeakerChanged = (newDominantSpeaker: RemoteParticipant) => {
        if (includeNull || newDominantSpeaker !== null) {
          setDominantSpeaker(newDominantSpeaker);
        }
      };

      // Since 'null' values are ignored, we will need to listen for the 'participantDisconnected'
      // event, so we can set the dominantSpeaker to 'null' when they disconnect.
      const handleParticipantDisconnected = (participant: RemoteParticipant) => {
        setDominantSpeaker(prevDominantSpeaker => {
          return prevDominantSpeaker === participant ? null : prevDominantSpeaker;
        });
      };

      room.on('dominantSpeakerChanged', handleDominantSpeakerChanged);
      room.on('participantDisconnected', handleParticipantDisconnected);
      return () => {
        room.off('dominantSpeakerChanged', handleDominantSpeakerChanged);
        room.off('participantDisconnected', handleParticipantDisconnected);
      };
    }
  }, [room, includeNull]);

  return dominantSpeaker;
}

export default function useDominantSpeaker(includeNull = false) {
  const { room } = useVideoContext();
  const shared = useContext(RoomStateContext);

  // The shared value follows the default semantics (null emissions are ignored). A caller
  // that asks to see nulls needs its own subscription. With a shared value in place the
  // local subscription is switched off by handing it no room.
  const useSharedValue = shared !== null && !includeNull;
  const own = useRoomDominantSpeaker(useSharedValue ? undefined : room, includeNull);

  return useSharedValue ? shared!.dominantSpeaker : own;
}
