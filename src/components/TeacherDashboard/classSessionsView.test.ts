import { buildUpcomingSessions, findExpiredClasses } from './classSessionsView';
import { ClassRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';

const NOW_MS = new Date(2026, 6, 8, 10, 0, 0).getTime();

function makeClass(overrides: Partial<ClassRecord> = {}): ClassRecord {
  return {
    id: 'class-1',
    title: 'Matemáticas — Grupo A',
    roomName: 'matematicas-grupo-a',
    scheduledAtMs: NOW_MS,
    studentCount: 28,
    durationMinutes: 60,
    ...overrides,
  };
}

describe('buildUpcomingSessions', () => {
  it('returns an empty array for an empty input', () => {
    expect(buildUpcomingSessions([], NOW_MS)).toEqual([]);
  });

  it('sorts by scheduledAtMs ascending regardless of input order', () => {
    const later = makeClass({ id: 'later', scheduledAtMs: NOW_MS + 2 * 60 * 60 * 1000 });
    const earliest = makeClass({ id: 'earliest', scheduledAtMs: NOW_MS + 5 * 60 * 1000 });
    const middle = makeClass({ id: 'middle', scheduledAtMs: NOW_MS + 60 * 60 * 1000 });

    const result = buildUpcomingSessions([later, earliest, middle], NOW_MS);

    expect(result.map(s => s.id)).toEqual(['earliest', 'middle', 'later']);
  });

  it('drops a class more than the 15 minute grace period in the past', () => {
    const tooOld = makeClass({ id: 'too-old', scheduledAtMs: NOW_MS - 20 * 60 * 1000 });

    expect(buildUpcomingSessions([tooOld], NOW_MS)).toEqual([]);
  });

  it('keeps a class within the 15 minute grace period in the past', () => {
    const withinGrace = makeClass({ id: 'within-grace', scheduledAtMs: NOW_MS - 10 * 60 * 1000 });

    const result = buildUpcomingSessions([withinGrace], NOW_MS);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('within-grace');
  });

  it('highlights only the first (soonest) session when there are 3+ classes', () => {
    const first = makeClass({ id: 'first', scheduledAtMs: NOW_MS + 5 * 60 * 1000 });
    const second = makeClass({ id: 'second', scheduledAtMs: NOW_MS + 60 * 60 * 1000 });
    const third = makeClass({ id: 'third', scheduledAtMs: NOW_MS + 2 * 60 * 60 * 1000 });

    const result = buildUpcomingSessions([third, first, second], NOW_MS);

    expect(result.map(s => s.highlighted)).toEqual([true, false, false]);
  });

  it('maps id/title/code/studentCount from the class record', () => {
    const classRecord = makeClass({
      id: 'class-42',
      title: 'Cálculo III',
      roomName: 'calculo-iii',
      studentCount: 25,
      scheduledAtMs: NOW_MS + 5 * 60 * 1000,
    });

    const [session] = buildUpcomingSessions([classRecord], NOW_MS);

    expect(session.id).toBe('class-42');
    expect(session.title).toBe('Cálculo III');
    expect(session.code).toBe('calculo-iii');
    expect(session.studentCount).toBe(25);
  });

  it('formats the time as h:mm am/pm', () => {
    const morning = makeClass({ id: 'morning', scheduledAtMs: new Date(2026, 6, 8, 9, 5, 0).getTime() });
    const afternoon = makeClass({ id: 'afternoon', scheduledAtMs: new Date(2026, 6, 8, 15, 0, 0).getTime() });
    const noon = makeClass({ id: 'noon', scheduledAtMs: new Date(2026, 6, 8, 12, 0, 0).getTime() });

    const result = buildUpcomingSessions([morning, afternoon, noon], NOW_MS - 60 * 60 * 1000);
    const byId = Object.fromEntries(result.map(s => [s.id, s.time]));

    expect(byId.morning).toBe('9:05 am');
    expect(byId.afternoon).toBe('3:00 pm');
    expect(byId.noon).toBe('12:00 pm');
  });

  it('relativeLabel is "Ahora" and dayLabel is "Hoy" when the class is starting now', () => {
    const classRecord = makeClass({ scheduledAtMs: NOW_MS });

    const [session] = buildUpcomingSessions([classRecord], NOW_MS);

    expect(session.relativeLabel).toBe('Ahora');
    expect(session.dayLabel).toBe('Hoy');
  });

  it('relativeLabel is "En N min" for a class under an hour away, same day', () => {
    const classRecord = makeClass({ scheduledAtMs: NOW_MS + 30 * 60 * 1000 });

    const [session] = buildUpcomingSessions([classRecord], NOW_MS);

    expect(session.relativeLabel).toBe('En 30 min');
    expect(session.dayLabel).toBe('Hoy');
  });

  it('relativeLabel is "En Nh" for a class hours away, same calendar day', () => {
    const classRecord = makeClass({ scheduledAtMs: NOW_MS + 3 * 60 * 60 * 1000 });

    const [session] = buildUpcomingSessions([classRecord], NOW_MS);

    expect(session.relativeLabel).toBe('En 3h');
    expect(session.dayLabel).toBe('Hoy');
  });

  it('relativeLabel and dayLabel are both "Mañana" for a class on the next calendar day', () => {
    const classRecord = makeClass({ scheduledAtMs: new Date(2026, 6, 9, 10, 0, 0).getTime() });

    const [session] = buildUpcomingSessions([classRecord], NOW_MS);

    expect(session.relativeLabel).toBe('Mañana');
    expect(session.dayLabel).toBe('Mañana');
  });

  it('relativeLabel matches dayLabel (formatted date) for a class further out', () => {
    const scheduledAtMs = new Date(2026, 6, 15, 10, 0, 0).getTime();
    const classRecord = makeClass({ scheduledAtMs });
    const expectedLabel = new Date(scheduledAtMs).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

    const [session] = buildUpcomingSessions([classRecord], NOW_MS);

    expect(session.dayLabel).toBe(expectedLabel);
    expect(session.relativeLabel).toBe(expectedLabel);
  });
});

describe('findExpiredClasses', () => {
  it('returns an empty array for an empty input', () => {
    expect(findExpiredClasses([], NOW_MS)).toEqual([]);
  });

  it('excludes a scheduled class within the 15 minute grace period', () => {
    const withinGrace = makeClass({ id: 'within-grace', scheduledAtMs: NOW_MS - 10 * 60 * 1000 });

    expect(findExpiredClasses([withinGrace], NOW_MS)).toEqual([]);
  });

  it('includes a scheduled class past the 15 minute grace period', () => {
    const tooOld = makeClass({ id: 'too-old', scheduledAtMs: NOW_MS - 20 * 60 * 1000 });

    const result = findExpiredClasses([tooOld], NOW_MS);

    expect(result.map(c => c.id)).toEqual(['too-old']);
  });

  it('excludes a started class even past the grace period', () => {
    const started = makeClass({ id: 'started', scheduledAtMs: NOW_MS - 20 * 60 * 1000, status: 'started' });

    expect(findExpiredClasses([started], NOW_MS)).toEqual([]);
  });

  it('excludes a completed class even past the grace period', () => {
    const completed = makeClass({ id: 'completed', scheduledAtMs: NOW_MS - 20 * 60 * 1000, status: 'completed' });

    expect(findExpiredClasses([completed], NOW_MS)).toEqual([]);
  });

  it('excludes an upcoming class not yet due', () => {
    const upcoming = makeClass({ id: 'upcoming', scheduledAtMs: NOW_MS + 60 * 60 * 1000 });

    expect(findExpiredClasses([upcoming], NOW_MS)).toEqual([]);
  });
});
