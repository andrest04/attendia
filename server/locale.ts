export type Locale = 'es' | 'en';

type HeaderSource = { headers?: { [name: string]: unknown } } | undefined;

/**
 * Preferred language from `Accept-Language`. Missing, empty, or anything other than English
 * stays Spanish so existing clients and tests keep the current copy.
 * Only the first tag is read; the app sends exactly `es` or `en`.
 */
export function resolveLocale(req: HeaderSource): Locale {
  const header = req && req.headers ? req.headers['accept-language'] : undefined;
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== 'string') return 'es';
  const tag = value.split(',')[0].trim().toLowerCase();
  if (tag === 'en' || tag.startsWith('en-')) return 'en';
  return 'es';
}
