import { createI18n } from './createI18n';

const es = createI18n({ detect: false, lng: 'es' });
const en = createI18n({ detect: false, lng: 'en' });

describe('in-room plural keys', () => {
  it.each([
    [0, '0 estudiantes', '0 students'],
    [1, '1 estudiante', '1 student'],
    [2, '2 estudiantes', '2 students'],
  ])('statusBar.students with count %i', (count, spanish, english) => {
    expect(es.t('room:statusBar.students', { count })).toBe(spanish);
    expect(en.t('room:statusBar.students', { count })).toBe(english);
  });

  it.each([
    [1, '1 participante', '1 participant'],
    [3, '3 participantes', '3 participants'],
  ])('menuBar.participants with count %i', (count, spanish, english) => {
    expect(es.t('toolbar:menuBar.participants', { count })).toBe(spanish);
    expect(en.t('toolbar:menuBar.participants', { count })).toBe(english);
  });

  it('participants.inRoom keeps the count in both languages', () => {
    expect(es.t('room:participants.inRoom', { count: 4 })).toBe('4 en sala');
    expect(en.t('room:participants.inRoom', { count: 4 })).toBe('4 in the room');
  });
});
