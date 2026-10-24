import { notificationEmoji } from './professorShellHelpers';
import { setLocale } from '../../../i18n/locale';
import { t } from '../../../i18n/translate';

describe('notificationEmoji', () => {
  afterEach(() => setLocale('es'));

  it('picks the emoji from the Spanish copy', () => {
    expect(notificationEmoji('Ana levantó la mano')).toBe('✋');
    expect(notificationEmoji('Ana se unió a la sesión')).toBe('🔔');
    expect(notificationEmoji('Ana salió de la sesión')).toBe('👋');
    expect(notificationEmoji('Otra cosa')).toBe('🔔');
  });

  it('picks the same emoji from the English copy the notifications produce', () => {
    setLocale('en');

    expect(notificationEmoji(t('{{name}} levantó la mano', { name: 'Ana' }))).toBe('✋');
    expect(notificationEmoji(t('{{name}} se unió a la sesión', { name: 'Ana' }))).toBe('🔔');
    expect(notificationEmoji(t('{{name}} salió de la sesión', { name: 'Ana' }))).toBe('👋');
  });
});
