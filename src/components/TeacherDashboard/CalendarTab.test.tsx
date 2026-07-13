import React from 'react';
import { shallow } from 'enzyme';
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
