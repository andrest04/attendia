import { classNameFromStoredTitle, localizeNotificationCopy } from '../notificationCopy';

describe('localizeNotificationCopy', () => {
  const stored = {
    eventType: 'class.upcoming',
    title: 'Clase próxima: Álgebra II',
    message: 'Tu clase "Álgebra II" comienza en 15 minutos.',
  };

  it('keeps the stored Spanish copy when the language is not English', () => {
    expect(localizeNotificationCopy('es', stored)).toEqual({
      title: stored.title,
      message: stored.message,
    });
    expect(localizeNotificationCopy('es', { ...stored, eventType: 'recording.ready' }).title).toBe(stored.title);
  });

  it('returns English copy for a known event without rewriting an unknown type', () => {
    expect(localizeNotificationCopy('en', stored)).toEqual({
      title: 'Upcoming class: Álgebra II',
      message: 'Your class "Álgebra II" starts in 15 minutes.',
    });
    expect(
      localizeNotificationCopy('en', {
        eventType: 'recording.failed',
        title: 'Error al procesar la grabación',
        message: 'No se pudo procesar la grabación solicitada.',
      })
    ).toEqual({
      title: 'Recording processing error',
      message: 'The requested recording could not be processed.',
    });
    expect(localizeNotificationCopy('en', { eventType: 'other', title: 'Hola', message: 'Mundo' })).toEqual({
      title: 'Hola',
      message: 'Mundo',
    });
  });

  it('reads the class name only from the stored Spanish title prefix', () => {
    expect(classNameFromStoredTitle('Clase no iniciada: Grupo A')).toBe('Grupo A');
    expect(classNameFromStoredTitle('Clase próxima')).toBeNull();
    expect(classNameFromStoredTitle(undefined)).toBeNull();
  });
});
