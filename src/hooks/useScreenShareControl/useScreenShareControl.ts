import useScreenShareParticipant from '../useScreenShareParticipant/useScreenShareParticipant';
import { isTeacherIdentity } from '../../classSession/classSessionTypes';
import { useScreenShareGrant } from './screenShareGrantContext';
import useVideoContext from '../useVideoContext/useVideoContext';

/**
 * The state behind every "Compartir pantalla" control (the toolbar button and the "more
 * options" menu items of both room shells). Three places used to re-derive the same gating
 * by hand; they now read it from here.
 *
 * Only SOMEONE ELSE's share blocks the control — our own share must never disable the stop
 * button. A browser without getDisplayMedia cannot share at all.
 *
 * Students also need the professor's grant (`grant-screenshare`, published by Room through
 * screenShareGrantContext). Teachers are never gated; no grant source (null) means not gated.
 * A student that is already sharing keeps the stop button — a revoke stops the share elsewhere.
 */
export default function useScreenShareControl() {
  const { toggleScreenShare, isSharingScreen, room } = useVideoContext();
  const grant = useScreenShareGrant();
  const screenShareParticipant = useScreenShareParticipant();

  const isSupported = Boolean(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  const blockedByOtherShare = Boolean(screenShareParticipant) && !isSharingScreen;
  const isTeacher = isTeacherIdentity(room?.localParticipant?.identity);
  const lockedByTeacher = !isTeacher && grant === false && !isSharingScreen;

  return {
    toggleScreenShare,
    isSharingScreen,
    isSupported,
    blockedByOtherShare,
    /** A student without the professor's grant: shown disabled with "ask the teacher" copy. */
    lockedByTeacher,
    /** True when the control should be disabled: unsupported, another participant is sharing, or no grant. */
    disabled: blockedByOtherShare || lockedByTeacher || !isSupported,
  };
}
