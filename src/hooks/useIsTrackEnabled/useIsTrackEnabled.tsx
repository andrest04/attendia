import { LocalAudioTrack, LocalVideoTrack, RemoteAudioTrack, RemoteVideoTrack } from 'twilio-video';
import useEmitterState from '../useEmitterState/useEmitterState';

type TrackType = LocalAudioTrack | LocalVideoTrack | RemoteAudioTrack | RemoteVideoTrack | undefined;

export default function useIsTrackEnabled(track: TrackType) {
  return useEmitterState(track, currentTrack => (currentTrack ? currentTrack.isEnabled : false), {
    enabled: () => true,
    disabled: () => false,
  });
}
