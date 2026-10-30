import { TFunction } from 'i18next';
import { TeacherNotification } from '../../state/useFirebaseAuth/useFirebaseAuth';
import es from '../../i18n/locales/completeNotifications.es';

// Only rewrite copy that matches the server's canonical templates. Older or
// independently authored text must remain readable, even for a known event.
export function localizeNotification(notification: TeacherNotification, t: TFunction) {
  const original = { title: notification.title, message: notification.message };
  const keys = {
    'class.upcoming': 'upcoming',
    'class.not_started': 'notStarted',
    'recording.ready': 'recordingReady',
    'recording.failed': 'recordingFailed',
    'report.save_failed': 'reportFailed',
  } as const;
  const key = keys[notification.eventType];
  if (!key) return original;
  const copy = es[key];
  let titleKey = 'title';
  let messageKey = 'message';
  let name: string | undefined;
  if (notification.title !== copy.title || notification.message !== copy.message) {
    if (key !== 'upcoming' && key !== 'notStarted') return original;
    const classCopy = es[key];
    const prefix = classCopy.namedTitle.split('{{name}}')[0];
    if (!notification.title.startsWith(prefix)) return original;
    name = notification.title.slice(prefix.length);
    if (!name || notification.message !== classCopy.namedMessage.replace('{{name}}', name)) return original;
    titleKey = 'namedTitle';
    messageKey = 'namedMessage';
  }
  return {
    title: t(`${key}.${titleKey}`, { name, defaultValue: notification.title, interpolation: { escapeValue: false } }),
    message: t(`${key}.${messageKey}`, { name, defaultValue: notification.message, interpolation: { escapeValue: false } }),
  };
}
