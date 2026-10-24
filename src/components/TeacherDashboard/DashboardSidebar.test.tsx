import React from 'react';
import { mount, shallow } from 'enzyme';
import DashboardSidebar from './DashboardSidebar';
import { setLocale } from '../../i18n/locale';

describe('DashboardSidebar', () => {
  afterEach(() => setLocale('es'));

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

  it('translates the start-class button to English', () => {
    setLocale('en');
    const wrapper = shallow(
      <DashboardSidebar
        activeTab="clases"
        onTabChange={jest.fn()}
        onStartBlankClass={jest.fn()}
        onSignOut={jest.fn()}
      />
    );

    expect(wrapper.find('[data-testid="dashboard-sidebar-start-class"]').text()).toContain('Start class');
  });

  it('translates every tab label to English, Calendario included', () => {
    setLocale('en');
    const wrapper = shallow(
      <DashboardSidebar
        activeTab="clases"
        onTabChange={jest.fn()}
        onStartBlankClass={jest.fn()}
        onSignOut={jest.fn()}
      />
    );

    const labels = ['clases', 'historial', 'recursos', 'calendario'].map(tab =>
      wrapper.find(`[data-testid="dashboard-sidebar-tab-${tab}"]`).text()
    );
    expect(labels).toEqual(['Classes', 'History', 'Resources', 'Calendar']);
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

  it('switches to a compact horizontal navigation below the desktop breakpoint', () => {
    const wrapper = mount(
      <DashboardSidebar
        activeTab="clases"
        onTabChange={jest.fn()}
        onStartBlankClass={jest.fn()}
        onSignOut={jest.fn()}
      />
    );
    const rootClass = String(wrapper.find('[data-testid="dashboard-sidebar"]').prop('className') || '').split(' ')[0];
    const generatedStyles = Array.from(document.head.querySelectorAll('style'))
      .map(style => style.textContent)
      .join('\n');

    expect(generatedStyles).toMatch(
      new RegExp(
        `@media \\(max-width:959.95px\\)\\s*\\{\\s*\\.${rootClass}\\s*\\{[^}]*width:\\s*100%;[^}]*flex-direction:\\s*row`
      )
    );
  });
});
