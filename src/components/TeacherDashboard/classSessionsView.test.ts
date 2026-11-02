import {
  buildExpiredSessions,
  buildFinishedSessions,
  buildInProgressSessions,
  buildMockClassesView,
  buildRealClassesView,
  buildUpcomingSessions,
  findDuplicateScheduledClass,
  findExpiredClasses,
  MAX_FINISHED_SESSIONS,
} from './classSessionsView';
import { createI18n } from '../../i18n/createI18n';
import { mockDashboardData } from './mockDashboardData';
import { ClassRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { setLocale } from '../../i18n/locale';

const NOW_MS = new Date(2026, 6, 8, 10, 0, 0).getTime();

beforeEach(() => setLocale('es'));

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
  it('leaves started classes out and highlights the first remaining class', () => {
    const started = makeClass({ id: 'started', status: 'started', scheduledAtMs: NOW_MS });
    const next = makeClass({ id: 'next', status: 'scheduled', scheduledAtMs: NOW_MS + 60 * 60 * 1000 });
    const later = makeClass({ id: 'later', status: 'scheduled', scheduledAtMs: NOW_MS + 2 * 60 * 60 * 1000 });

    const result = buildUpcomingSessions([started, next, later], NOW_MS);

    expect(result.map(session => [session.id, session.highlighted])).toEqual([
      ['next', true],
      ['later', false],
    ]);
  });

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

describe('buildExpiredSessions', () => {
  it('returns an empty array for an empty input', () => {
    expect(buildExpiredSessions([], NOW_MS)).toEqual([]);
  });

  it('excludes upcoming, started, and completed classes', () => {
    const upcoming = makeClass({ id: 'upcoming', scheduledAtMs: NOW_MS + 60 * 60 * 1000 });
    const started = makeClass({ id: 'started', scheduledAtMs: NOW_MS - 20 * 60 * 1000, status: 'started' });
    const completed = makeClass({ id: 'completed', scheduledAtMs: NOW_MS - 20 * 60 * 1000, status: 'completed' });

    expect(buildExpiredSessions([upcoming, started, completed], NOW_MS)).toEqual([]);
  });

  it('sorts by scheduledAtMs ascending (most overdue first), never highlights, and maps the same fields', () => {
    const recent = makeClass({
      id: 'recent',
      title: 'Historia',
      roomName: 'historia',
      studentCount: 12,
      scheduledAtMs: NOW_MS - 20 * 60 * 1000,
    });
    const oldest = makeClass({ id: 'oldest', scheduledAtMs: NOW_MS - 2 * 24 * 60 * 60 * 1000 });

    const result = buildExpiredSessions([recent, oldest], NOW_MS);

    expect(result.map(s => s.id)).toEqual(['oldest', 'recent']);
    expect(result.every(s => s.highlighted === false)).toBe(true);
    const historia = result.find(s => s.id === 'recent')!;
    expect(historia.title).toBe('Historia');
    expect(historia.code).toBe('historia');
    expect(historia.studentCount).toBe(12);
  });

  it('formats relativeLabel in minutes, hours, and days overdue', () => {
    const minutesAgo = makeClass({ id: 'minutes-ago', scheduledAtMs: NOW_MS - 20 * 60 * 1000 });
    const hoursAgo = makeClass({ id: 'hours-ago', scheduledAtMs: NOW_MS - 5 * 60 * 60 * 1000 });
    const daysAgo = makeClass({ id: 'days-ago', scheduledAtMs: NOW_MS - 3 * 24 * 60 * 60 * 1000 });

    const result = buildExpiredSessions([minutesAgo, hoursAgo, daysAgo], NOW_MS);
    const byId = Object.fromEntries(result.map(s => [s.id, s.relativeLabel]));

    expect(byId['minutes-ago']).toBe('Venció hace 20 min');
    expect(byId['hours-ago']).toBe('Venció hace 5h');
    expect(byId['days-ago']).toBe('Venció hace 3d');
  });

  describe('in English', () => {
    beforeEach(() => setLocale('en'));
    afterEach(() => setLocale('es'));

    it('translates the overdue labels', () => {
      const minutesAgo = makeClass({ id: 'minutes-ago', scheduledAtMs: NOW_MS - 20 * 60 * 1000 });
      const hoursAgo = makeClass({ id: 'hours-ago', scheduledAtMs: NOW_MS - 5 * 60 * 60 * 1000 });
      const daysAgo = makeClass({ id: 'days-ago', scheduledAtMs: NOW_MS - 3 * 24 * 60 * 60 * 1000 });

      const result = buildExpiredSessions([minutesAgo, hoursAgo, daysAgo], NOW_MS);
      const byId = Object.fromEntries(result.map(s => [s.id, s.relativeLabel]));

      expect(byId['minutes-ago']).toBe('Overdue by 20 min');
      expect(byId['hours-ago']).toBe('Overdue by 5h');
      expect(byId['days-ago']).toBe('Overdue by 3d');
    });

    it('translates the upcoming relative labels', () => {
      const soon = makeClass({ id: 'soon', scheduledAtMs: NOW_MS + 5 * 60 * 1000 });
      const later = makeClass({ id: 'later', scheduledAtMs: NOW_MS + 2 * 60 * 60 * 1000 });

      const byId = Object.fromEntries(buildUpcomingSessions([soon, later], NOW_MS).map(s => [s.id, s.relativeLabel]));

      expect(byId['soon']).toBe('In 5 min');
      expect(byId['later']).toBe('In 2h');
    });

    it('formats a far-away day label with the English locale', () => {
      const scheduledAtMs = NOW_MS + 10 * 24 * 60 * 60 * 1000;
      const [session] = buildUpcomingSessions([makeClass({ id: 'far', scheduledAtMs })], NOW_MS);

      expect(session.dayLabel).toBe(
        new Date(scheduledAtMs).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
      );
    });
  });
});

describe('buildRealClassesView', () => {
  it('derives every list from the same classes and clock', () => {
    const upcoming = makeClass({ id: 'up', scheduledAtMs: NOW_MS + 60 * 60 * 1000 });
    const expired = makeClass({ id: 'old', scheduledAtMs: NOW_MS - 5 * 60 * 60 * 1000 });

    const view = buildRealClassesView([upcoming, expired], NOW_MS);

    expect(view.sessions.map(s => s.id)).toEqual(['up']);
    expect(view.expiredSessions.map(s => s.id)).toEqual(['old']);
    expect(view.expiredClasses.map(c => c.id)).toEqual(['old']);
  });

  it('labels the date of the injected clock with a capitalized weekday', () => {
    const { dateLabel } = buildRealClassesView([], NOW_MS);

    expect(dateLabel).toMatch(/^[A-ZÁÉÍÓÚ]/);
    expect(dateLabel).toContain('2026');
  });

  it('formats the date label with the English locale when English is selected', () => {
    const spanish = buildRealClassesView([], NOW_MS).dateLabel;
    setLocale('en');
    try {
      const english = buildRealClassesView([], NOW_MS).dateLabel;
      expect(english).toBe(
        new Date(NOW_MS).toLocaleDateString('en-US', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      );
      expect(english).not.toBe(spanish);
    } finally {
      setLocale('es');
    }
  });

  it('is empty for no classes', () => {
    const view = buildRealClassesView([], NOW_MS);

    expect(view.sessions).toEqual([]);
    expect(view.expiredSessions).toEqual([]);
    expect(view.expiredClasses).toEqual([]);
  });
});

describe('buildMockClassesView', () => {
  it('passes the mock sessions and label through with nothing expired', () => {
    const view = buildMockClassesView(mockDashboardData);

    expect(view.sessions).toBe(mockDashboardData.upcomingSessions);
    expect(view.dateLabel).toBe(mockDashboardData.upcomingSessionsDateLabel);
    expect(view.expiredSessions).toEqual([]);
    expect(view.expiredClasses).toEqual([]);
  });
});

describe('classSessionsView in English', () => {
  const i18n = createI18n({ detect: false, lng: 'en' });
  const en = { t: i18n.t.bind(i18n), language: 'en' };

  it('labels upcoming sessions in English', () => {
    const soon = makeClass({ id: 'soon', scheduledAtMs: NOW_MS + 5 * 60 * 1000 });
    const hours = makeClass({ id: 'hours', scheduledAtMs: NOW_MS + 3 * 60 * 60 * 1000 });
    const tomorrow = makeClass({ id: 'tomorrow', scheduledAtMs: new Date(2026, 6, 9, 15, 30).getTime() });
    const later = makeClass({ id: 'later', scheduledAtMs: new Date(2026, 6, 20, 9, 0).getTime() });

    const [a, b, c, d] = buildUpcomingSessions([soon, hours, tomorrow, later], NOW_MS, en);

    expect(a.relativeLabel).toBe('In 5 min');
    expect(a.dayLabel).toBe('Today');
    expect(a.time).toMatch(/^10:05\sAM$/);
    expect(b.relativeLabel).toBe('In 3h');
    expect(c.relativeLabel).toBe('Tomorrow');
    expect(c.dayLabel).toBe('Tomorrow');
    expect(d.dayLabel).toBe('Jul 20');
  });

  it('labels expired sessions and the date in English', () => {
    const old = makeClass({ scheduledAtMs: NOW_MS - 3 * 24 * 60 * 60 * 1000 });

    expect(buildExpiredSessions([old], NOW_MS, en)[0].relativeLabel).toBe('Expired 3d ago');
    expect(buildRealClassesView([], NOW_MS, en).dateLabel).toBe('Wednesday, July 8, 2026');
    expect(buildRealClassesView([], NOW_MS).dateLabel).toBe('Miércoles, 8 de julio de 2026');
  });
});

describe('started class sections', () => {
  const started = (overrides: Partial<ClassRecord>) => makeClass({ status: 'started', ...overrides });
  const idsOf = (sessions: { id: string }[]) => sessions.map(session => session.id);

  describe('buildInProgressSessions', () => {
    it('builds an in-progress card with the label the caller passes', () => {
      const record = started({
        id: 'old',
        roomName: 'algebra',
        title: 'Álgebra',
        scheduledAtMs: null,
        studentCount: 12,
      });

      expect(buildInProgressSessions([record], { algebra: true }, 'En curso')).toEqual([
        {
          id: 'old',
          title: 'Álgebra',
          code: 'algebra',
          roomName: 'algebra',
          classId: 'old',
          studentCount: 12,
          time: '',
          dayLabel: 'En curso',
          relativeLabel: '',
          highlighted: false,
        },
      ]);
    });

    it('ignores classes that are not started', () => {
      const records = [
        makeClass({ id: 'scheduled', status: 'scheduled', roomName: 'a' }),
        makeClass({ id: 'completed', status: 'completed', roomName: 'b' }),
        makeClass({ id: 'no-status', roomName: 'c' }),
      ];

      expect(buildInProgressSessions(records, { a: true, b: true, c: true }, 'En curso')).toEqual([]);
    });

    it('keeps rooms that are open, not yet probed or inconclusive, and drops confirmed closed ones', () => {
      const records = [
        started({ id: 'open', roomName: 'open' }),
        started({ id: 'unprobed', roomName: 'unprobed' }),
        started({ id: 'inconclusive', roomName: 'inconclusive' }),
        started({ id: 'closed', roomName: 'closed' }),
      ];
      const status = { open: true, inconclusive: null, closed: false };

      expect(idsOf(buildInProgressSessions(records, status, 'En curso'))).toEqual(['open', 'unprobed', 'inconclusive']);
    });

    it('is not hidden by a scheduled class that shares the room', () => {
      const scheduled = makeClass({ id: 'scheduled', status: 'scheduled', roomName: 'algebra' });
      const running = started({ id: 'running', roomName: 'algebra' });

      expect(idsOf(buildInProgressSessions([scheduled, running], { algebra: true }, 'En curso'))).toEqual(['running']);
    });

    it('leaves scheduled classes that share a room as separate upcoming cards', () => {
      const morning = makeClass({ id: 'morning', roomName: 'algebra', scheduledAtMs: NOW_MS + 60 * 60 * 1000 });
      const evening = makeClass({ id: 'evening', roomName: 'algebra', scheduledAtMs: NOW_MS + 5 * 60 * 60 * 1000 });

      expect(idsOf(buildUpcomingSessions([morning, evening], NOW_MS))).toEqual(['morning', 'evening']);
    });

    it('lists a room once, keeping the most recently scheduled record', () => {
      const older = started({ id: 'older', roomName: 'algebra', scheduledAtMs: NOW_MS - 2000 });
      const newer = started({ id: 'newer', roomName: 'algebra', scheduledAtMs: NOW_MS - 1000 });

      expect(idsOf(buildInProgressSessions([older, newer], {}, 'En curso'))).toEqual(['newer']);
      expect(idsOf(buildInProgressSessions([newer, older], {}, 'En curso'))).toEqual(['newer']);
    });

    it('prefers a scheduled record over one without a date', () => {
      const undated = started({ id: 'undated', roomName: 'algebra', scheduledAtMs: null });
      const dated = started({ id: 'dated', roomName: 'algebra', scheduledAtMs: NOW_MS - 1000 });

      expect(idsOf(buildInProgressSessions([dated, undated], {}, 'En curso'))).toEqual(['dated']);
      expect(idsOf(buildInProgressSessions([undated, dated], {}, 'En curso'))).toEqual(['dated']);
    });

    it('breaks a schedule tie by the greatest id, whatever the input order', () => {
      const a = started({ id: 'a', roomName: 'algebra', scheduledAtMs: null });
      const b = started({ id: 'b', roomName: 'algebra', scheduledAtMs: null });

      expect(idsOf(buildInProgressSessions([a, b], {}, 'En curso'))).toEqual(['b']);
      expect(idsOf(buildInProgressSessions([b, a], {}, 'En curso'))).toEqual(['b']);
    });

    it('keeps one card per distinct room', () => {
      const algebra = started({ id: 'algebra', roomName: 'algebra', scheduledAtMs: null });
      const physics = started({ id: 'physics', roomName: 'physics', scheduledAtMs: null });

      expect(idsOf(buildInProgressSessions([algebra, physics], {}, 'En curso'))).toEqual(['algebra', 'physics']);
    });
  });

  describe('buildFinishedSessions', () => {
    it('lists only started classes whose room is confirmed closed', () => {
      const records = [
        started({ id: 'closed', roomName: 'closed' }),
        started({ id: 'open', roomName: 'open' }),
        started({ id: 'unprobed', roomName: 'unprobed' }),
        started({ id: 'inconclusive', roomName: 'inconclusive' }),
      ];
      const status = { closed: false, open: true, inconclusive: null };

      expect(idsOf(buildFinishedSessions(records, status, 'Finalizadas'))).toEqual(['closed']);
    });

    it('leaves out scheduled and completed classes even when their room is closed', () => {
      const records = [
        makeClass({ id: 'scheduled', status: 'scheduled', roomName: 'a' }),
        makeClass({ id: 'completed', status: 'completed', roomName: 'b' }),
      ];

      expect(buildFinishedSessions(records, { a: false, b: false }, 'Finalizadas')).toEqual([]);
    });

    it('lists a room once with the same tie-break as the in-progress section', () => {
      const older = started({ id: 'older', roomName: 'algebra', scheduledAtMs: NOW_MS - 2000 });
      const newer = started({ id: 'newer', roomName: 'algebra', scheduledAtMs: NOW_MS - 1000 });

      expect(idsOf(buildFinishedSessions([newer, older], { algebra: false }, 'Finalizadas'))).toEqual(['newer']);
      expect(idsOf(buildFinishedSessions([older, newer], { algebra: false }, 'Finalizadas'))).toEqual(['newer']);
    });

    it('sorts the most recent first and an undated class last', () => {
      const undated = started({ id: 'undated', roomName: 'a', scheduledAtMs: null });
      const older = started({ id: 'older', roomName: 'b', scheduledAtMs: NOW_MS - 2000 });
      const newer = started({ id: 'newer', roomName: 'c', scheduledAtMs: NOW_MS - 1000 });
      const status = { a: false, b: false, c: false };

      expect(idsOf(buildFinishedSessions([undated, older, newer], status, 'Finalizadas'))).toEqual([
        'newer',
        'older',
        'undated',
      ]);
    });

    it('keeps only the most recent cards up to the limit', () => {
      const count = MAX_FINISHED_SESSIONS + 2;
      const records = Array.from({ length: count }, (_, index) =>
        started({ id: `c${index}`, roomName: `room-${index}`, scheduledAtMs: NOW_MS - index * 1000 })
      );
      const status = Object.fromEntries(records.map(record => [record.roomName, false]));

      const result = buildFinishedSessions(records, status, 'Finalizadas');

      expect(MAX_FINISHED_SESSIONS).toBe(6);
      expect(idsOf(result)).toEqual(idsOf(records.slice(0, MAX_FINISHED_SESSIONS)));
    });
  });

  describe('findDuplicateScheduledClass', () => {
    it('finds a scheduled class with the same title, ignoring case and surrounding spaces', () => {
      const record = makeClass({ id: 'mate', title: 'Mate', status: 'scheduled' });

      expect(findDuplicateScheduledClass([record], '  mATE ')).toBe(record);
    });

    it('ignores started and completed classes', () => {
      const records = [
        makeClass({ id: 'started', title: 'Mate', status: 'started' }),
        makeClass({ id: 'completed', title: 'Mate', status: 'completed' }),
      ];

      expect(findDuplicateScheduledClass(records, 'Mate')).toBeUndefined();
    });

    it('finds nothing for a blank title', () => {
      const record = makeClass({ title: ' ', status: 'scheduled' });

      expect(findDuplicateScheduledClass([record], '   ')).toBeUndefined();
    });
  });
});
