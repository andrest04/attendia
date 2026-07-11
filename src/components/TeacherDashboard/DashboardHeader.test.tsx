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
});
