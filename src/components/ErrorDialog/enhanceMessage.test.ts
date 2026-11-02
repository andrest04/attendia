import { createI18n } from '../../i18n/createI18n';
import enhanceMessage from './enhanceMessage';

describe('enhanceMessage', () => {
  const duplicateIdentity = 'Participant disconnected because of duplicate identity';

  it('explains a replaced connection in Spanish', () => {
    expect(enhanceMessage(duplicateIdentity, 53205, 'TwilioError')).toBe(
      'Entraste a esta clase desde otra pestaña o dispositivo, así que esta conexión se cerró.'
    );
  });

  it('explains a replaced connection in English', () => {
    const { t } = createI18n({ detect: false, lng: 'en', react: false });
    expect(enhanceMessage(duplicateIdentity, 53205, 'TwilioError', t, 'en')).toBe(
      'You joined this class from another tab or device, so this connection was closed.'
    );
  });

  it('keeps the generic text for other Twilio codes', () => {
    expect(enhanceMessage('raw', 53000, 'TwilioError')).toBe('Ocurrió un error inesperado.');
  });
});
