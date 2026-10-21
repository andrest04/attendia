import i18next, { i18n as I18nInstance } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import es from './locales/es';
import { FALLBACK_LANGUAGE, SUPPORTED_LANGUAGES } from './resolveLocale';

export const LANGUAGE_STORAGE_KEY = 'i18nextLng';

interface CreateI18nOptions {
  // false = no language detector (tests, deterministic runs).
  detect?: boolean;
  // Forces the language; only meaningful when detect is false.
  lng?: string;
}

export function createI18n({ detect = true, lng }: CreateI18nOptions = {}): I18nInstance {
  const instance = i18next.createInstance();
  if (detect) {
    instance.use(LanguageDetector);
  }
  instance.use(initReactI18next);
  instance.init({
    resources: { es, en },
    lng: detect ? undefined : lng || FALLBACK_LANGUAGE,
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    nonExplicitSupportedLngs: true,
    defaultNS: 'common',
    ns: ['common'],
    returnNull: false,
    interpolation: { escapeValue: false },
    initImmediate: false,
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  });
  return instance;
}
