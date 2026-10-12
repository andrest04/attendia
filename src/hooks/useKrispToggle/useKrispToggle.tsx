import { LocalAudioTrack } from 'twilio-video';
import { useCallback } from 'react';
import { useAppState } from '../../state';
import useVideoContext from '../useVideoContext/useVideoContext';
import { selectAudioTrack } from '../../utils/trackSelectors';

export function useKrispToggle() {
  const { localTracks } = useVideoContext();
  const audioTrack = selectAudioTrack(localTracks) as LocalAudioTrack;
  const noiseCancellation = audioTrack && audioTrack.noiseCancellation;
  const vendor = noiseCancellation && noiseCancellation.vendor;
  const { setIsKrispEnabled } = useAppState();

  const toggleKrisp = useCallback(() => {
    if (noiseCancellation) {
      noiseCancellation[noiseCancellation.isEnabled ? 'disable' : 'enable']().then(() => {
        setIsKrispEnabled(noiseCancellation.isEnabled);
      });
    }
  }, [noiseCancellation, setIsKrispEnabled]);

  return { vendor, toggleKrisp };
}
