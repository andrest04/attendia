import React from 'react';
import { shallow } from 'enzyme';
import ClassesTab from './ClassesTab';
import { mockDashboardData } from './mockDashboardData';

describe('ClassesTab', () => {
  it('renders every stat card and upcoming session card', () => {
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
      />
    );

    mockDashboardData.stats.forEach(stat => {
      expect(wrapper.find(`[data-testid="dashboard-stat-${stat.id}"]`).exists()).toBe(true);
    });
    mockDashboardData.upcomingSessions.forEach(session => {
      expect(wrapper.find(`[data-testid="dashboard-session-card-${session.id}"]`).exists()).toBe(true);
    });
  });

  it('calls onStartClass with the slugified room name and suffixed teacher display name on the highlighted card', () => {
    const onStartClass = jest.fn();
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName="Prof. García"
        onStartClass={onStartClass}
      />
    );

    wrapper.find('[data-testid="dashboard-start-session-button"]').simulate('click');

    expect(onStartClass).toHaveBeenCalledWith({
      roomName: 'matematicas-grupo-a',
      name: 'Prof. García [Profesor]',
    });
  });

  it('renders only one wired "Iniciar sesión" button, and stub "Ver detalles" buttons for the rest when no onCancelClass is passed', () => {
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
      />
    );

    expect(wrapper.find('[data-testid="dashboard-start-session-button"]').length).toBe(1);
    expect(wrapper.find('[data-testid="dashboard-view-details-button"]').length).toBe(
      mockDashboardData.upcomingSessions.length - 1
    );
    expect(wrapper.find('[data-testid="dashboard-cancel-session-button"]').length).toBe(0);
  });

  it('renders "Cancelar" buttons instead of the stub, and calls onCancelClass with the session', () => {
    const onCancelClass = jest.fn();
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
        onCancelClass={onCancelClass}
      />
    );

    expect(wrapper.find('[data-testid="dashboard-view-details-button"]').length).toBe(0);
    const cancelButtons = wrapper.find('[data-testid="dashboard-cancel-session-button"]');
    expect(cancelButtons.length).toBe(mockDashboardData.upcomingSessions.length - 1);

    const nonHighlighted = mockDashboardData.upcomingSessions.find(s => !s.highlighted)!;
    cancelButtons.first().simulate('click');

    expect(onCancelClass).toHaveBeenCalledWith(nonHighlighted);
  });

  it('shows cancellation progress and a visible retry action after a failed cancellation', () => {
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
        onCancelClass={jest.fn()}
        cancellingClassId={mockDashboardData.upcomingSessions[1].id}
        cancelError="No pudimos cancelar la clase."
        onRetryCancel={jest.fn()}
      />
    );

    expect(
      wrapper
        .find('[data-testid="dashboard-cancel-session-button"]')
        .at(0)
        .prop('disabled')
    ).toBe(true);
    expect(wrapper.find('[data-testid="dashboard-cancel-error"]').text()).toContain('No pudimos cancelar la clase.');
    expect(wrapper.find('[data-testid="dashboard-retry-cancel-button"]').exists()).toBe(true);
  });

  it('does nothing when "Nueva clase" is clicked without onCreateClass', () => {
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
      />
    );

    wrapper.find('[data-testid="dashboard-new-class-button"]').simulate('click');
    wrapper.update();

    expect(wrapper.find('[data-testid="dashboard-new-class-title-input"]').exists()).toBe(false);
  });

  it('reveals the inline creation form and calls onCreateClass with the combined values', () => {
    const onCreateClass = jest.fn(() => Promise.resolve());
    const wrapper = shallow(
      <ClassesTab
        stats={mockDashboardData.stats}
        dateLabel={mockDashboardData.upcomingSessionsDateLabel}
        sessions={mockDashboardData.upcomingSessions}
        professorName={mockDashboardData.professorName}
        onStartClass={jest.fn()}
        onCreateClass={onCreateClass}
      />
    );

    wrapper.find('[data-testid="dashboard-new-class-button"]').simulate('click');
    wrapper.update();

    expect(wrapper.find('[data-testid="dashboard-new-class-title-input"]').exists()).toBe(true);

    wrapper
      .find('[data-testid="dashboard-new-class-title-input"]')
      .simulate('change', { target: { value: '  Física 101  ' } });
    // The date/time fields are @material-ui/pickers components whose onChange hands
    // back a Date directly (not a DOM change event) — mirror that contract here.
    wrapper.find('[data-testid="dashboard-new-class-date-input"]').simulate('change', new Date(2026, 6, 9));
    wrapper.find('[data-testid="dashboard-new-class-time-input"]').simulate('change', new Date(2026, 6, 9, 10, 0));
    wrapper
      .find('[data-testid="dashboard-new-class-student-count-input"]')
      .simulate('change', { target: { value: '15' } });

    wrapper.find('form').simulate('submit', { preventDefault: jest.fn() });

    expect(onCreateClass).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Física 101',
        scheduledAtMs: new Date(2026, 6, 9, 10, 0).getTime(),
        studentCount: 15,
        idempotencyKey: expect.any(String),
      })
    );
  });
});
