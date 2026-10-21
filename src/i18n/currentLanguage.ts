import { FALLBACK_LANGUAGE } from './resolveLocale';

let currentLanguage: string = FALLBACK_LANGUAGE;

// The language pure helpers fall back to when the caller does not pass one.
// The app singleton (`./index`) keeps it in sync; tests keep the Spanish default.
export function getCurrentLanguage(): string {
  return currentLanguage;
}

export function setCurrentLanguage(language?: string | null): void {
  currentLanguage = language || FALLBACK_LANGUAGE;
}
