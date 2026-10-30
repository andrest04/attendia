import React from 'react';
import { mount, shallow } from 'enzyme';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n/createI18n';
import { formatLongDate } from '../../i18n/format';
import CalendarTab from './CalendarTab';
import { buildCalendarDays, calendarSummary, mondayLeadingBlanks } from './calendarView';

const classes = [
  {
    id: 'class-1',
    title: 'Álgebra',
    roomName: 'algebra',
    scheduledAtMs: new Date(2026, 6, 8, 9, 0).getTime(),
    studentCount: 10,
    durationMinutes: 60,
    status: 'scheduled' as const,
  },
  {
    id: 'class-2',
    title: 'Física',
    roomName: 'fisica',
    scheduledAtMs: new Date(2026, 6, 8, 11, 0).getTime(),
    studentCount: 12,
    durationMinutes: 90,
    status: 'scheduled' as const,
  },
];

describe('calendarView', () => {
  const july = new Date(2026, 6, 1);

  it('builds a Monday-first month grid and orders scheduled classes by time', () => {
    const days = buildCalendarDays(classes, july);
    expect(mondayLeadingBlanks(july)).toBe(2);
    expect(days).toHaveLength(31);
    expect(days[7].classes.map(item => item.id)).toEqual(['class-1', 'class-2']);
  });

  it('summarizes real scheduled classes, including total hours from durationMinutes', () => {
    // 60min + 90min = 150min -> rounds to 3h.
    expect(calendarSummary(classes, july)).toEqual({ scheduledSessions: 2, expectedStudents: 22, classHours: '3h' });
  });
});

describe('CalendarTab', () => {
  // CalendarTab defaults its visible month to the real current date (see
  // useState(() => monthStart(new Date())) in CalendarTab.tsx). Pin "today" to the
  // fixture classes' month so the test doesn't silently rot once the real calendar
  // moves past July 2026.
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 8));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    ['es', '0 clases programadas', '1 clase programada', '2 clases programadas'],
    ['en', '0 classes scheduled', '1 class scheduled', '2 classes scheduled'],
  ])('names each day with its localized date and class count in %s', (language, zero, one, two) => {
    const singleClass = { ...classes[0], id: 'class-3', scheduledAtMs: new Date(2026, 6, 9, 9).getTime() };
    const wrapper = mount(
      <I18nextProvider i18n={createI18n({ detect: false, lng: language })}>
        <CalendarTab classes={[...classes, singleClass]} isLoading={false} error={null} onRetry={jest.fn()} onStartClass={jest.fn()} />
      </I18nextProvider>
    );
    [[7, zero], [9, one], [8, two]].forEach(([day, count]) => {
      const button = wrapper.find(`button[data-testid="dashboard-calendar-day-${day}"]`);
      expect(button.prop('aria-label')).toBe(`${formatLongDate(new Date(2026, 6, Number(day)), language)}, ${count}`);
    });
    wrapper.unmount();
  });

  it('renders real class cards and starts the selected persisted class', () => {
    const onStartClass = jest.fn();
    const wrapper = shallow(
      <CalendarTab classes={classes} isLoading={false} error={null} onRetry={jest.fn()} onStartClass={onStartClass} />
    );
    wrapper.find('[data-testid="dashboard-calendar-day-8"]').simulate('click');

    expect(wrapper.find('[data-testid="dashboard-calendar-session-class-1"]').exists()).toBe(true);
    wrapper.find('[data-testid="dashboard-calendar-start-class-1"]').simulate('click');
    expect(onStartClass).toHaveBeenCalledWith(classes[0]);
    expect(wrapper.find('[data-testid="dashboard-calendar-summary"]').text()).toContain('3h');
  });

  it('renders honest loading, error and unavailable states', () => {
    expect(
      shallow(<CalendarTab classes={[]} isLoading error={null} onRetry={jest.fn()} onStartClass={jest.fn()} />)
        .find('[data-testid="dashboard-calendar-loading"]')
        .exists()
    ).toBe(true);
    expect(
      shallow(<CalendarTab classes={[]} isLoading={false} error="falló" onRetry={jest.fn()} onStartClass={jest.fn()} />)
        .find('[data-testid="dashboard-calendar-error"]')
        .exists()
    ).toBe(true);
    expect(
      shallow(
        <CalendarTab classes={null} isLoading={false} error={null} onRetry={jest.fn()} onStartClass={jest.fn()} />
      )
        .find('[data-testid="dashboard-calendar-unavailable"]')
        .exists()
    ).toBe(true);
  });
});
