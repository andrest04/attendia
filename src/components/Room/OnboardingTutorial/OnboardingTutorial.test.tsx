import React from 'react';
import { mount } from 'enzyme';
import OnboardingTutorial, { isOnboardingDone, markOnboardingDone, STORAGE_KEY } from './OnboardingTutorial';

// ---------------------------------------------------------------------------
// The test environment uses a custom localStorage polyfill (src/setupTests.ts)
// with a `store` property and no `removeItem`. Access it directly.
// ---------------------------------------------------------------------------
function getStore(): Record<string, string> {
  return (window.localStorage as any).store;
}

function clearStore(): void {
  (window.localStorage as any).store = {};
}

beforeEach(() => {
  clearStore();
});

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------
describe('localStorage helpers', () => {
  it('isOnboardingDone returns false when key is absent', () => {
    expect(isOnboardingDone()).toBe(false);
  });

  it('isOnboardingDone returns true when key is set to "true"', () => {
    getStore()[STORAGE_KEY] = 'true';
    expect(isOnboardingDone()).toBe(true);
  });

  it('markOnboardingDone persists the flag', () => {
    markOnboardingDone();
    expect(getStore()[STORAGE_KEY]).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// Component rendering
// ---------------------------------------------------------------------------
describe('OnboardingTutorial component', () => {
  it('renders nothing when onboarding is already done', () => {
    getStore()[STORAGE_KEY] = 'true';
    const wrapper = mount(<OnboardingTutorial />);
    expect(wrapper.find('[data-testid="onboarding-backdrop"]').exists()).toBe(false);
  });

  it('renders nothing when enabled=false', () => {
    const wrapper = mount(<OnboardingTutorial enabled={false} />);
    expect(wrapper.find('[data-testid="onboarding-backdrop"]').exists()).toBe(false);
  });

  it('renders the modal when onboarding has not been done yet', () => {
    const wrapper = mount(<OnboardingTutorial />);
    expect(wrapper.find('[data-testid="onboarding-backdrop"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="onboarding-modal"]').exists()).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Step 1 initial state
  // -------------------------------------------------------------------------
  it('starts on step 1', () => {
    const wrapper = mount(<OnboardingTutorial />);
    expect(wrapper.find('[data-testid="onboarding-step-label"]').text()).toBe('Paso 1 de 4');
  });

  it('shows step 1 title', () => {
    const wrapper = mount(<OnboardingTutorial />);
    expect(
      wrapper
        .find('[data-testid="onboarding-title"]')
        .first()
        .text()
    ).toBe('Controles de cámara y micrófono');
  });

  it('does NOT show the Previous button on step 1', () => {
    const wrapper = mount(<OnboardingTutorial />);
    expect(wrapper.find('[data-testid="onboarding-prev"]').exists()).toBe(false);
  });

  it('shows "Siguiente →" on step 1', () => {
    const wrapper = mount(<OnboardingTutorial />);
    expect(
      wrapper
        .find('[data-testid="onboarding-next"]')
        .first()
        .text()
    ).toContain('Siguiente');
  });

  // -------------------------------------------------------------------------
  // Progress bar (step 1: 1 filled, 3 empty)
  // -------------------------------------------------------------------------
  it('fills 1 segment on step 1', () => {
    const wrapper = mount(<OnboardingTutorial />);
    expect(wrapper.find('[data-testid="onboarding-progress-filled"]').length).toBe(1);
    expect(wrapper.find('[data-testid="onboarding-progress-empty"]').length).toBe(3);
  });

  // -------------------------------------------------------------------------
  // Navigation: forward
  // -------------------------------------------------------------------------
  it('advances to step 2 when Siguiente is clicked', () => {
    const wrapper = mount(<OnboardingTutorial />);
    wrapper
      .find('[data-testid="onboarding-next"]')
      .first()
      .simulate('click');
    expect(wrapper.find('[data-testid="onboarding-step-label"]').text()).toBe('Paso 2 de 4');
    expect(
      wrapper
        .find('[data-testid="onboarding-title"]')
        .first()
        .text()
    ).toBe('Chat y participantes');
  });

  it('shows the Previous button on step 2', () => {
    const wrapper = mount(<OnboardingTutorial />);
    wrapper
      .find('[data-testid="onboarding-next"]')
      .first()
      .simulate('click');
    expect(wrapper.find('[data-testid="onboarding-prev"]').exists()).toBe(true);
  });

  it('goes back to step 1 when Anterior is clicked', () => {
    const wrapper = mount(<OnboardingTutorial />);
    wrapper
      .find('[data-testid="onboarding-next"]')
      .first()
      .simulate('click');
    expect(wrapper.find('[data-testid="onboarding-step-label"]').text()).toBe('Paso 2 de 4');
    wrapper
      .find('[data-testid="onboarding-prev"]')
      .first()
      .simulate('click');
    expect(wrapper.find('[data-testid="onboarding-step-label"]').text()).toBe('Paso 1 de 4');
  });

  // -------------------------------------------------------------------------
  // Navigation: all 4 steps
  // -------------------------------------------------------------------------
  it('navigates through all 4 steps in order', () => {
    const wrapper = mount(<OnboardingTutorial />);
    const titles = [
      'Controles de cámara y micrófono',
      'Chat y participantes',
      'Detección de atención',
      'Privacidad y seguridad',
    ];

    for (let i = 0; i < 4; i++) {
      expect(wrapper.find('[data-testid="onboarding-step-label"]').text()).toBe(`Paso ${i + 1} de 4`);
      expect(
        wrapper
          .find('[data-testid="onboarding-title"]')
          .first()
          .text()
      ).toBe(titles[i]);
      if (i < 3) {
        wrapper
          .find('[data-testid="onboarding-next"]')
          .first()
          .simulate('click');
      }
    }
  });

  // -------------------------------------------------------------------------
  // Step 4: last step UI
  // -------------------------------------------------------------------------
  it('shows "Comenzar" on the last step', () => {
    const wrapper = mount(<OnboardingTutorial />);
    for (let i = 0; i < 3; i++) {
      wrapper
        .find('[data-testid="onboarding-next"]')
        .first()
        .simulate('click');
    }
    expect(
      wrapper
        .find('[data-testid="onboarding-next"]')
        .first()
        .text()
    ).toBe('Comenzar');
  });

  it('fills all 4 segments on the last step', () => {
    const wrapper = mount(<OnboardingTutorial />);
    for (let i = 0; i < 3; i++) {
      wrapper
        .find('[data-testid="onboarding-next"]')
        .first()
        .simulate('click');
    }
    expect(wrapper.find('[data-testid="onboarding-progress-filled"]').length).toBe(4);
    expect(wrapper.find('[data-testid="onboarding-progress-empty"]').length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Dismiss paths
  // -------------------------------------------------------------------------
  it('dismisses and sets localStorage flag when X is clicked', () => {
    const wrapper = mount(<OnboardingTutorial />);
    wrapper
      .find('[data-testid="onboarding-close"]')
      .first()
      .simulate('click');
    expect(wrapper.find('[data-testid="onboarding-backdrop"]').exists()).toBe(false);
    expect(getStore()[STORAGE_KEY]).toBe('true');
  });

  it('dismisses when "Saltar tutorial" is clicked', () => {
    const wrapper = mount(<OnboardingTutorial />);
    wrapper
      .find('[data-testid="onboarding-skip"]')
      .first()
      .simulate('click');
    expect(wrapper.find('[data-testid="onboarding-backdrop"]').exists()).toBe(false);
    expect(getStore()[STORAGE_KEY]).toBe('true');
  });

  it('dismisses when "Comenzar" is clicked on the last step', () => {
    const wrapper = mount(<OnboardingTutorial />);
    for (let i = 0; i < 3; i++) {
      wrapper
        .find('[data-testid="onboarding-next"]')
        .first()
        .simulate('click');
    }
    wrapper
      .find('[data-testid="onboarding-next"]')
      .first()
      .simulate('click');
    expect(wrapper.find('[data-testid="onboarding-backdrop"]').exists()).toBe(false);
    expect(getStore()[STORAGE_KEY]).toBe('true');
  });

  // -------------------------------------------------------------------------
  // Static elements
  // -------------------------------------------------------------------------
  it('renders the callout on every step', () => {
    const wrapper = mount(<OnboardingTutorial />);
    for (let i = 0; i < 4; i++) {
      expect(wrapper.find('[data-testid="onboarding-callout"]').exists()).toBe(true);
      if (i < 3) {
        wrapper
          .find('[data-testid="onboarding-next"]')
          .first()
          .simulate('click');
      }
    }
  });

  it('renders the manual link', () => {
    const wrapper = mount(<OnboardingTutorial />);
    expect(wrapper.find('[data-testid="onboarding-manual"]').exists()).toBe(true);
  });

  it('accent color changes between steps', () => {
    const wrapper = mount(<OnboardingTutorial />);
    const step1Style = wrapper.find('[data-testid="onboarding-accent"]').prop('style') as React.CSSProperties;
    wrapper
      .find('[data-testid="onboarding-next"]')
      .first()
      .simulate('click');
    const step2Style = wrapper.find('[data-testid="onboarding-accent"]').prop('style') as React.CSSProperties;
    expect(step1Style.backgroundColor).not.toBe(step2Style.backgroundColor);
  });
});
