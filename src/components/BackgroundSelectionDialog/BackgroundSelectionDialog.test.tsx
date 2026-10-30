import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import BackgroundSelectionDialog from './BackgroundSelectionDialog';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import i18n from '../../i18n/testInit';
import es from '../../i18n/locales/completeBackground.es';
import en from '../../i18n/locales/completeBackground.en';
import { backgroundConfig } from '../VideoProvider/useBackgroundSettings/useBackgroundSettings';

jest.mock('../../hooks/useVideoContext/useVideoContext');
const setBackgroundSettings = jest.fn();
const close = jest.fn();
(useVideoContext as jest.Mock).mockImplementation(() => ({
  isBackgroundSelectionOpen: true, setIsBackgroundSelectionOpen: close,
  backgroundSettings: { type: 'none', index: 0 }, setBackgroundSettings,
}));

describe('background selection localization', () => {
  it('updates all labels and image alt text when the language changes, preserving selection', async () => {
    i18n.addResourceBundle('es', 'completeBackground', es);
    i18n.addResourceBundle('en', 'completeBackground', en);
    await i18n.changeLanguage('es');
    const wrapper = mount(<BackgroundSelectionDialog />);
    expect(wrapper.text()).toContain('Fondos');
    expect(wrapper.find('button[aria-label="Cerrar selección de fondo"]').exists()).toBe(true);
    expect(wrapper.find('[role="button"][aria-label="Ninguno"]').exists()).toBe(true);
    expect(wrapper.find('[role="button"][aria-label="Desenfoque"]').exists()).toBe(true);
    expect(wrapper.find('img').map(img => img.prop('alt'))).toEqual(backgroundConfig.imageNames.map(name => es.images[name as keyof typeof es.images]));
    wrapper.find('[role="button"][aria-label="Estantería"]').simulate('click');
    expect(setBackgroundSettings).toHaveBeenCalledWith({ type: 'image', index: 2 });
    await act(async () => { await i18n.changeLanguage('en'); });
    wrapper.update();
    expect(wrapper.text()).toContain('Backgrounds');
    expect(wrapper.find('button[aria-label="Close background selection"]').exists()).toBe(true);
    expect(wrapper.find('[role="button"][aria-label="None"]').exists()).toBe(true);
    expect(wrapper.find('[role="button"][aria-label="Blur"]').exists()).toBe(true);
    expect(wrapper.find('img').map(img => img.prop('alt'))).toEqual(backgroundConfig.imageNames);
    wrapper.find('button[aria-label="Close background selection"]').simulate('click');
    expect(close).toHaveBeenCalledWith(false);
    wrapper.unmount();
    await i18n.changeLanguage('es');
  });
});
