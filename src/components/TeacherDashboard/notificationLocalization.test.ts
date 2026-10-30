import i18n from '../../i18n';
import es from '../../i18n/locales/completeNotifications.es';
import en from '../../i18n/locales/completeNotifications.en';
import { TeacherNotification } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { localizeNotification } from './notificationLocalization';

const item = (eventType: TeacherNotification['eventType'], title: string, message: string): TeacherNotification => ({
  notificationId: 'id', ownerUid: 'owner', eventType, eventKey: 'key',
  source: { kind: 'class', classId: 'id' }, destination: { kind: 'classes' },
  eventOccurrenceAtMs: 0, createdAtMs: 0, readAtMs: null, title, message,
});

beforeAll(() => {
  i18n.addResourceBundle('es', 'completeNotifications', es);
  i18n.addResourceBundle('en', 'completeNotifications', en);
});

const translate = (notification: TeacherNotification, language: string) =>
  localizeNotification(notification, i18n.getFixedT(language, 'completeNotifications'));

test.each([
  ['recording.ready', 'Grabación lista', 'La grabación solicitada ya está disponible.', 'Recording ready', 'The requested recording is now available.'],
  ['recording.failed', 'Error al procesar la grabación', 'No se pudo procesar la grabación solicitada.', 'Recording processing failed', "The requested recording could not be processed."],
  ['report.save_failed', 'No se pudo guardar el reporte', 'El reporte sigue pendiente. Volvé a intentarlo desde el historial.', 'Report could not be saved', 'The report is still pending. Try again from history.'],
])('translates canonical %s', (type, title, message, englishTitle, englishMessage) => {
  const notification = item(type as TeacherNotification['eventType'], title, message);
  expect(translate(notification, 'es')).toEqual({ title, message });
  expect(translate(notification, 'en')).toEqual({ title: englishTitle, message: englishMessage });
});

test.each([
  ['class.upcoming', 'Clase próxima', 'Tu clase comienza en 15 minutos.', 'Upcoming class', 'Your class starts in 15 minutes.'],
  ['class.not_started', 'Clase no iniciada', 'La clase programada todavía no fue iniciada.', 'Class not started', 'The scheduled class has not started yet.'],
])('translates unnamed %s', (type, title, message, englishTitle, englishMessage) => {
  const notification = item(type as TeacherNotification['eventType'], title, message);
  expect(translate(notification, 'es')).toEqual({ title, message });
  expect(translate(notification, 'en')).toEqual({ title: englishTitle, message: englishMessage });
});

test('preserves a class name including quotes, markup and punctuation', () => {
  const name = 'Álgebra "A" <test>';
  const notification = item('class.upcoming', `Clase próxima: ${name}`, `Tu clase "${name}" comienza en 15 minutos.`);
  expect(translate(notification, 'en')).toEqual({ title: `Upcoming class: ${name}`, message: `Your class "${name}" starts in 15 minutes.` });
  expect(translate(notification, 'es')).toEqual({ title: notification.title, message: notification.message });
});

test('translates a named class that has not started', () => {
  const notification = item('class.not_started', 'Clase no iniciada: Arte', 'Tu clase "Arte" programada todavía no fue iniciada.');
  expect(translate(notification, 'en')).toEqual({ title: 'Class not started: Arte', message: 'Your scheduled class "Arte" has not started yet.' });
  expect(translate(notification, 'es')).toEqual({ title: notification.title, message: notification.message });
});

test('preserves unknown or noncanonical text rather than guessing', () => {
  const custom = item('class.upcoming', 'Custom title', 'Custom message');
  expect(translate(custom, 'en')).toEqual({ title: custom.title, message: custom.message });
  const inconsistent = item('class.upcoming', 'Clase próxima: A', 'Tu clase "B" comienza en 15 minutos.');
  expect(translate(inconsistent, 'en')).toEqual({ title: inconsistent.title, message: inconsistent.message });
  const unknown = { ...custom, eventType: 'future.event' } as unknown as TeacherNotification;
  expect(translate(unknown, 'en')).toEqual({ title: custom.title, message: custom.message });
});
