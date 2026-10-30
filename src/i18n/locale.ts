import i18n from './index';
import { LEGACY_LOCALE_STORAGE_KEY } from './createI18n';

export type Locale = 'es' | 'en';

/** Browser preference. Not an account field — see odd/tasks/i18n-es-en.md S5. */
export const LOCALE_STORAGE_KEY = LEGACY_LOCALE_STORAGE_KEY;

/** The singleton is the source of truth, including when storage is unavailable. */
export function getLocale(): Locale {
  return (i18n.resolvedLanguage || i18n.language || '').toLowerCase().split('-')[0] === 'en' ? 'en' : 'es';
}

export function setLocale(next: Locale): void {
  if (next !== 'es' && next !== 'en') return;
  if (getLocale() === next) return;
  i18n.changeLanguage(next);
}

export function subscribeLocale(listener: () => void): () => void {
  i18n.on('languageChanged', listener);
  return () => i18n.off('languageChanged', listener);
}

/** Header the token server and the other JSON routes read. Exactly `es` or `en`. */
export function acceptLanguageHeader(): { 'Accept-Language': Locale } {
  return { 'Accept-Language': getLocale() };
}

/** BCP 47 tag for date and time formatting. Read at call time so a language switch applies. */
export function dateLocale(): string {
  return getLocale() === 'en' ? 'en-US' : 'es-AR';
}
