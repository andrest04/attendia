import React from 'react';
import { shallow } from 'enzyme';
import SchoolIcon from '@material-ui/icons/School';
import RoleBadge from './RoleBadge';

describe('the RoleBadge component', () => {
  it('renders the "Profesor" label with a graduation-cap icon', () => {
    const wrapper = shallow(<RoleBadge />);
    expect(wrapper.text()).toContain('Profesor');
    expect(wrapper.find(SchoolIcon).exists()).toBe(true);
  });

  it('exposes a stable test id for consumers', () => {
    const wrapper = shallow(<RoleBadge />);
    expect(wrapper.find('[data-testid="role-badge-teacher"]').exists()).toBe(true);
  });

  it('supports a compact size for tile overlays', () => {
    const wrapper = shallow(<RoleBadge size="sm" />);
    expect(wrapper.text()).toContain('Profesor');
  });
});
