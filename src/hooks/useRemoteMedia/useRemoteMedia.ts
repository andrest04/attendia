import { Participant, LocalTrackPublication, RemoteTrackPublication } from 'twilio-video';
import useEmitterState from '../useEmitterState/useEmitterState';
import useParticipants from '../useParticipants/useParticipants';
import { isScreenShareName } from '../../utils/trackSelectors';

/** What a participant is sending right now, as the rest of the room sees it. */
export interface RemoteMedia {
  micOn: boolean;
  cameraOn: boolean;
}

function readMedia(participant: Participant | undefined): RemoteMedia | undefined {
  if (!participant) return undefined;
  const publications = Array.from(participant.tracks.values()).filter(p => !isScreenShareName(p.trackName));
  const audio = publications.find(p => p.kind === 'audio') as
    | LocalTrackPublication
    | RemoteTrackPublication
    | undefined;
  return {
    micOn: Boolean(audio?.isTrackEnabled),
    // Turning the camera off unpublishes the track, so a published video means it is on.
    cameraOn: publications.some(p => p.kind === 'video'),
  };
}

const reread = (participant: Participant) => readMedia(participant);

/**
 * Whether the remote participant `identity` has their microphone and camera on, or `undefined`
 * when they are not in the room (callers then cannot tell and offer every action).
 */
export default function useRemoteMedia(identity: string): RemoteMedia | undefined {
  const participant = useParticipants().find(p => p.identity === identity);
  return useEmitterState(participant, readMedia, {
    trackEnabled: reread,
    trackDisabled: reread,
    trackPublished: reread,
    trackUnpublished: reread,
  });
}
