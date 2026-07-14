import React from 'react';
import { shallow } from 'enzyme';
import { Button, MenuItem } from '@material-ui/core';
import DashboardHeader from './DashboardHeader';

const push = jest.fn();
jest.mock('react-router-dom', () => ({ useHistory: () => ({ push }) }));

describe('DashboardHeader profile menu', () => {
  beforeEach(jest.clearAllMocks);

  it('opens an accessible menu and routes to the profile page', () => {
    const wrapper = shallow(<DashboardHeader professorName="Ana" professorInitials="A" />);
    const trigger = wrapper.find(Button).filter('[data-testid="dashboard-header-profile"]');

    expect(trigger.prop('aria-haspopup')).toBe('true');
    trigger.simulate('click', { currentTarget: document.createElement('button') });
    wrapper.update();
    expect(wrapper.find(MenuItem).text()).toBe('Perfil');

    wrapper.find(MenuItem).simulate('click');
    expect(push).toHaveBeenCalledWith('/profile');
  });

  it('renders the default (dashboard) behavior unmodified when no new props are passed', () => {
    const wrapper = shallow(<DashboardHeader professorName="Ana" professorInitials="A" />);

    expect(wrapper.find('button[aria-label="Ir al inicio"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="dashboard-header-notifications"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dashboard-header-profile"]').exists()).toBe(true);
  });
});

describe('DashboardHeader onLogoClick', () => {
  it('wraps the logo in a clickable "go home" button', () => {
    const onLogoClick = jest.fn();
    const wrapper = shallow(<DashboardHeader onLogoClick={onLogoClick} />);

    const logoButton = wrapper.find('button[aria-label="Ir al inicio"]');
    expect(logoButton.exists()).toBe(true);

    logoButton.simulate('click');
    expect(onLogoClick).toHaveBeenCalledTimes(1);
  });
});

describe('DashboardHeader showProfile / showNotifications', () => {
  it('hides the bell and the profile chip/menu when showProfile is false', () => {
    const wrapper = shallow(<DashboardHeader professorName="Ana" professorInitials="A" showProfile={false} />);

    expect(wrapper.find('[data-testid="dashboard-header-notifications"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="dashboard-header-profile"]').exists()).toBe(false);
  });

  it('hides just the bell when showNotifications is false', () => {
    const wrapper = shallow(
      <DashboardHeader professorName="Ana" professorInitials="A" showNotifications={false} />
    );

    expect(wrapper.find('[data-testid="dashboard-header-notifications"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="dashboard-header-profile"]').exists()).toBe(true);
  });
});

describe('DashboardHeader centerLabel / badge', () => {
  it('renders centerLabel and badge content', () => {
    const wrapper = shallow(
      <DashboardHeader
        professorName="Ana"
        professorInitials="A"
        centerLabel={<span data-testid="center-label-content">Clase: Foo</span>}
        badge={<span data-testid="badge-content">Pre-sesión</span>}
      />
    );

    expect(wrapper.find('[data-testid="center-label-content"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="badge-content"]').exists()).toBe(true);
  });
});

describe('DashboardHeader extraMenuItems', () => {
  it('renders additional MenuItems in the menu alongside "Perfil"', () => {
    const wrapper = shallow(
      <DashboardHeader
        professorName="Ana"
        professorInitials="A"
        extraMenuItems={<MenuItem data-testid="extra-item">Cerrar sesión</MenuItem>}
      />
    );

    expect(wrapper.find(MenuItem).exists()).toBe(true);
    expect(wrapper.find('[data-testid="extra-item"]').exists()).toBe(true);
  });
});
