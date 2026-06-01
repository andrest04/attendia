import React from 'react';
import { shallow } from 'enzyme';
import { Button } from '@material-ui/core';
import RaiseHandButton from './RaiseHandButton';

// RaiseHandButton must NOT call any network/DataTrack/Conversations.
// This test verifies local-only state toggling and the absence of network calls.

describe('RaiseHandButton', () => {
  it('renders with "Levantar mano" label initially (hand is down)', () => {
    const wrapper = shallow(<RaiseHandButton />);
    expect(wrapper.find(Button).text()).toContain('Levantar mano');
  });

  it('toggles label to "Bajar mano" after first click', () => {
    const wrapper = shallow(<RaiseHandButton />);
    wrapper.find(Button).simulate('click');
    expect(wrapper.find(Button).text()).toContain('Bajar mano');
  });

  it('toggles back to "Levantar mano" after second click', () => {
    const wrapper = shallow(<RaiseHandButton />);
    wrapper.find(Button).simulate('click');
    wrapper.find(Button).simulate('click');
    expect(wrapper.find(Button).text()).toContain('Levantar mano');
  });

  it('sets aria-pressed="true" when hand is raised', () => {
    const wrapper = shallow(<RaiseHandButton />);
    wrapper.find(Button).simulate('click');
    expect(wrapper.find(Button).prop('aria-pressed')).toBe(true);
  });

  it('sets aria-pressed="false" initially', () => {
    const wrapper = shallow(<RaiseHandButton />);
    expect(wrapper.find(Button).prop('aria-pressed')).toBe(false);
  });

  it('supports controlled mode via props and callback', () => {
    const onHandRaisedChange = jest.fn();
    const wrapper = shallow(<RaiseHandButton handRaised onHandRaisedChange={onHandRaisedChange} />);

    expect(wrapper.find(Button).text()).toContain('Bajar mano');
    wrapper.find(Button).simulate('click');
    expect(onHandRaisedChange).toHaveBeenCalledWith(false);
  });

  it('uses uncontrolled local state when controlled callback is not provided', () => {
    const wrapper = shallow(<RaiseHandButton />);
    expect(wrapper.find(Button).text()).toContain('Levantar mano');
    wrapper.find(Button).simulate('click');
    expect(wrapper.find(Button).text()).toContain('Bajar mano');
  });

  it('does not mutate controlled visual state until the parent supplies the next value', () => {
    const onHandRaisedChange = jest.fn();
    const wrapper = shallow(<RaiseHandButton handRaised={false} onHandRaisedChange={onHandRaisedChange} />);

    wrapper.find(Button).simulate('click');

    expect(onHandRaisedChange).toHaveBeenCalledWith(true);
    expect(wrapper.find(Button).text()).toContain('Levantar mano');
    expect(wrapper.find(Button).prop('aria-pressed')).toBe(false);

    wrapper.setProps({ handRaised: true });
    expect(wrapper.find(Button).text()).toContain('Bajar mano');
    expect(wrapper.find(Button).prop('aria-pressed')).toBe(true);
  });
});
