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

  it('fills only the current (last) segment on the last step', () => {
    const wrapper = mount(<OnboardingTutorial />);
    for (let i = 0; i < 3; i++) {
      wrapper
        .find('[data-testid="onboarding-next"]')
        .first()
        .simulate('click');
    }
    expect(wrapper.find('[data-testid="onboarding-progress-filled"]').length).toBe(1);
    expect(wrapper.find('[data-testid="onboarding-progress-empty"]').length).toBe(3);
  });

  it('keeps the progress fill blue regardless of the step accent color', () => {
    const wrapper = mount(<OnboardingTutorial />);
    // advance to step 2 (green accent) — the filled segment must stay blue
    wrapper
      .find('[data-testid="onboarding-next"]')
      .first()
      .simulate('click');
    const fillStyle = wrapper.find('[data-testid="onboarding-progress-filled"]').prop('style') as React.CSSProperties;
    expect(fillStyle.backgroundColor).toBe('#1d6eed');
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

  it('opens the full manual in a new tab without navigating away from the room', () => {
    // The tutorial lives INSIDE the room; a router navigation would unmount the
    // Twilio call. The manual must open in a separate tab instead.
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    try {
      const wrapper = mount(<OnboardingTutorial />);
      wrapper
        .find('[data-testid="onboarding-manual"]')
        .first()
        .simulate('click');
      expect(openSpy).toHaveBeenCalledWith('/manual', '_blank', 'noopener');
    } finally {
      openSpy.mockRestore();
    }
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

  // -------------------------------------------------------------------------
  // External re-open via openSignal (the professor's "Ayuda" button)
  // -------------------------------------------------------------------------
  describe('openSignal re-open', () => {
    it('does NOT open on initial mount when openSignal=0 and onboarding is done', () => {
      getStore()[STORAGE_KEY] = 'true';
      const wrapper = mount(<OnboardingTutorial openSignal={0} />);
      expect(wrapper.find('[data-testid="onboarding-backdrop"]').exists()).toBe(false);
    });

    it('re-opens the tour when openSignal increments, even after it was dismissed', () => {
      getStore()[STORAGE_KEY] = 'true';
      const wrapper = mount(<OnboardingTutorial openSignal={0} />);
      expect(wrapper.find('[data-testid="onboarding-backdrop"]').exists()).toBe(false);

      wrapper.setProps({ openSignal: 1 });
      wrapper.update();
      expect(wrapper.find('[data-testid="onboarding-backdrop"]').exists()).toBe(true);
    });

    it('restarts at step 1 each time openSignal increments', () => {
      const wrapper = mount(<OnboardingTutorial openSignal={1} />);
      // Advance to step 2, then re-trigger.
      wrapper
        .find('[data-testid="onboarding-next"]')
        .first()
        .simulate('click');
      expect(wrapper.find('[data-testid="onboarding-step-label"]').text()).toBe('Paso 2 de 4');

      wrapper.setProps({ openSignal: 2 });
      wrapper.update();
      expect(wrapper.find('[data-testid="onboarding-step-label"]').text()).toBe('Paso 1 de 4');
    });
  });

  // -------------------------------------------------------------------------
  // Spotlight highlight box (anchored to real room elements by data-testid)
  // -------------------------------------------------------------------------
  describe('spotlight highlight', () => {
    let anchors: HTMLElement[] = [];

    function addAnchor(testId: string): void {
      const el = document.createElement('div');
      el.setAttribute('data-testid', testId);
      document.body.appendChild(el);
      anchors.push(el);
    }

    afterEach(() => {
      anchors.forEach(el => el.remove());
      anchors = [];
    });

    it('draws a spotlight over the step-1 anchor when the element is present', () => {
      addAnchor('professor-room-shell-toolbar-slot');
      const wrapper = mount(<OnboardingTutorial openSignal={1} />);
      wrapper.update();
      expect(wrapper.find('[data-testid="onboarding-spotlight"]').exists()).toBe(true);
    });

    it('draws no spotlight when the anchor element is absent (e.g. student shell)', () => {
      const wrapper = mount(<OnboardingTutorial openSignal={1} />);
      wrapper.update();
      expect(wrapper.find('[data-testid="onboarding-spotlight"]').exists()).toBe(false);
    });

    it('draws no spotlight on the last step, which has no anchor', () => {
      // Provide every anchor so only the missing anchorTestId can explain the absence.
      addAnchor('professor-room-shell-toolbar-slot');
      addAnchor('professor-room-shell-right-rail');
      addAnchor('professor-room-shell-group-gauge');
      const wrapper = mount(<OnboardingTutorial openSignal={1} />);
      for (let i = 0; i < 3; i++) {
        wrapper
          .find('[data-testid="onboarding-next"]')
          .first()
          .simulate('click');
      }
      wrapper.update();
      expect(wrapper.find('[data-testid="onboarding-step-label"]').text()).toBe('Paso 4 de 4');
      expect(wrapper.find('[data-testid="onboarding-spotlight"]').exists()).toBe(false);
    });
  });
});
