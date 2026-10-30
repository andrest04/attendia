import { Locale } from './locale';

/**
 * English notification copy for the JSON response. Firestore keeps the Spanish
 * title and message (S6). Class names are recovered from the stored Spanish title.
 */
const EN_NOTIFICATION: {
  [eventType: string]: {
    title: string;
    message: string;
    titleWithName?: string;
    messageWithName?: string;
  };
} = {
  'class.upcoming': {
    title: 'Upcoming class',
    titleWithName: 'Upcoming class: {{name}}',
    message: 'Your class starts in 15 minutes.',
    messageWithName: 'Your class "{{name}}" starts in 15 minutes.',
  },
  'class.not_started': {
    title: 'Class not started',
    titleWithName: 'Class not started: {{name}}',
    message: 'The scheduled class has not been started yet.',
    messageWithName: 'Your scheduled class "{{name}}" has not been started yet.',
  },
  'recording.ready': {
    title: 'Recording ready',
    message: 'The recording you requested is available.',
  },
  'recording.failed': {
    title: 'Recording processing error',
    message: 'The requested recording could not be processed.',
  },
  'report.save_failed': {
    title: 'Could not save the report',
    message: 'The report is still pending. Try again from history.',
  },
};

const STORED_TITLE_PREFIXES = ['Clase próxima: ', 'Clase no iniciada: '];

export function classNameFromStoredTitle(title: unknown): string | null {
  if (typeof title !== 'string') return null;
  const prefix = STORED_TITLE_PREFIXES.find(value => title.startsWith(value));
  return prefix ? title.slice(prefix.length) : null;
}

function fill(template: string, name: string): string {
  return template.replace('{{name}}', name);
}

/** Localizes a stored notification for the HTTP response. Spanish stays byte-for-byte. */
export function localizeNotificationCopy(
  locale: Locale,
  item: { eventType?: unknown; title?: unknown; message?: unknown }
): { title: unknown; message: unknown } {
  if (locale !== 'en' || typeof item.eventType !== 'string') {
    return { title: item.title, message: item.message };
  }
  const copy = EN_NOTIFICATION[item.eventType];
  if (!copy) return { title: item.title, message: item.message };
  const name = classNameFromStoredTitle(item.title);
  return {
    title: name && copy.titleWithName ? fill(copy.titleWithName, name) : copy.title,
    message: name && copy.messageWithName ? fill(copy.messageWithName, name) : copy.message,
  };
}
