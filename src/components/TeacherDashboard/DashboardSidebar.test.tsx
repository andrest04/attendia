import React from 'react';
import { shallow } from 'enzyme';
import DashboardSidebar from './DashboardSidebar';

describe('DashboardSidebar', () => {
  it('calls onTabChange with the clicked tab', () => {
    const onTabChange = jest.fn();
    const wrapper = shallow(
      <DashboardSidebar
        activeTab="clases"
        onTabChange={onTabChange}
        onStartBlankClass={jest.fn()}
        onSignOut={jest.fn()}
      />
    );

    wrapper.find('[data-testid="dashboard-sidebar-tab-historial"]').simulate('click');

    expect(onTabChange).toHaveBeenCalledWith('historial');
  });

  it('calls onStartBlankClass when "Iniciar clase" is clicked', () => {
    const onStartBlankClass = jest.fn();
    const wrapper = shallow(
      <DashboardSidebar
        activeTab="clases"
        onTabChange={jest.fn()}
        onStartBlankClass={onStartBlankClass}
        onSignOut={jest.fn()}
      />
    );

    wrapper.find('[data-testid="dashboard-sidebar-start-class"]').simulate('click');

    expect(onStartBlankClass).toHaveBeenCalled();
  });

  it('calls onSignOut when "Cerrar sesión" is clicked and it is available', () => {
    const onSignOut = jest.fn();
    const wrapper = shallow(
      <DashboardSidebar
        activeTab="clases"
        onTabChange={jest.fn()}
        onStartBlankClass={jest.fn()}
        onSignOut={onSignOut}
      />
    );

    const button = wrapper.find('[data-testid="dashboard-sidebar-sign-out"]');
    expect(button.prop('disabled')).toBe(false);
    button.simulate('click');

    expect(onSignOut).toHaveBeenCalled();
  });

  it('disables "Cerrar sesión" instead of silently no-oping when signOut is unavailable for this auth mode', () => {
    const wrapper = shallow(
      <DashboardSidebar activeTab="clases" onTabChange={jest.fn()} onStartBlankClass={jest.fn()} />
    );

    const button = wrapper.find('[data-testid="dashboard-sidebar-sign-out"]');
    expect(button.prop('disabled')).toBe(true);
    expect(button.prop('title')).toBeTruthy();
  });
});
