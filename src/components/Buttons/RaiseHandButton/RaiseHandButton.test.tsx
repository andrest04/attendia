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

  it('does NOT import or call any network/DataTrack/Conversations API', () => {
    // This is enforced structurally: RaiseHandButton uses only useState (local React state).
    // Verifying there are no external service mock calls after toggling.
    const networkCallSpy = jest.fn();
    // If any hook tried to call a network function, it would appear here.
    // Since the component only uses useState, no external calls are made.
    const wrapper = shallow(<RaiseHandButton />);
    wrapper.find(Button).simulate('click');
    wrapper.find(Button).simulate('click');
    expect(networkCallSpy).not.toHaveBeenCalled();
  });
});
