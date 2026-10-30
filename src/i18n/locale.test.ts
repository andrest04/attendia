import { acceptLanguageHeader, dateLocale, getLocale, LOCALE_STORAGE_KEY, setLocale, subscribeLocale } from './locale';
import { t } from './translate';
import i18n from './index';
import { LANGUAGE_STORAGE_KEY } from './createI18n';
import { getCurrentLanguage, setCurrentLanguage } from './currentLanguage';

beforeEach(() => {
  i18n.changeLanguage('es');
  window.localStorage.clear();
});

afterEach(() => {
  i18n.changeLanguage('es');
  window.localStorage.clear();
});

describe('locale', () => {
  it('defaults to Spanish when nothing is stored', () => {
    expect(getLocale()).toBe('es');
    expect(acceptLanguageHeader()).toEqual({ 'Accept-Language': 'es' });
  });

  it('persists only to i18next storage for both change APIs, leaving legacy storage untouched', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify('es'));
    const set = jest.spyOn(window.localStorage, 'setItem');
    try {
      setLocale('en');
      expect(getLocale()).toBe('en');
      expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
      i18n.changeLanguage('es');
      expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('es');
      expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe(JSON.stringify('es'));
      expect(set.mock.calls.some(([key]) => key === LOCALE_STORAGE_KEY)).toBe(false);
      setLocale('fr' as 'en');
      expect(getLocale()).toBe('es');
    } finally {
      set.mockRestore();
    }
  });

  it('keeps both language APIs aligned across changes and no-op locale requests', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeLocale(listener);
    try {
      setCurrentLanguage('en');
      expect(getLocale()).toBe('en');
      expect(getCurrentLanguage()).toBe('en');
      expect(acceptLanguageHeader()).toEqual({ 'Accept-Language': 'en' });
      setLocale('es');
      expect(getCurrentLanguage()).toBe('es');
      expect(getLocale()).toBe('es');
      const count = listener.mock.calls.length;
      setLocale('es');
      expect(listener).toHaveBeenCalledTimes(count);
      expect(getCurrentLanguage()).toBe('es');
      setCurrentLanguage(null);
      expect(getLocale()).toBe('es');
      expect(getCurrentLanguage()).toBe('es');
    } finally {
      unsubscribe();
    }
  });

  it('does not recurse when a languageChanged listener synchronizes the helper', () => {
    let calls = 0;
    const listener = (language: string) => {
      if (++calls > 2) throw new Error('recursive languageChanged event');
      setCurrentLanguage(language);
    };
    i18n.on('languageChanged', listener);
    try {
      setLocale('en');
      expect(calls).toBe(1);
      expect(getCurrentLanguage()).toBe('en');
      expect(getLocale()).toBe('en');
      setCurrentLanguage('es');
      expect(calls).toBe(2);
      expect(getCurrentLanguage()).toBe('es');
      expect(getLocale()).toBe('es');
    } finally {
      i18n.off('languageChanged', listener);
    }
  });

  it('notifies on singleton changes and unsubscribes cleanly', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeLocale(listener);
    i18n.changeLanguage('en');
    expect(getLocale()).toBe('en');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setLocale('es');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('changes language in memory when storage is blocked', () => {
    const set = jest.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    try {
      expect(() => setLocale('en')).not.toThrow();
      expect(getLocale()).toBe('en');
      expect(t('Idioma')).toBe('Language');
    } finally {
      set.mockRestore();
    }
  });

  it('ignores a hand-edited storage value after initialization', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify('pt'));
    expect(getLocale()).toBe('es');
  });
});

describe('t', () => {
  it('returns the Spanish source by default, including an untranslated string', () => {
    expect(t('Iniciar sesión')).toBe('Iniciar sesión');
    expect(t('Sin traducción todavía')).toBe('Sin traducción todavía');
  });

  it('returns English after the language changes, and interpolates', () => {
    setLocale('en');
    expect(t('Iniciar sesión')).toBe('Sign in');
    expect(t('En {{count}} min', { count: 5 })).toBe('En 5 min');
  });

  it('does not translate the teacher identity suffix', () => {
    setLocale('en');
    expect(t('Ana [Profesor]')).toBe('Ana [Profesor]');
  });
});

describe('dateLocale', () => {
  it('is es-AR by default and en-US in English, read at call time', () => {
    expect(dateLocale()).toBe('es-AR');
    setLocale('en');
    expect(dateLocale()).toBe('en-US');
    setLocale('es');
    expect(dateLocale()).toBe('es-AR');
  });
});
