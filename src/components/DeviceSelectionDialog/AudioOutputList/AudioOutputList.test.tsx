import React from 'react';
import AudioOutputList from './AudioOutputList';
import { Select, Typography } from '@material-ui/core';
import { mount, shallow } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { I18nextProvider, setI18n } from 'react-i18next';
import { createI18n } from '../../../i18n/createI18n';
import testI18n from '../../../i18n/testInit';
import es from '../../../i18n/locales/completeControls.es';
import en from '../../../i18n/locales/completeControls.en';
import useDevices from '../../../hooks/useDevices/useDevices';
import { useAppState } from '../../../state';

jest.mock('../../../state');
jest.mock('../../../hooks/useDevices/useDevices');

const mockUseAppState = useAppState as jest.Mock<any>;
const mockUseDevices = useDevices as jest.Mock<any>;

mockUseAppState.mockImplementation(() => ({ activeSinkId: '123' }));

const mockDevice = {
  deviceId: '123',
  label: 'mock device',
};

describe('the AudioOutputList component', () => {
  it('updates the default output label in place on language change', async () => {
    const i18n = createI18n({ detect: false, lng: 'es' });
    i18n.addResourceBundle('es', 'completeControls', es);
    i18n.addResourceBundle('en', 'completeControls', en);
    mockUseDevices.mockImplementation(() => ({ audioOutputDevices: [] }));
    const wrapper = mount(<I18nextProvider i18n={i18n}><AudioOutputList /></I18nextProvider>);
    expect(wrapper.text()).toContain(es.systemAudio);
    await act(async () => { await i18n.changeLanguage('en'); });
    wrapper.update();
    expect(wrapper.text()).toContain(en.systemAudio);
    wrapper.unmount();
    setI18n(testI18n);
  });
  it('should display the name of the active output device if only one is available', () => {
    mockUseDevices.mockImplementation(() => ({ audioOutputDevices: [mockDevice] }));
    const wrapper = shallow(<AudioOutputList />);
    expect(wrapper.find(Select).exists()).toBe(false);
    expect(
      wrapper
        .find(Typography)
        .at(1)
        .text()
    ).toBe('mock device');
  });

  it('should display "Salida de audio predeterminada del sistema" when no audio output devices are available', () => {
    mockUseDevices.mockImplementation(() => ({ audioOutputDevices: [] }));
    const wrapper = shallow(<AudioOutputList />);
    expect(wrapper.find(Select).exists()).toBe(false);
    expect(
      wrapper
        .find(Typography)
        .at(1)
        .text()
    ).toBe('Salida de audio predeterminada del sistema');
  });

  it('should display a Select menu when multiple audio output devices are available', () => {
    mockUseDevices.mockImplementation(() => ({ audioOutputDevices: [mockDevice, mockDevice] }));
    const wrapper = shallow(<AudioOutputList />);
    expect(wrapper.find(Select).exists()).toBe(true);
  });
});
