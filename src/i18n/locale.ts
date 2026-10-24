import { createStorageSlot } from '../utils/createStorageSlot';

export type Locale = 'es' | 'en';

/** Browser preference. Not an account field — see odd/tasks/i18n-es-en.md S5. */
export const LOCALE_STORAGE_KEY = 'attendia-locale';

function parseLocale(stored: unknown): Locale | null {
  return stored === 'es' || stored === 'en' ? stored : null;
}

const slot = createStorageSlot<Locale>({
  key: LOCALE_STORAGE_KEY,
  area: 'localStorage',
  parse: parseLocale,
});

type Listener = () => void;
const listeners = new Set<Listener>();

/** Spanish when nothing valid is stored, including a storage failure. */
export function getLocale(): Locale {
  return slot.read() ?? 'es';
}

export function setLocale(next: Locale): void {
  if (next !== 'es' && next !== 'en') return;
  if (getLocale() === next) return;
  slot.write(next);
  listeners.forEach(listener => listener());
}

export function subscribeLocale(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Header the token server and the other JSON routes read. Exactly `es` or `en`. */
export function acceptLanguageHeader(): { 'Accept-Language': Locale } {
  return { 'Accept-Language': getLocale() };
}

/** BCP 47 tag for date and time formatting. Read at call time so a language switch applies. */
export function dateLocale(): string {
  return getLocale() === 'en' ? 'en-US' : 'es-AR';
}
