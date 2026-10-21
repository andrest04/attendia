export type SupportedLanguage = 'es' | 'en';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['es', 'en'];
export const FALLBACK_LANGUAGE: SupportedLanguage = 'es';

const LOCALE_BY_LANGUAGE: { [language: string]: string } = {
  es: 'es-AR',
  en: 'en-US',
};

// Maps an i18next language ("es", "en-GB", undefined...) to the BCP47 locale used by Intl.
export function resolveLocale(language?: string | null): string {
  const base = (language || '').toLowerCase().split('-')[0];
  return LOCALE_BY_LANGUAGE[base] || LOCALE_BY_LANGUAGE[FALLBACK_LANGUAGE];
}
