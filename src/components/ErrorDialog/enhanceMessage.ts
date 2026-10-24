import { t } from '../../i18n/translate';
// This function is used to provide error messages to the user that are
// different than the error messages provided by the SDK.
export default function enhanceMessage(message = '', code?: number, name?: string) {
  // getUserMedia errors are best matched by their (browser-stable) name, with a
  // fallback to the raw message since Twilio/browsers word these differently.
  const permissionDenied = name === 'NotAllowedError' || name === 'PermissionDeniedError';
  const deviceInUse =
    name === 'NotReadableError' ||
    name === 'TrackStartError' ||
    message === 'Failed to allocate videosource' ||
    message === 'Could not start video source';
  const deviceNotFound = name === 'NotFoundError' || name === 'DevicesNotFoundError';

  switch (true) {
    case code === 20101: // Invalid token error
      return t('No se pudo validar la sesión. Verifica que las credenciales sean correctas.');
    case message === 'Permission denied by system':
      return t(
        'No se puede compartir la pantalla. Verifica que el sistema operativo tenga habilitados los permisos para compartir pantalla.'
      );
    case permissionDenied:
      return t(
        'El navegador bloqueó el acceso a la cámara o el micrófono. Haz clic en el ícono de la cámara (a la izquierda de la barra de direcciones), permite el acceso y vuelve a intentar.'
      );
    case deviceInUse:
      return t('No se pudo iniciar la cámara. Cierra otras apps o pestañas que la estén usando y vuelve a intentar.');
    case deviceNotFound:
      return t('No se encontró una cámara o un micrófono. Conecta un dispositivo y vuelve a intentar.');
    default:
      return message;
  }
}
