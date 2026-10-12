import { LocalTrackPublication, RemoteTrackPublication } from 'twilio-video';
import useEmitterState from '../useEmitterState/useEmitterState';

type PublicationType = LocalTrackPublication | RemoteTrackPublication;

export default function usePublicationIsTrackEnabled(publication?: PublicationType) {
  return useEmitterState(publication, current => (current ? current.isTrackEnabled : false), {
    trackEnabled: () => true,
    trackDisabled: () => false,
  });
}
