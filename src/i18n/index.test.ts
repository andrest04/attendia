import { getI18n } from 'react-i18next';
import i18n from './index';
import testI18n from './testInit';
import { getCurrentLanguage, setCurrentLanguage } from './currentLanguage';
import { getLocale, setLocale } from './locale';
import { LANGUAGE_STORAGE_KEY } from './createI18n';

afterEach(() => {
  i18n.changeLanguage('es');
  window.localStorage.clear();
});

it('initializes the app and React i18n singleton in Spanish', () => {
  expect(testI18n).toBe(i18n);
  expect(getI18n()).toBe(i18n);
  expect(i18n.language).toBe('es');
  expect(i18n.t('common:language.label')).toBe('Idioma');
  expect(getCurrentLanguage()).toBe('es');
  expect(document.documentElement.lang).toBe('es');
});

it('keeps app language helpers synchronized with singleton changes', async () => {
  await i18n.changeLanguage('en');
  expect(getCurrentLanguage()).toBe('en');
  expect(document.documentElement.lang).toBe('en');
  expect(getLocale()).toBe('en');
  setCurrentLanguage('es');
  expect(getLocale()).toBe('es');
  setLocale('en');
  expect(getCurrentLanguage()).toBe('en');
});

describe('document metadata synchronization', () => {
  let description: HTMLMetaElement;
  let originalLang: string;

  beforeEach(() => {
    jest.resetModules();
    window.localStorage.clear();
    originalLang = document.documentElement.lang;
    description = document.createElement('meta');
    description.name = 'description';
    description.content = 'static bilingual fallback';
    document.head.appendChild(description);
  });

  afterEach(() => {
    description.remove();
    document.documentElement.lang = originalLang;
    window.localStorage.clear();
  });

  it.each([
    ['es', 'Plataforma de clases en video con telemetría de atención.'],
    ['en', 'Video classroom platform with attention telemetry.'],
  ])('sets the initial description for %s', (language, expected) => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    require('./index');
    expect(document.documentElement.lang).toBe(language);
    expect(description.content).toBe(expected);
  });

  it('updates the description and document language when switching in both directions', async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es');
    const freshI18n = require('./index').default;
    await freshI18n.changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
    expect(description.content).toBe('Video classroom platform with attention telemetry.');
    await freshI18n.changeLanguage('es');
    expect(document.documentElement.lang).toBe('es');
    expect(description.content).toBe('Plataforma de clases en video con telemetría de atención.');
  });

  it('continues to synchronize language if the description tag is absent', async () => {
    description.remove();
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es');
    const freshI18n = require('./index').default;
    await freshI18n.changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
  });
});
