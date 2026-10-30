import { getI18n } from 'react-i18next';
import { createI18n, LANGUAGE_STORAGE_KEY } from './createI18n';
import spanishTranslator from './spanishTranslator';
import appI18n from './index';

describe('createI18n', () => {
  beforeEach(() => window.localStorage.clear());

  it('keeps pure Spanish translators independent of the React instance', async () => {
    const app = getI18n();
    expect(app).toBe(appI18n);
    const pure = createI18n({ detect: false, lng: 'es', react: false });
    expect(getI18n()).toBe(app);
    await app.changeLanguage('en');
    expect(spanishTranslator('common:language.label')).toBe('Idioma');
    expect(pure.t('common:language.label')).toBe('Idioma');
    await app.changeLanguage('es');
  });

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

  it('returns the key for missing keys instead of null', () => {
    expect(createI18n({ detect: false }).t('common:missing.key')).toBe('missing.key');
  });

  it('detects the language from localStorage', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    expect(createI18n().language).toBe('en');
  });

  it('migrates a valid legacy preference, but prefers a valid i18next preference', () => {
    window.localStorage.setItem('attendia-locale', JSON.stringify('en'));
    expect(createI18n().language).toBe('en');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es');
    expect(createI18n().language).toBe('es');
  });

  it('skips an invalid i18next preference in favor of legacy storage', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
    window.localStorage.setItem('attendia-locale', JSON.stringify('en'));
    expect(createI18n().language).toBe('en');
  });

  it('lets a valid query override both stored preferences', () => {
    window.history.replaceState({}, '', '?lang=es');
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    window.localStorage.setItem('attendia-locale', JSON.stringify('en'));
    try {
      expect(createI18n().language).toBe('es');
    } finally {
      window.history.replaceState({}, '', '/');
    }
  });

  it('skips an unsupported query and malformed legacy preference', () => {
    window.history.replaceState({}, '', '?lang=fr');
    window.localStorage.setItem('attendia-locale', '{invalid');
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es');
    try {
      expect(createI18n().language).toBe('es');
    } finally {
      window.history.replaceState({}, '', '/');
    }
  });

  it('survives storage becoming blocked after an earlier successful detection', async () => {
    createI18n();
    const get = jest.spyOn(window.localStorage, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const set = jest.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    try {
      const i18n = createI18n();
      await i18n.changeLanguage('en');
      expect(i18n.resolvedLanguage).toBe('en');
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });

  it('caches a language change in localStorage', async () => {
    const i18n = createI18n();
    await i18n.changeLanguage('en');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  });
});
