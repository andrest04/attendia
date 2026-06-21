import React from 'react';
import { mount } from 'enzyme';
import SessionStatusBar from './SessionStatusBar';
import { OnboardingContext } from '../OnboardingTutorial/onboardingContext';

describe('SessionStatusBar — Ayuda button', () => {
  it('renders the Ayuda button', () => {
    const wrapper = mount(<SessionStatusBar />);
    expect(wrapper.find('[data-testid="professor-room-shell-help-button"]').exists()).toBe(true);
  });

  it('calls openTour from context when Ayuda is clicked', () => {
    const openTour = jest.fn();
    const wrapper = mount(
      <OnboardingContext.Provider value={{ openTour }}>
        <SessionStatusBar />
      </OnboardingContext.Provider>
    );

    wrapper
      .find('[data-testid="professor-room-shell-help-button"]')
      .first()
      .simulate('click');

    expect(openTour).toHaveBeenCalledTimes(1);
  });

  it('does not throw when clicked without a provider (default no-op)', () => {
    const wrapper = mount(<SessionStatusBar />);
    expect(() =>
      wrapper
        .find('[data-testid="professor-room-shell-help-button"]')
        .first()
        .simulate('click')
    ).not.toThrow();
  });
});
