import { LocalTrackPublication, RemoteTrackPublication } from 'twilio-video';
import useEmitterState from '../useEmitterState/useEmitterState';

export default function useTrack(publication: LocalTrackPublication | RemoteTrackPublication | undefined) {
  // The track follows the publication: reset when it changes, set on 'subscribed', clear
  // on 'unsubscribed'.
  return useEmitterState(publication, current => current && current.track, {
    subscribed: (_publication, track) => track,
    unsubscribed: () => null,
  });
}
