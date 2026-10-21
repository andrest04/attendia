import { resolveLocale } from './resolveLocale';

describe('resolveLocale', () => {
  it('maps supported languages to Intl locales', () => {
    expect(resolveLocale('es')).toBe('es-AR');
    expect(resolveLocale('en')).toBe('en-US');
  });

  it('ignores the region and casing of the language', () => {
    expect(resolveLocale('en-GB')).toBe('en-US');
    expect(resolveLocale('ES-mx')).toBe('es-AR');
  });

  it('falls back to Spanish for unknown or missing languages', () => {
    expect(resolveLocale('fr')).toBe('es-AR');
    expect(resolveLocale(undefined)).toBe('es-AR');
    expect(resolveLocale('')).toBe('es-AR');
  });
});
