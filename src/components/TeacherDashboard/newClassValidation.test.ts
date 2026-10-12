import { NewClassFormValues, validateNewClass } from './newClassValidation';

const NOW = new Date(2026, 6, 8, 10, 0, 0).getTime();

const form = (overrides: Partial<NewClassFormValues> = {}): NewClassFormValues => ({
  title: 'Álgebra Lineal',
  date: new Date(2026, 6, 9),
  time: new Date(2026, 0, 1, 15, 30),
  studentCount: '25',
  durationMinutes: '60',
  ...overrides,
});

describe('validateNewClass', () => {
  it('accepts a complete future class and builds its input', () => {
    const result = validateNewClass(form(), NOW);

    expect(result).toEqual({
      ok: true,
      value: {
        title: 'Álgebra Lineal',
        roomName: 'algebra-lineal',
        scheduledAtMs: new Date(2026, 6, 9, 15, 30).getTime(),
        studentCount: 25,
        durationMinutes: 60,
      },
    });
  });

  it('takes the day from the date and the time of day from the time', () => {
    const result = validateNewClass(
      form({ date: new Date(2026, 7, 1, 23, 59), time: new Date(1999, 5, 5, 8, 15) }),
      NOW
    );

    expect(result.ok && result.value.scheduledAtMs).toBe(new Date(2026, 7, 1, 8, 15).getTime());
  });

  it('trims the title', () => {
    const result = validateNewClass(form({ title: '  Física  ' }), NOW);

    expect(result.ok && result.value.title).toBe('Física');
  });

  it.each([
    ['an empty title', { title: '' }, 'Indica un título para la clase.'],
    ['a blank title', { title: '   ' }, 'Indica un título para la clase.'],
    ['no date', { date: null }, 'Indica la fecha y la hora de la clase.'],
    ['no time', { time: null }, 'Indica la fecha y la hora de la clase.'],
    ['an invalid date', { date: new Date('nope') }, 'Indica la fecha y la hora de la clase.'],
    ['an invalid time', { time: new Date('nope') }, 'Indica la fecha y la hora de la clase.'],
    ['a negative student count', { studentCount: '-1' }, 'La cantidad de alumnos esperados no es válida.'],
    ['a non-numeric student count', { studentCount: 'muchos' }, 'La cantidad de alumnos esperados no es válida.'],
    ['a zero duration', { durationMinutes: '0' }, 'La duración de la clase no es válida.'],
    ['a fractional duration', { durationMinutes: '45.5' }, 'La duración de la clase no es válida.'],
    ['a non-numeric duration', { durationMinutes: 'una hora' }, 'La duración de la clase no es válida.'],
    [
      'a class in the past',
      { date: new Date(2026, 6, 7) },
      'No puedes programar una clase en una fecha u hora pasada.',
    ],
  ])('rejects %s', (_, overrides, message) => {
    expect(validateNewClass(form(overrides), NOW)).toEqual({ ok: false, message });
  });

  it('accepts zero expected students', () => {
    expect(validateNewClass(form({ studentCount: '0' }), NOW).ok).toBe(true);
  });

  it('accepts a class scheduled for exactly now', () => {
    const exactlyNow = form({ date: new Date(NOW), time: new Date(NOW) });

    expect(validateNewClass(exactlyNow, NOW).ok).toBe(true);
  });

  it('reports the first problem in form order when several are wrong', () => {
    const everythingWrong = form({ title: '', date: null, studentCount: '-5', durationMinutes: '0' });

    expect(validateNewClass(everythingWrong, NOW)).toEqual({ ok: false, message: 'Indica un título para la clase.' });
    expect(validateNewClass({ ...everythingWrong, title: 'ok' }, NOW)).toEqual({
      ok: false,
      message: 'Indica la fecha y la hora de la clase.',
    });
    expect(validateNewClass({ ...everythingWrong, title: 'ok', date: new Date(2026, 6, 9) }, NOW)).toEqual({
      ok: false,
      message: 'La cantidad de alumnos esperados no es válida.',
    });
  });
});
