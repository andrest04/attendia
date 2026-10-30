import { getLocale } from './locale';
import { EN } from './messages';

/** Returns the Spanish source unless the selected language is English and a translation exists. */
export function t(spanish: string, vars?: { [name: string]: string | number }): string {
  const template = getLocale() === 'en' ? EN[spanish] || spanish : spanish;
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => {
    const value = vars[name];
    return value === undefined || value === null ? '' : String(value);
  });
}
