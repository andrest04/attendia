import React from 'react';
import { mount } from 'enzyme';
import ManualPage from './ManualPage';

describe('ManualPage', () => {
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
