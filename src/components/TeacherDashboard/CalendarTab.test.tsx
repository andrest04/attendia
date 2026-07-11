import React from 'react';
import { shallow } from 'enzyme';
import CalendarTab from './CalendarTab';
import { mockDashboardData } from './mockDashboardData';

describe('CalendarTab', () => {
  it('aligns July 1st (a Wednesday) with two leading blank cells for L/M', () => {
    const wrapper = shallow(
      <CalendarTab
        monthLabel={mockDashboardData.calendarMonthLabel}
        days={mockDashboardData.calendarDays}
        selectedDay={mockDashboardData.selectedDay}
        sessionsForSelectedDay={mockDashboardData.calendarSessionsForSelectedDay}
        summary={mockDashboardData.calendarSummary}
      />
    );

    const grid = wrapper.find('[data-testid="dashboard-calendar-grid"]');
    // 2 leading blanks (Mon, Tue) + 31 days.
    expect(grid.children().length).toBe(2 + 31);
    expect(wrapper.find('[data-testid="dashboard-calendar-day-1"]').exists()).toBe(true);
  });

  it('renders the correct dot count per day from mock data', () => {
    const wrapper = shallow(
      <CalendarTab
        monthLabel={mockDashboardData.calendarMonthLabel}
        days={mockDashboardData.calendarDays}
        selectedDay={mockDashboardData.selectedDay}
        sessionsForSelectedDay={mockDashboardData.calendarSessionsForSelectedDay}
        summary={mockDashboardData.calendarSummary}
      />
    );

    expect(wrapper.find('[data-testid="dashboard-calendar-day-8"]').prop('data-session-count')).toBe(2);
    expect(wrapper.find('[data-testid="dashboard-calendar-day-8-dot"]').length).toBe(2);
    expect(wrapper.find('[data-testid="dashboard-calendar-day-1-dot"]').length).toBe(1);
    expect(wrapper.find('[data-testid="dashboard-calendar-day-2-dot"]').length).toBe(0);
  });

  it('highlights the selected day and shows its session cards', () => {
    const wrapper = shallow(
      <CalendarTab
        monthLabel={mockDashboardData.calendarMonthLabel}
        days={mockDashboardData.calendarDays}
        selectedDay={8}
        sessionsForSelectedDay={mockDashboardData.calendarSessionsForSelectedDay}
        summary={mockDashboardData.calendarSummary}
      />
    );

    expect(wrapper.find('[data-testid="dashboard-calendar-session-cal-session-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dashboard-calendar-session-cal-session-2"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('8 de julio');
  });

  it('renders the JULIO · RESUMEN summary card values', () => {
    const wrapper = shallow(
      <CalendarTab
        monthLabel={mockDashboardData.calendarMonthLabel}
        days={mockDashboardData.calendarDays}
        selectedDay={mockDashboardData.selectedDay}
        sessionsForSelectedDay={mockDashboardData.calendarSessionsForSelectedDay}
        summary={mockDashboardData.calendarSummary}
      />
    );

    const summary = wrapper.find('[data-testid="dashboard-calendar-summary"]');
    expect(summary.text()).toContain('18');
    expect(summary.text()).toContain('115');
    expect(summary.text()).toContain('22h');
  });
});
