import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { I18nextProvider, setI18n } from 'react-i18next';
import testI18n from '../../../i18n/testInit';
import { createI18n } from '../../../i18n/createI18n';
import SessionStatusBar from './SessionStatusBar';
import { OnboardingContext } from '../OnboardingTutorial/onboardingContext';

describe('SessionStatusBar — recording indicator', () => {
  it('names the visible REC indicator in both languages only while recording', async () => {
    const i18n = createI18n({ detect: false, lng: 'es' });
    const wrapper = mount(<I18nextProvider i18n={i18n}><SessionStatusBar recording /></I18nextProvider>);
    const badge = () => wrapper.find('[data-testid="professor-room-shell-rec-badge"]').first();
    expect(badge().text()).toBe('REC');
    expect(badge().prop('role')).toBe('img');
    expect(badge().prop('aria-label')).toBe('Grabación en curso.');
    await act(async () => { await i18n.changeLanguage('en'); });
    wrapper.update();
    expect(badge().text()).toBe('REC');
    expect(badge().prop('aria-label')).toBe('Recording is in progress.');
    wrapper.setProps({ children: <SessionStatusBar recording={false} /> });
    expect(wrapper.find('[data-testid="professor-room-shell-rec-badge"]').exists()).toBe(false);
    wrapper.unmount();
    setI18n(testI18n);
  });
});

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
