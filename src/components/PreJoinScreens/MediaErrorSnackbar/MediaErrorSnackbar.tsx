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

    // This error is emitted when the camera/microphone exists and permission was granted, but the
    // hardware cannot be started — typically because another application is already using it, or
    // because of a driver/hardware failure. 'TrackStartError' is the legacy Chrome alias.
    case error?.name === 'NotReadableError':
    case error?.name === 'TrackStartError':
      headline = 'No se puede usar la cámara o el micrófono:';
      message =
        'Otra aplicación (por ejemplo Zoom, Teams o Meet) podría estar usando tu cámara o micrófono. Ciérrala o cierra las otras pestañas que los usen y vuelve a intentarlo.';
      break;

    // This error is emitted when the requested device (e.g. the previously selected camera) can no
    // longer satisfy the constraints — usually because it was unplugged or is no longer available.
    // 'ConstraintNotSatisfiedError' is the legacy alias.
    case error?.name === 'OverconstrainedError':
    case error?.name === 'ConstraintNotSatisfiedError':
      headline = 'No se puede usar la cámara seleccionada:';
      message =
        'La cámara seleccionada ya no está disponible. Selecciona otra cámara en la lista o reconecta el dispositivo e inténtalo de nuevo.';
      break;

    // Other getUserMedia errors are less likely to happen in this app. Here we show a generic
    // Spanish message instead of the raw SDK error, and keep the technical detail in the console
    // (logged by the PreJoinScreens catch) for support/debugging.
    case Boolean(error):
      headline = 'No se pudo acceder a la cámara o el micrófono:';
      message =
        'Ocurrió un problema al acceder a tus dispositivos. Revisa que la cámara y el micrófono estén conectados y disponibles, y vuelve a intentarlo.';
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
