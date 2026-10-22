import { createI18n } from '../../i18n/createI18n';
import { dashboardTabLabelKey } from './dashboardHelpers';
import { validateNewClass, NewClassFormValues } from './newClassValidation';
import { validateResourceFile } from './resourceUploadValidation';

const es = createI18n({ detect: false, lng: 'es' });
const en = createI18n({ detect: false, lng: 'en' });

const NOW = new Date(2026, 6, 8, 10, 0, 0).getTime();
const form = (overrides: Partial<NewClassFormValues> = {}): NewClassFormValues => ({
  title: 'Algebra',
  date: new Date(2026, 6, 9),
  time: new Date(2026, 0, 1, 15, 30),
  studentCount: '25',
  durationMinutes: '60',
  ...overrides,
});

describe('validateNewClass messages by language', () => {
  it.each([
    [{ title: ' ' }, 'Indica un título para la clase.', 'Enter a title for the class.'],
    [{ date: null }, 'Indica la fecha y la hora de la clase.', 'Enter the date and time of the class.'],
    [
      { studentCount: '-1' },
      'La cantidad de alumnos esperados no es válida.',
      'The expected number of students is not valid.',
    ],
    [{ durationMinutes: '0' }, 'La duración de la clase no es válida.', 'The class duration is not valid.'],
    [
      { date: new Date(2026, 6, 7) },
      'No puedes programar una clase en una fecha u hora pasada.',
      "You can't schedule a class in a past date or time.",
    ],
  ])('%j', (overrides, spanish, english) => {
    expect(validateNewClass(form(overrides), NOW, es.t)).toEqual({ ok: false, message: spanish });
    expect(validateNewClass(form(overrides), NOW, en.t)).toEqual({ ok: false, message: english });
  });

  it('defaults to Spanish when no translator is passed', () => {
    expect(validateNewClass(form({ title: '' }), NOW)).toEqual({
      ok: false,
      message: 'Indica un título para la clase.',
    });
  });
});

describe('validateResourceFile messages by language', () => {
  const file = (size: number, type: string) => {
    const value = new File(['x'], 'f', { type });
    Object.defineProperty(value, 'size', { value: size });
    return value;
  };

  it('translates the size and type errors and accepts supported files', () => {
    expect(validateResourceFile(file(26 * 1024 * 1024, 'application/pdf'), en.t)).toBe(
      'The file exceeds the maximum allowed size (25 MB).'
    );
    expect(validateResourceFile(file(10, 'image/png'), en.t)).toContain('Unsupported file type');
    expect(validateResourceFile(file(10, 'image/png'), es.t)).toContain('Tipo de archivo no admitido');
    expect(validateResourceFile(file(10, 'image/png'))).toContain('Tipo de archivo no admitido');
    expect(validateResourceFile(file(10, 'application/pdf'), en.t)).toBeNull();
  });
});

describe('dashboard tab labels', () => {
  it('resolves every tab key in both languages', () => {
    const tabs = Object.keys(dashboardTabLabelKey) as Array<keyof typeof dashboardTabLabelKey>;
    expect(tabs.map(tab => es.t(dashboardTabLabelKey[tab]))).toEqual(['Clases', 'Historial', 'Recursos', 'Calendario']);
    expect(tabs.map(tab => en.t(dashboardTabLabelKey[tab]))).toEqual(['Classes', 'History', 'Resources', 'Calendar']);
  });
});

describe('dashboard plural and context keys', () => {
  it.each([
    [1, 'No pudimos guardar un reporte al cerrar la clase. Todavía no se enviaron. Puedes reintentar ahora.'],
    [3, 'No pudimos guardar 3 reportes al cerrar la clase. Todavía no se enviaron. Puedes reintentar ahora.'],
  ])('pendingReports in Spanish with count %i', (count, expected) => {
    expect(es.t('dashboardShell:pendingReports', { count })).toBe(expected);
  });

  it.each([
    [1, "We couldn't save a report when the class ended. It hasn't been sent yet. You can retry now."],
    [2, "We couldn't save 2 reports when the class ended. They haven't been sent yet. You can retry now."],
  ])('pendingReports in English with count %i', (count, expected) => {
    expect(en.t('dashboardShell:pendingReports', { count })).toBe(expected);
  });

  it('agrees the expired-classes dialog with the count', () => {
    expect(es.t('dashboardShell:cancelExpiredDialog.message', { count: 1 })).toBe(
      '¿Cancelar la clase vencida? Esta acción no se puede deshacer.'
    );
    expect(es.t('dashboardShell:cancelExpiredDialog.message', { count: 4 })).toContain('las 4 clases vencidas');
    expect(en.t('dashboardShell:cancelExpiredDialog.message', { count: 1 })).toBe(
      'Cancel the expired class? This action cannot be undone.'
    );
    expect(en.t('dashboardShell:cancelExpiredDialog.message', { count: 4 })).toContain('the 4 expired classes');
  });

  it('agrees the failure counters', () => {
    expect(en.t('dashboardShell:classes.cancelExpiredFailed', { count: 1 })).toBe(
      "We couldn't cancel 1 expired class."
    );
    expect(en.t('dashboardShell:classes.cancelExpiredFailed', { count: 2 })).toBe(
      "We couldn't cancel 2 expired classes."
    );
    expect(es.t('dashboardShell:upload.deleteResourcesFailed', { count: 1 })).toBe('No pudimos eliminar 1 recurso.');
    expect(es.t('dashboardShell:upload.deleteResourcesFailed', { count: 3 })).toBe('No pudimos eliminar 3 recursos.');
    expect(en.t('dashboardShell:upload.deleteResourcesFailed', { count: 3 })).toBe("We couldn't delete 3 resources.");
  });

  it('picks the profile title by role context', () => {
    expect(es.t('teacherProfile:title', { context: 'student' })).toBe('Perfil estudiante');
    expect(es.t('teacherProfile:title', { context: 'teacher' })).toBe('Perfil docente');
    expect(en.t('teacherProfile:title', { context: 'student' })).toBe('Student profile');
    expect(en.t('teacherProfile:title', { context: 'teacher' })).toBe('Teacher profile');
  });
});
