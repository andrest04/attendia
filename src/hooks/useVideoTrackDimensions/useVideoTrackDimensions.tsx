import { LocalVideoTrack, RemoteVideoTrack } from 'twilio-video';
import useEmitterState from '../useEmitterState/useEmitterState';

type TrackType = LocalVideoTrack | RemoteVideoTrack;

export default function useVideoTrackDimensions(track?: TrackType) {
  return useEmitterState(track, currentTrack => currentTrack?.dimensions, {
    dimensionsChanged: (_track, newTrack: TrackType) => ({
      width: newTrack.dimensions.width,
      height: newTrack.dimensions.height,
    }),
  });
}
