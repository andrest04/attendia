import { setLocale } from '../../../i18n/locale';
import { t } from '../../../i18n/translate';
import { createI18n } from '../../../i18n/createI18n';
import { notificationEmoji, presenceView, proctoringKindMessage } from './professorShellHelpers';

const es = createI18n({ detect: false, lng: 'es' });
const en = createI18n({ detect: false, lng: 'en' });

describe('presenceView', () => {
  it('keeps the Spanish copy as the base language', () => {
    expect(es.t(presenceView.cameraOff.labelKey)).toBe('Cámara apagada');
    expect(es.t(presenceView.pending.labelKey)).toBe('Analizando… (sin lectura aún)');
  });

  it('resolves every presence label in English', () => {
    const labels = Object.values(presenceView).map(view => en.t(view.labelKey));
    expect(labels).toEqual([
      'Not measurable (phone)',
      'Camera off',
      'Analyzing… (no reading yet)',
      'No measurement — face not detected',
    ]);
  });
});

describe('proctoringKindMessage', () => {
  it.each(['camera-off', 'multiface', 'away', 'absent'] as const)('translates the %s message', kind => {
    const spanish = proctoringKindMessage(kind, 'Ana', '10:05', es.t.bind(es));
    const english = proctoringKindMessage(kind, 'Ana', '10:05', en.t.bind(en));
    expect(spanish).toContain('Ana');
    expect(spanish).toContain('Detectado a las 10:05');
    expect(english).toContain('Ana');
    expect(english).toContain('Detected at 10:05');
    expect(english).not.toBe(spanish);
  });
});

describe('notificationEmoji', () => {
  it('is keyed by the event, not by the translated text', () => {
    expect(notificationEmoji('hand')).toBe('✋');
    expect(notificationEmoji('joined')).toBe('🔔');
    expect(notificationEmoji('left')).toBe('👋');
    expect(notificationEmoji(undefined)).toBe('🔔');
  });

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
