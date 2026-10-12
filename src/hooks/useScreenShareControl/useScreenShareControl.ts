import useScreenShareParticipant from '../useScreenShareParticipant/useScreenShareParticipant';
import useVideoContext from '../useVideoContext/useVideoContext';

/**
 * The state behind every "Compartir pantalla" control (the toolbar button and the "more
 * options" menu items of both room shells). Three places used to re-derive the same gating
 * by hand; they now read it from here.
 *
 * Only SOMEONE ELSE's share blocks the control — our own share must never disable the stop
 * button. A browser without getDisplayMedia cannot share at all.
 */
export default function useScreenShareControl() {
  const { toggleScreenShare, isSharingScreen } = useVideoContext();
  const screenShareParticipant = useScreenShareParticipant();

  const isSupported = Boolean(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  const blockedByOtherShare = Boolean(screenShareParticipant) && !isSharingScreen;

  return {
    toggleScreenShare,
    isSharingScreen,
    isSupported,
    blockedByOtherShare,
    /** True when the control should be disabled: unsupported, or another participant is sharing. */
    disabled: blockedByOtherShare || !isSupported,
  };
}
