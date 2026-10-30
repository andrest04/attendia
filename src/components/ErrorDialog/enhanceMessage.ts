import { TFunction } from 'i18next';
import spanishTranslator from '../../i18n/spanishTranslator';
import completeErrorsEn from '../../i18n/locales/completeErrors.en';
import completeErrorsEs from '../../i18n/locales/completeErrors.es';

// This function is used to provide error messages to the user that are
// different than the error messages provided by the SDK.
export default function enhanceMessage(
  message = '',
  code?: number | string,
  name?: string,
  t: TFunction = spanishTranslator,
  language = 'es',
  external = false
) {
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
      return t('errors:enhanced.invalidToken');
    case message === 'Permission denied by system':
      return t('errors:enhanced.screenShareSystemDenied');
    case permissionDenied:
      return t('errors:enhanced.permissionDenied');
    case deviceInUse:
      return t('errors:enhanced.deviceInUse');
    case deviceNotFound:
      return t('errors:enhanced.deviceNotFound');
    default:
      return external || (typeof code === 'number' && code !== 0 && (!name || name === 'TwilioError'))
        ? language.split('-')[0] === 'en'
          ? completeErrorsEn.unexpectedExternal
          : completeErrorsEs.unexpectedExternal
        : message;
  }
}
