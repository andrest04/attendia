import i18next, { i18n as I18nInstance } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import es from './locales/es';
import { FALLBACK_LANGUAGE, SUPPORTED_LANGUAGES } from './resolveLocale';

export const LANGUAGE_STORAGE_KEY = 'i18nextLng';
export const LEGACY_LOCALE_STORAGE_KEY = 'attendia-locale';

interface CreateI18nOptions {
  // false = no language detector (tests, deterministic runs).
  detect?: boolean;
  // Forces the language; only meaningful when detect is false.
  lng?: string;
  // Pure translators must not replace react-i18next's global instance.
  react?: boolean;
}

export function createI18n({ detect = true, lng, react = true }: CreateI18nOptions = {}): I18nInstance {
  const instance = i18next.createInstance();
  if (detect) {
    const detector = new LanguageDetector();
    // The built-in detector caches its storage availability probe; access can still fail later.
    detector.addDetector({
      name: 'safeStorage',
      lookup() {
        try {
          return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) || undefined;
        } catch {
          return undefined;
        }
      },
      cacheUserLanguage(language) {
        try {
          window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
        } catch {
          // Language changes remain usable in memory when storage is blocked.
        }
      },
    });
    detector.addDetector({
      name: 'legacyLocale',
      lookup() {
        try {
          const value = JSON.parse(window.localStorage.getItem(LEGACY_LOCALE_STORAGE_KEY) || 'null');
          return value === 'es' || value === 'en' ? value : undefined;
        } catch {
          return undefined;
        }
      },
    });
    instance.use(detector);
  }
  if (react) instance.use(initReactI18next);
  instance.init({
    resources: { es, en },
    lng: detect ? undefined : lng || FALLBACK_LANGUAGE,
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    nonExplicitSupportedLngs: true,
    defaultNS: 'common',
    ns: [
      'common',
      'classSessions',
      'room',
      'toolbar',
      'notifications',
      'prejoin',
      'auth',
      'errors',
      'chat',
      'misc',
      'dashboardShell',
      'calendar',
      'teacherProfile',
      'completeNotifications',
      'completePages',
      'completeBackground',
      'completeControls',
      'completeDashboard',
    ],
    returnNull: false,
    interpolation: { escapeValue: false },
    initImmediate: false,
    detection: {
      order: ['querystring', 'safeStorage', 'legacyLocale', 'navigator'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['safeStorage'],
    },
  });
  return instance;
}
