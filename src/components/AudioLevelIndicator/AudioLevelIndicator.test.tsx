import React from 'react';
import { mount, shallow } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { EventEmitter } from 'events';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n/createI18n';

import AudioLevelIndicator from './AudioLevelIndicator';
import MicOff from '@material-ui/icons/MicOff';
import useIsTrackEnabled from '../../hooks/useIsTrackEnabled/useIsTrackEnabled';

jest.mock('../../hooks/useIsTrackEnabled/useIsTrackEnabled');
jest.mock('../../hooks/useMediaStreamTrack/useMediaStreamTrack', () => () => undefined);

const mockUseIsTrackEnabled = useIsTrackEnabled as jest.Mock<boolean>;

describe('the AudioLevelIndicator component', () => {
  it('names absent, enabled and disabled tracks in both languages as state changes', async () => {
    const realHook = jest.requireActual('../../hooks/useIsTrackEnabled/useIsTrackEnabled').default;
    mockUseIsTrackEnabled.mockImplementation(realHook);
    const i18n = createI18n({ detect: false, lng: 'es' });
    const track = Object.assign(new EventEmitter(), { isEnabled: true });
    const indicator = (audioTrack?: any) => (
      <I18nextProvider i18n={i18n}><AudioLevelIndicator audioTrack={audioTrack} /></I18nextProvider>
    );
    const wrapper = mount(indicator());
    expect(wrapper.find('svg[role="img"]').prop('aria-label')).toBe('Pista de audio no disponible');
    wrapper.setProps({ children: <AudioLevelIndicator audioTrack={track as any} /> });
    wrapper.update();
    expect(wrapper.find('svg[role="img"]').prop('aria-label')).toBe('Pista de audio activada');
    act(() => { track.emit('disabled'); });
    wrapper.update();
    expect(wrapper.find('svg[role="img"]').prop('aria-label')).toBe('Pista de audio desactivada');
    await act(async () => { await i18n.changeLanguage('en'); });
    wrapper.update();
    expect(wrapper.find('svg[role="img"]').prop('aria-label')).toBe('Audio track disabled');
    act(() => { track.emit('enabled'); });
    wrapper.update();
    expect(wrapper.find('svg[role="img"]').prop('aria-label')).toBe('Audio track enabled');
    wrapper.setProps({ children: <AudioLevelIndicator /> });
    wrapper.update();
    expect(wrapper.find('svg[role="img"]').prop('aria-label')).toBe('Audio track unavailable');
    wrapper.unmount();
  });
  describe('when the audioTrack is not enabled', () => {
    mockUseIsTrackEnabled.mockImplementation(() => false);
    const wrapper = shallow(<AudioLevelIndicator color="#123456" />);

    it('should render a mute icon', () => {
      expect(wrapper.exists('[data-test-audio-mute-icon]')).toBe(true);
    });

    it('should change the color of the mute icon when color prop is used', () => {
      expect(
        wrapper
          .find('[data-test-audio-mute-icon]')
          .find({ fill: '#123456' })
          .exists()
      ).toBeTruthy();
    });
  });

  describe('when the audioTrack is enabled', () => {
    mockUseIsTrackEnabled.mockImplementation(() => true);
    const wrapper = shallow(<AudioLevelIndicator color="#123456" />);

    it('should render the audio level icon', () => {
      expect(wrapper.exists(MicOff)).toBe(false);
      expect(wrapper.exists('[data-test-audio-indicator]')).toBe(true);
    });

    it('should change the color of the audio level icon when color prop is used', () => {
      expect(
        wrapper
          .find('[data-test-audio-indicator]')
          .find({ fill: '#123456' })
          .exists()
      ).toBeTruthy();
    });
  });
});
