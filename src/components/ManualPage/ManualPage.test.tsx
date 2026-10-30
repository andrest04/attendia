import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import ManualPage from './ManualPage';
import i18n from '../../i18n/testInit';
import es from '../../i18n/locales/completePages.es';
import en from '../../i18n/locales/completePages.en';

i18n.addResourceBundle('es', 'completePages', es, true, true);
i18n.addResourceBundle('en', 'completePages', en, true, true);
describe('ManualPage', () => {
  it('updates the manual and privacy explanation when the language changes', async () => {
    const wrapper = mount(<ManualPage />);
    try {
      expect(wrapper.text()).toContain('Detección de atención');
      await act(async () => { await i18n.changeLanguage('en'); });
      wrapper.update();
      expect(wrapper.text()).toContain('Attention detection');
      expect(wrapper.text()).toContain('No images leave your device');
      expect(wrapper.text()).toContain('Camera and microphone controls');
      expect(wrapper.text()).toContain('Session recording');
      expect(wrapper.text()).toContain('Disabled by default; participant consent is required');
      await act(async () => { await i18n.changeLanguage('es'); });
      wrapper.update();
      expect(wrapper.text()).toContain('Ninguna imagen sale de tu dispositivo');
    } finally {
      await act(async () => { await i18n.changeLanguage('es'); });
      wrapper.unmount();
    }
  });
  it('renders the manual page with its heading', () => {
    const wrapper = mount(<ManualPage />);
    expect(wrapper.find('[data-testid="manual-page"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Manual de uso');
  });

  it('renders the real feature sections', () => {
    const sections = mount(<ManualPage />).find('[data-testid="manual-sections"]');
    expect(sections.text()).toContain('Controles de cámara y micrófono');
    expect(sections.text()).toContain('Detección de atención');
    expect(sections.text()).toContain('Levantar la mano y turnos');
    expect(sections.text()).toContain('Grabación de la sesión');
  });

  it('goes back in history when "Volver" is clicked', () => {
    const backSpy = jest.spyOn(window.history, 'back').mockImplementation(() => undefined);
    try {
      // jsdom starts with a single history entry; force the >1 branch.
      Object.defineProperty(window.history, 'length', { configurable: true, value: 2 });
      const wrapper = mount(<ManualPage />);
      wrapper
        .find('[data-testid="manual-back"]')
        .first()
        .simulate('click');
      expect(backSpy).toHaveBeenCalled();
    } finally {
      backSpy.mockRestore();
    }
  });
});
