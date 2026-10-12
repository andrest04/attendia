import { useEffect, useState } from 'react';
import { RemoteParticipant } from 'twilio-video';
import useDominantSpeaker from '../useDominantSpeaker/useDominantSpeaker';
import useRosterEvents from '../useRosterEvents/useRosterEvents';
import useVideoContext from '../useVideoContext/useVideoContext';

export default function useSpeakerViewParticipants() {
  const { room } = useVideoContext();
  const dominantSpeaker = useDominantSpeaker();
  const [participants, setParticipants] = useState<RemoteParticipant[]>(Array.from(room?.participants.values() ?? []));

  // When the dominant speaker changes, they are moved to the front of the participants array.
  // This means that the most recent dominant speakers will always be near the top of the
  // ParticipantStrip component.
  useEffect(() => {
    if (dominantSpeaker) {
      setParticipants(prevParticipants => [
        dominantSpeaker,
        ...prevParticipants.filter(participant => participant !== dominantSpeaker),
      ]);
    }
  }, [dominantSpeaker]);

  useRosterEvents(room, {
    onReset: setParticipants,
    onConnected: participant => setParticipants(prevParticipants => [...prevParticipants, participant]),
    onDisconnected: participant => setParticipants(prevParticipants => prevParticipants.filter(p => p !== participant)),
  });

  return participants;
}
