import React, { useState } from 'react';
import Snackbar from '../../Snackbar/Snackbar';
import useDevices from '../../../hooks/useDevices/useDevices';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';

export function getSnackbarContent(hasAudio: boolean, hasVideo: boolean, error?: Error) {
  let headline = '';
  let message = '';

  switch (true) {
    // These custom errors are thrown by the useLocalTracks hook. They are thrown when the user explicitly denies
    // permission to only their camera, or only their microphone.
    case error?.message === 'CameraPermissionsDenied':
      headline = 'No se puede acceder a los medios:';
      message =
        'El usuario denegó el permiso para usar el video. Por favor, concede acceso a la cámara en el navegador.';
      break;
    case error?.message === 'MicrophonePermissionsDenied':
      headline = 'No se puede acceder a los medios:';
      message =
        'El usuario denegó el permiso para usar el audio. Por favor, concede acceso al micrófono en el navegador.';
      break;

    // This error is emitted when the user or the user's system has denied permission to use the media devices
    case error?.name === 'NotAllowedError':
      headline = 'No se puede acceder a los medios:';

      if (error!.message === 'Permission denied by system') {
        // Chrome only
        message =
          'El sistema operativo bloqueó el acceso del navegador al micrófono o la cámara. Verifica la configuración de privacidad del sistema.';
      } else {
        message =
          'El usuario denegó el permiso para usar el audio y el video. Por favor, concede acceso al micrófono y la cámara en el navegador.';
      }

      break;

    // This error is emitted when input devices are not connected or disabled in the OS settings
    case error?.name === 'NotFoundError':
      headline = 'No se encontró micrófono ni cámara:';
      message =
        'El navegador no puede acceder al micrófono o la cámara. Asegúrate de que los dispositivos estén conectados y habilitados.';
      break;

    // Other getUserMedia errors are less likely to happen in this app. Here we will display
    // the system's error message directly to the user.
    case Boolean(error):
      headline = 'Error al acceder a los medios:';
      message = `${error!.name} ${error!.message}`;
      break;

    case !hasAudio && !hasVideo:
      headline = 'No se detectó cámara ni micrófono:';
      message = 'Los demás participantes no podrán verte ni escucharte.';
      break;

    case !hasVideo:
      headline = 'No se detectó cámara:';
      message = 'Los demás participantes no podrán verte.';
      break;

    case !hasAudio:
      headline = 'No se detectó micrófono:';
      message = 'Los demás participantes no podrán escucharte.';
  }

  return {
    headline,
    message,
  };
}

export default function MediaErrorSnackbar({ error }: { error?: Error }) {
  const { hasAudioInputDevices, hasVideoInputDevices } = useDevices();

  const { isAcquiringLocalTracks } = useVideoContext();

  const [isSnackbarDismissed, setIsSnackbarDismissed] = useState(false);

  const isSnackbarOpen =
    !isSnackbarDismissed &&
    !isAcquiringLocalTracks &&
    (Boolean(error) || !hasAudioInputDevices || !hasVideoInputDevices);

  const { headline, message } = getSnackbarContent(hasAudioInputDevices, hasVideoInputDevices, error);

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
