import { LocalAudioTrack, LocalVideoTrack, Participant, RemoteAudioTrack, RemoteVideoTrack } from 'twilio-video';
import useIsTrackSwitchedOff from '../useIsTrackSwitchedOff/useIsTrackSwitchedOff';
import useParticipantIsReconnecting from '../useParticipantIsReconnecting/useParticipantIsReconnecting';
import usePublications from '../usePublications/usePublications';
import useTrack from '../useTrack/useTrack';
import { useRaisedHand } from '../useRaiseHand/raisedHandsContext';
import { isScreenShareName } from '../../utils/trackSelectors';

interface ParticipantTileOptions {
  /**
   * Show the participant's screen share in place of their camera when they have both. The main
   * stage wants that; the small gallery/strip tiles always show the camera.
   */
  preferScreenShare?: boolean;
}

/**
 * Facade over the SDK state every participant tile needs: which tracks the participant
 * publishes, whether the video that is shown is switched off, reconnecting, and whether their
 * hand is raised. The gallery tile and the main stage tile both opened with the same eight hooks.
 *
 * Safe to call from any number of tiles (it only subscribes, it owns no singleton).
 */
export default function useParticipantTile(
  participant: Participant,
  { preferScreenShare }: ParticipantTileOptions = {}
) {
  const publications = usePublications(participant);
  const videoPublication = publications.find(p => !isScreenShareName(p.trackName) && p.kind === 'video');
  const screenSharePublication = publications.find(p => isScreenShareName(p.trackName) && p.kind === 'video');
  // The microphone, not the audio of a shared screen.
  const audioPublication = publications.find(p => !isScreenShareName(p.trackName) && p.kind === 'audio');

  const videoTrack = useTrack(preferScreenShare ? screenSharePublication || videoPublication : videoPublication);
  const audioTrack = useTrack(audioPublication) as LocalAudioTrack | RemoteAudioTrack | undefined;
  const isVideoSwitchedOff = useIsTrackSwitchedOff(videoTrack as LocalVideoTrack | RemoteVideoTrack);
  const isReconnecting = useParticipantIsReconnecting(participant);
  const isHandRaised = useRaisedHand(participant.identity);

  return {
    /** The track shown in the tile (camera, or the screen share when `preferScreenShare`). */
    videoTrack,
    audioTrack,
    /** The participant publishes a camera video, whether or not it is subscribed yet. */
    hasVideoPublication: Boolean(videoPublication),
    isSharingScreen: Boolean(screenSharePublication),
    isVideoSwitchedOff,
    isReconnecting,
    isHandRaised,
  };
}
