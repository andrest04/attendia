import { FALLBACK_LANGUAGE } from './resolveLocale';

let currentLanguage: string = FALLBACK_LANGUAGE;
let changeLanguage: ((language: string) => void) | undefined;

// Pure helpers work without loading the app singleton; the singleton installs a bridge.
export function bindCurrentLanguage(change: (language: string) => void): void {
  changeLanguage = change;
}

export function syncCurrentLanguage(language?: string | null): void {
  currentLanguage = language || FALLBACK_LANGUAGE;
}

// The language pure helpers fall back to when the caller does not pass one.
export function getCurrentLanguage(): string {
  return currentLanguage;
}

export function setCurrentLanguage(language?: string | null): void {
  const next = language || FALLBACK_LANGUAGE;
  if (changeLanguage) changeLanguage(next);
  else syncCurrentLanguage(next);
}
