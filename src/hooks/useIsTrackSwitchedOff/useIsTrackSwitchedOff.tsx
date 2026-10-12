import { LocalVideoTrack, RemoteVideoTrack } from 'twilio-video';
import useEmitterState from '../useEmitterState/useEmitterState';

type TrackType = RemoteVideoTrack | LocalVideoTrack | undefined | null;

// The 'switchedOff' event is emitted when there is not enough bandwidth to support
// a track. See: https://www.twilio.com/docs/video/tutorials/using-bandwidth-profile-api#understanding-track-switch-offs

export default function useIsTrackSwitchedOff(track: TrackType) {
  return useEmitterState(track, currentTrack => !!(currentTrack && currentTrack.isSwitchedOff), {
    switchedOff: () => true,
    switchedOn: () => false,
  });
}
