import { AudioTrack, VideoTrack } from 'twilio-video';
import useEmitterState from '../useEmitterState/useEmitterState';

/*
 * This hook allows components to reliably use the 'mediaStreamTrack' property of
 * an AudioTrack or a VideoTrack. Whenever 'localTrack.restart(...)' is called, it
 * will replace the mediaStreamTrack property of the localTrack, but the localTrack
 * object will stay the same. Therefore this hook is needed in order for components
 * to rerender in response to the mediaStreamTrack changing.
 */
export default function useMediaStreamTrack(track?: AudioTrack | VideoTrack) {
  return useEmitterState(track, currentTrack => currentTrack?.mediaStreamTrack, {
    started: currentTrack => currentTrack.mediaStreamTrack,
  });
}
