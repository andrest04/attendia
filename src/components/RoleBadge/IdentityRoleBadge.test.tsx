import React from 'react';
import { shallow } from 'enzyme';
import IdentityRoleBadge from './IdentityRoleBadge';
import RoleBadge from './RoleBadge';

describe('the IdentityRoleBadge component', () => {
  it('renders the RoleBadge for a teacher identity', () => {
    const wrapper = shallow(<IdentityRoleBadge identity="Ana [Profesor]" />);
    expect(wrapper.find(RoleBadge)).toHaveLength(1);
  });

  it('forwards the badge props and not the identity', () => {
    const wrapper = shallow(<IdentityRoleBadge identity="Ana [Profesor]" size="sm" className="custom" />);
    const badge = wrapper.find(RoleBadge);
    expect(badge.prop('size')).toBe('sm');
    expect(badge.prop('className')).toBe('custom');
    expect(badge.prop('identity')).toBeUndefined();
  });

  it('renders nothing for a student identity', () => {
    expect(shallow(<IdentityRoleBadge identity="Ana" />).isEmptyRender()).toBe(true);
  });

  it('renders nothing for a missing identity', () => {
    expect(shallow(<IdentityRoleBadge identity={undefined} />).isEmptyRender()).toBe(true);
    expect(shallow(<IdentityRoleBadge identity={null} />).isEmptyRender()).toBe(true);
  });
});
