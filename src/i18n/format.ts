import { getCurrentLanguage } from './currentLanguage';
import { resolveLocale } from './resolveLocale';

type DateInput = Date | number;

function toDate(value: DateInput): Date {
  return typeof value === 'number' ? new Date(value) : value;
}

function localeOf(language?: string | null): string {
  return resolveLocale(language === undefined ? getCurrentLanguage() : language);
}

/** Capitalizes the first character ("miércoles, 8 de julio" -> "Miércoles, 8 de julio"). */
export function capitalizeFirst(value: string): string {
  return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;
}

export function formatDate(value: DateInput, options: Intl.DateTimeFormatOptions, language?: string | null): string {
  return new Intl.DateTimeFormat(localeOf(language), options).format(toDate(value));
}

/** Short day label: "8 jul" (es) / "Jul 8" (en). */
export function formatShortDate(value: DateInput, language?: string | null): string {
  return formatDate(value, { day: 'numeric', month: 'short' }, language);
}

/** Localized long date with Intl word order: "8 de julio de 2026" / "July 8, 2026". */
export function formatLongDate(value: DateInput, language?: string | null): string {
  return formatDate(value, { day: 'numeric', month: 'long', year: 'numeric' }, language);
}

/** Long date without the year: "8 de julio" / "July 8". */
export function formatDayMonth(value: DateInput, language?: string | null): string {
  return formatDate(value, { day: 'numeric', month: 'long' }, language);
}

/** Long date with weekday, first letter capitalized: "Miércoles, 8 de julio de 2026" / "Wednesday, July 8, 2026". */
export function formatLongDateWithWeekday(value: DateInput, language?: string | null): string {
  return capitalizeFirst(
    formatDate(value, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, language)
  );
}

/**
 * Time of day. Spanish keeps the compact "10:00 am" label the dashboard has always shown
 * (es-AR Intl would give "10:00 a. m."); every other language uses Intl ("10:00 AM").
 */
export function formatTime(value: DateInput, language?: string | null): string {
  const date = toDate(value);
  if (localeOf(language).startsWith('es')) {
    const hours24 = date.getHours();
    const minutes = date.getMinutes();
    const period = hours24 < 12 ? 'am' : 'pm';
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    return `${hours12}:${minutes < 10 ? `0${minutes}` : minutes} ${period}`;
  }
  return formatDate(date, { hour: 'numeric', minute: '2-digit' }, language);
}

/** Weekday name for a 0 (Sunday) - 6 (Saturday) index. */
export function weekdayName(
  dayIndex: number,
  style: 'long' | 'short' | 'narrow' = 'long',
  language?: string | null
): string {
  // 2023-01-01 was a Sunday.
  return formatDate(new Date(2023, 0, 1 + dayIndex), { weekday: style }, language);
}

/** Month name for a 0 (January) - 11 (December) index. */
export function monthName(monthIndex: number, style: 'long' | 'short' = 'long', language?: string | null): string {
  return formatDate(new Date(2023, monthIndex, 1), { month: style }, language);
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions, language?: string | null): string {
  return new Intl.NumberFormat(localeOf(language), options).format(value);
}
