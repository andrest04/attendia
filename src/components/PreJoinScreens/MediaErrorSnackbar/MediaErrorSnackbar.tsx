import React, { useState } from 'react';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import spanishTranslator from '../../../i18n/spanishTranslator';
import Snackbar from '../../Snackbar/Snackbar';
import useDevices from '../../../hooks/useDevices/useDevices';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';

export function getSnackbarContent(
  hasAudio: boolean,
  hasVideo: boolean,
  error?: Error,
  t: TFunction = spanishTranslator
) {
  let headline = '';
  let message = '';

  switch (true) {
    // These custom errors are thrown by the useLocalTracks hook. They are thrown when the user explicitly denies
    // permission to only their camera, or only their microphone.
    case error?.message === 'CameraPermissionsDenied':
      headline = t('prejoin:mediaError.noAccess.headline');
      message = t('prejoin:mediaError.cameraDenied');
      break;
    case error?.message === 'MicrophonePermissionsDenied':
      headline = t('prejoin:mediaError.noAccess.headline');
      message = t('prejoin:mediaError.microphoneDenied');
      break;

    // This error is emitted when the user or the user's system has denied permission to use the media devices
    case error?.name === 'NotAllowedError':
      headline = t('prejoin:mediaError.noAccess.headline');

      if (error!.message === 'Permission denied by system') {
        // Chrome only
        message = t('prejoin:mediaError.systemBlocked');
      } else {
        message = t('prejoin:mediaError.bothDenied');
      }

      break;

    // This error is emitted when input devices are not connected or disabled in the OS settings
    case error?.name === 'NotFoundError':
      headline = t('prejoin:mediaError.notFound.headline');
      message = t('prejoin:mediaError.notFound.message');
      break;

    // This error is emitted when the camera/microphone exists and permission was granted, but the
    // hardware cannot be started — typically because another application is already using it, or
    // because of a driver/hardware failure. 'TrackStartError' is the legacy Chrome alias.
    case error?.name === 'NotReadableError':
    case error?.name === 'TrackStartError':
      headline = t('prejoin:mediaError.inUse.headline');
      message = t('prejoin:mediaError.inUse.message');
      break;

    // This error is emitted when the requested device (e.g. the previously selected camera) can no
    // longer satisfy the constraints — usually because it was unplugged or is no longer available.
    // 'ConstraintNotSatisfiedError' is the legacy alias.
    case error?.name === 'OverconstrainedError':
    case error?.name === 'ConstraintNotSatisfiedError':
      headline = t('prejoin:mediaError.overconstrained.headline');
      message = t('prejoin:mediaError.overconstrained.message');
      break;

    // Other getUserMedia errors are less likely to happen in this app. Here we show a generic
    // Spanish message instead of the raw SDK error, and keep the technical detail in the console
    // (logged by the PreJoinScreens catch) for support/debugging.
    case Boolean(error):
      headline = t('prejoin:mediaError.generic.headline');
      message = t('prejoin:mediaError.generic.message');
      break;

    case !hasAudio && !hasVideo:
      headline = t('prejoin:mediaError.noDevices.headline');
      message = t('prejoin:mediaError.noDevices.message');
      break;

    case !hasVideo:
      headline = t('prejoin:mediaError.noCamera.headline');
      message = t('prejoin:mediaError.noCamera.message');
      break;

    case !hasAudio:
      headline = t('prejoin:mediaError.noMicrophone.headline');
      message = t('prejoin:mediaError.noMicrophone.message');
  }

  return {
    headline,
    message,
  };
}

export default function MediaErrorSnackbar({ error }: { error?: Error }) {
  const { t } = useTranslation('prejoin');
  const { hasAudioInputDevices, hasVideoInputDevices } = useDevices();

  const { isAcquiringLocalTracks } = useVideoContext();

  const [isSnackbarDismissed, setIsSnackbarDismissed] = useState(false);

  const isSnackbarOpen =
    !isSnackbarDismissed &&
    !isAcquiringLocalTracks &&
    (Boolean(error) || !hasAudioInputDevices || !hasVideoInputDevices);

  const { headline, message } = getSnackbarContent(hasAudioInputDevices, hasVideoInputDevices, error, t);

  return (
    <Snackbar
      open={isSnackbarOpen}
      handleClose={() => setIsSnackbarDismissed(true)}
      headline={headline}
      message={message}
      variant="warning"
    />
  );
}
