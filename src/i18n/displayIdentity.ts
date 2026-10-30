import { t } from './translate';

const TEACHER_SUFFIX = '[Profesor]';

/**
 * Visible form of a Twilio identity. The stored suffix stays `[Profesor]` so role
 * checks keep working; only the label the person sees follows the language.
 */
export function displayIdentity(identity: string | null | undefined): string {
  if (!identity) return '';
  const trimmed = identity.trim();
  if (!trimmed.toLowerCase().endsWith(TEACHER_SUFFIX.toLowerCase())) return trimmed;
  const name = trimmed.slice(0, trimmed.length - TEACHER_SUFFIX.length).trim();
  const label = `[${t('Profesor')}]`;
  return name ? `${name} ${label}` : label;
}
