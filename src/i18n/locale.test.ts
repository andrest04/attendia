import { acceptLanguageHeader, getLocale, LOCALE_STORAGE_KEY, setLocale } from './locale';
import { t } from './translate';

afterEach(() => {
  window.localStorage.clear();
});

describe('locale', () => {
  it('defaults to Spanish when nothing is stored', () => {
    expect(getLocale()).toBe('es');
    expect(acceptLanguageHeader()).toEqual({ 'Accept-Language': 'es' });
  });

  it('persists English and ignores anything else', () => {
    setLocale('en');
    expect(getLocale()).toBe('en');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe(JSON.stringify('en'));

    setLocale('fr' as 'en');
    expect(getLocale()).toBe('en');
  });

  it('treats a hand-edited storage value as Spanish', () => {
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
