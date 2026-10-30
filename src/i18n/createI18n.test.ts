import { createI18n, LANGUAGE_STORAGE_KEY } from './createI18n';

describe('createI18n', () => {
  beforeEach(() => window.localStorage.clear());

  it('defaults to Spanish without detection', () => {
    const i18n = createI18n({ detect: false });
    expect(i18n.language).toBe('es');
    expect(i18n.t('common:language.label')).toBe('Idioma');
  });

  it('translates to English and falls back to Spanish for unsupported languages', () => {
    const i18n = createI18n({ detect: false, lng: 'en' });
    expect(i18n.t('common:language.label')).toBe('Language');
    const fr = createI18n({ detect: false, lng: 'fr' });
    expect(fr.t('common:language.label')).toBe('Idioma');
  });

  it('uses Spanish wording for the room sharing hint', () => {
    const i18n = createI18n({ detect: false, lng: 'es' });
    expect(i18n.t('prejoin:roomName.teacher.shareHint')).toBe('Comparte el código o el enlace con tus estudiantes.');
  });

  it('uses Spanish wording for the simulated report label', () => {
    const i18n = createI18n({ detect: false, lng: 'es' });
    expect(i18n.t('common:completeReports.report.mock')).toBe(
      'Datos simulados — procesamiento de visión por computadora pendiente'
    );
  });

  it('returns the key for missing keys instead of null', () => {
    expect(createI18n({ detect: false }).t('common:missing.key')).toBe('missing.key');
  });

  it('detects the language from localStorage', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    expect(createI18n().language).toBe('en');
  });

  it('caches a language change in localStorage', async () => {
    const i18n = createI18n();
    await i18n.changeLanguage('en');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  });
});
