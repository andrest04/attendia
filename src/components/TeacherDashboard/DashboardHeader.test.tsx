import React from 'react';
import { shallow } from 'enzyme';
import DashboardHeader from './DashboardHeader';

describe('DashboardHeader', () => {
  it('renders the professor name and initials avatar when no photo is provided', () => {
    const wrapper = shallow(<DashboardHeader professorName="Andrés Torres" professorInitials="AT" />);

    expect(wrapper.find('[data-testid="dashboard-header-avatar-initials"]').text()).toBe('AT');
    expect(wrapper.find('[data-testid="dashboard-header-avatar-photo"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Andrés Torres');
  });

  it('renders the real photo instead of the initials chip when professorPhotoURL is provided', () => {
    const wrapper = shallow(
      <DashboardHeader
        professorName="Andrés Torres"
        professorInitials="AT"
        professorPhotoURL="https://example.com/photo.jpg"
      />
    );

    const photo = wrapper.find('[data-testid="dashboard-header-avatar-photo"]');
    expect(photo.exists()).toBe(true);
    expect(photo.prop('style')).toEqual({ backgroundImage: 'url(https://example.com/photo.jpg)' });
    expect(wrapper.find('[data-testid="dashboard-header-avatar-initials"]').exists()).toBe(false);
  });
});
