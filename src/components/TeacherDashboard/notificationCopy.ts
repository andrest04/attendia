import { TeacherNotification } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { t } from '../../i18n/translate';

const TITLE_PREFIXES = ['Clase próxima: ', 'Clase no iniciada: ', 'Upcoming class: ', 'Class not started: '];

function className(title: string): string | null {
  const prefix = TITLE_PREFIXES.find(value => title.startsWith(value));
  return prefix ? title.slice(prefix.length) : null;
}

/** Display copy for a stored notification. Known event types follow the selected language. */
export function notificationText(
  notification: Pick<TeacherNotification, 'eventType' | 'title' | 'message'>
): {
  title: string;
  message: string;
} {
  const name = className(notification.title);
  switch (notification.eventType) {
    case 'class.upcoming':
      return {
        title: name ? t('Clase próxima: {{name}}', { name }) : t('Clase próxima'),
        message: name
          ? t('Tu clase "{{name}}" comienza en 15 minutos.', { name })
          : t('Tu clase comienza en 15 minutos.'),
      };
    case 'class.not_started':
      return {
        title: name ? t('Clase no iniciada: {{name}}', { name }) : t('Clase no iniciada'),
        message: name
          ? t('Tu clase "{{name}}" programada todavía no fue iniciada.', { name })
          : t('La clase programada todavía no fue iniciada.'),
      };
    case 'recording.ready':
      return { title: t('Grabación lista'), message: t('La grabación solicitada ya está disponible.') };
    case 'recording.failed':
      return {
        title: t('Error al procesar la grabación'),
        message: t('No se pudo procesar la grabación solicitada.'),
      };
    case 'report.save_failed':
      return {
        title: t('No se pudo guardar el reporte'),
        message: t('El reporte sigue pendiente. Volvé a intentarlo desde el historial.'),
      };
    default:
      return { title: t(notification.title), message: t(notification.message) };
  }
}
