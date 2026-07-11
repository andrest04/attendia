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

  it('renders only one wired "Iniciar sesión" button, and stub "Ver detalles" buttons for the rest', () => {
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
  });
});
