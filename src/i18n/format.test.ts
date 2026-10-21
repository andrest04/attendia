import {
  capitalizeFirst,
  formatDayMonth,
  formatLongDate,
  formatLongDateWithWeekday,
  formatNumber,
  formatShortDate,
  formatTime,
  monthName,
  weekdayName,
} from './format';
import { getCurrentLanguage, setCurrentLanguage } from './currentLanguage';

// Wednesday, July 8 2026, 15:05 (tests run with TZ=utc; Date parts are local).
const DATE = new Date(2026, 6, 8, 15, 5, 0);

describe('format helpers', () => {
  afterEach(() => setCurrentLanguage('es'));

  it('formats dates in Spanish and English word order', () => {
    expect(formatLongDate(DATE, 'es')).toBe('8 de julio de 2026');
    expect(formatLongDate(DATE, 'en')).toBe('July 8, 2026');
    expect(formatDayMonth(DATE, 'es')).toBe('8 de julio');
    expect(formatDayMonth(DATE, 'en')).toBe('July 8');
    expect(formatShortDate(DATE, 'en')).toBe('Jul 8');
    expect(formatShortDate(DATE, 'es')).toBe(DATE.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }));
  });

  it('capitalizes the weekday of the long date', () => {
    expect(formatLongDateWithWeekday(DATE, 'es')).toBe('Miércoles, 8 de julio de 2026');
    expect(formatLongDateWithWeekday(DATE, 'en')).toBe('Wednesday, July 8, 2026');
    expect(capitalizeFirst('')).toBe('');
  });

  it('formats the time of day', () => {
    expect(formatTime(DATE, 'es')).toBe('3:05 pm');
    expect(formatTime(new Date(2026, 6, 8, 0, 0), 'es')).toBe('12:00 am');
    expect(formatTime(DATE, 'en')).toMatch(/^3:05\sPM$/);
  });

  it('names weekdays and months', () => {
    expect(weekdayName(0, 'long', 'es')).toBe('domingo');
    expect(weekdayName(3, 'long', 'en')).toBe('Wednesday');
    expect(monthName(0, 'long', 'es')).toBe('enero');
    expect(monthName(11, 'long', 'en')).toBe('December');
  });

  it('formats numbers with the locale separators', () => {
    expect(formatNumber(1234.5, undefined, 'en')).toBe('1,234.5');
    expect(formatNumber(1234.5, undefined, 'es')).toBe('1.234,5');
  });

  it('accepts timestamps and defaults to the current language', () => {
    expect(formatLongDate(DATE.getTime(), 'en')).toBe('July 8, 2026');
    expect(formatLongDate(DATE)).toBe('8 de julio de 2026');
    setCurrentLanguage('en');
    expect(getCurrentLanguage()).toBe('en');
    expect(formatLongDate(DATE)).toBe('July 8, 2026');
  });
});
