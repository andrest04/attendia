import React from 'react';
import { RemoteAudioTrack, RemoteParticipant } from 'twilio-video';
import useParticipants from '../../hooks/useParticipants/useParticipants';
import useTracks from '../../hooks/useTracks/useTracks';
import AudioTrack from '../AudioTrack/AudioTrack';

function Participant({ participant }: { participant: RemoteParticipant }) {
  const tracks = useTracks(participant);
  // Every audio track plays: the microphone and, while sharing, the audio of the shared screen.
  const audioTracks = tracks.filter(track => track.kind === 'audio') as RemoteAudioTrack[];

  return (
    <>
      {audioTracks.map(audioTrack => (
        <AudioTrack key={audioTrack.sid ?? audioTrack.name} track={audioTrack} />
      ))}
    </>
  );
}

/*
  This ParticipantAudioTracks component will render the audio track for all participants in the room.
  It is in a separate component so that the audio tracks will always be rendered, and that they will never be 
  unnecessarily unmounted/mounted as the user switches between Gallery View and Speaker View.
*/
export function ParticipantAudioTracks() {
  const participants = useParticipants();

  return (
    <>
      {participants.map(participant => (
        <Participant key={participant.sid} participant={participant} />
      ))}
    </>
  );
}
