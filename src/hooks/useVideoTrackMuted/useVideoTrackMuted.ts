import { useEffect, useState } from 'react';
import { LocalVideoTrack } from 'twilio-video';
import useMediaStreamTrack from '../useMediaStreamTrack/useMediaStreamTrack';

/**
 * Reports whether a local video track is muted at the source level — i.e. the
 * camera is not delivering frames even though the Twilio track object still
 * exists. The browser sets `MediaStreamTrack.muted` and fires `mute`/`unmute`
 * when the OS blocks the camera, another app grabs it, or a hardware privacy
 * switch engages.
 *
 * This is distinct from Twilio's in-app on/off toggle, which removes the track
 * from `localTracks` entirely (no track at all). Here the track is present but
 * produces no usable frame, so consumers like the pre-join lighting check must
 * not read luminance from it — a blocked camera renders a flat gray frame whose
 * average luminance can falsely clear the "adequate" threshold.
 */
export default function useVideoTrackMuted(track?: LocalVideoTrack): boolean {
  const mediaStreamTrack = useMediaStreamTrack(track);
  const [isMuted, setIsMuted] = useState(Boolean(mediaStreamTrack?.muted));

  useEffect(() => {
    // Re-sync on track replacement (e.g. camera flip / restart) since the new
    // mediaStreamTrack may already be muted without firing an event for us.
    setIsMuted(Boolean(mediaStreamTrack?.muted));

    if (!mediaStreamTrack) {
      return;
    }

    const handleMuted = () => setIsMuted(true);
    const handleUnmuted = () => setIsMuted(false);
    mediaStreamTrack.addEventListener('mute', handleMuted);
    mediaStreamTrack.addEventListener('unmute', handleUnmuted);
    return () => {
      mediaStreamTrack.removeEventListener('mute', handleMuted);
      mediaStreamTrack.removeEventListener('unmute', handleUnmuted);
    };
  }, [mediaStreamTrack]);

  return isMuted;
}
