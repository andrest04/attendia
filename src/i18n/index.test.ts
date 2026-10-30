import { LANGUAGE_STORAGE_KEY } from './createI18n';

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
    const i18n = require('./index').default;
    await i18n.changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
    expect(description.content).toBe('Video classroom platform with attention telemetry.');
    await i18n.changeLanguage('es');
    expect(document.documentElement.lang).toBe('es');
    expect(description.content).toBe('Plataforma de clases en video con telemetría de atención.');
  });

  it('continues to synchronize language if the description tag is absent', async () => {
    description.remove();
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es');
    const i18n = require('./index').default;
    await i18n.changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
  });
});
