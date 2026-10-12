import { LocalAudioTrack } from 'twilio-video';
import { useCallback } from 'react';
import useIsTrackEnabled from '../useIsTrackEnabled/useIsTrackEnabled';
import useVideoContext from '../useVideoContext/useVideoContext';
import { selectAudioTrack } from '../../utils/trackSelectors';

export default function useLocalAudioToggle() {
  const { localTracks } = useVideoContext();
  const audioTrack = selectAudioTrack(localTracks) as LocalAudioTrack;
  const isEnabled = useIsTrackEnabled(audioTrack);

  const toggleAudioEnabled = useCallback(() => {
    if (audioTrack) {
      audioTrack.isEnabled ? audioTrack.disable() : audioTrack.enable();
    }
  }, [audioTrack]);

  return [isEnabled, toggleAudioEnabled] as const;
}
