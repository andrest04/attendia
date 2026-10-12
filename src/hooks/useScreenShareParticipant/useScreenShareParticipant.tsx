import { useContext, useEffect, useState } from 'react';
import useVideoContext from '../useVideoContext/useVideoContext';

import { Participant, Room, TrackPublication } from 'twilio-video';
import { RoomStateContext } from '../../components/ParticipantProvider/roomStateContext';
import { isScreenShareName } from '../../utils/trackSelectors';

/*
  Returns the participant that is sharing their screen (if any). This hook assumes that only one participant
  can share their screen at a time.
*/
/** The subscription itself, parameterized by room so the shared provider can own it. */
export function useRoomScreenShareParticipant(room: Room | null | undefined) {
  const [screenShareParticipant, setScreenShareParticipant] = useState<Participant>();

  useEffect(() => {
    if (room) {
      const updateScreenShareParticipant = () => {
        setScreenShareParticipant(
          Array.from<Participant>(room.participants.values())
            // the screenshare participant could be the localParticipant
            .concat(room.localParticipant)
            .find((participant: Participant) =>
              Array.from<TrackPublication>(participant.tracks.values()).find(track =>
                isScreenShareName(track.trackName)
              )
            )
        );
      };
      updateScreenShareParticipant();

      room.on('trackPublished', updateScreenShareParticipant);
      room.on('trackUnpublished', updateScreenShareParticipant);
      room.on('participantDisconnected', updateScreenShareParticipant);

      // the room object does not emit 'trackPublished' events for the localParticipant,
      // so we need to listen for them here.
      room.localParticipant.on('trackPublished', updateScreenShareParticipant);
      room.localParticipant.on('trackUnpublished', updateScreenShareParticipant);
      return () => {
        room.off('trackPublished', updateScreenShareParticipant);
        room.off('trackUnpublished', updateScreenShareParticipant);
        room.off('participantDisconnected', updateScreenShareParticipant);

        room.localParticipant.off('trackPublished', updateScreenShareParticipant);
        room.localParticipant.off('trackUnpublished', updateScreenShareParticipant);
      };
    }
  }, [room]);

  return screenShareParticipant;
}

export default function useScreenShareParticipant() {
  const { room } = useVideoContext();
  const shared = useContext(RoomStateContext);

  // With a shared value in place the local subscription is switched off by handing it no room.
  const own = useRoomScreenShareParticipant(shared ? undefined : room);

  return shared ? shared.screenShareParticipant : own;
}
