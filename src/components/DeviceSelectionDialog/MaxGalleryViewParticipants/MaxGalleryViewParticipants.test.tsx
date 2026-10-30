import React from 'react';
import { mount, shallow } from 'enzyme';
import { Select } from '@material-ui/core';
import { act } from 'react-dom/test-utils';
import { I18nextProvider, setI18n } from 'react-i18next';
import { createI18n } from '../../../i18n/createI18n';
import testI18n from '../../../i18n/testInit';
import es from '../../../i18n/locales/completeControls.es';
import en from '../../../i18n/locales/completeControls.en';
import useDevices from '../../../hooks/useDevices/useDevices';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';
import { useAppState } from '../../../state';
import AudioInputList from '../AudioInputList/AudioInputList';
import AudioOutputList from '../AudioOutputList/AudioOutputList';
import VideoInputList from '../VideoInputList/VideoInputList';
import MaxGalleryViewParticipants from './MaxGalleryViewParticipants';

jest.mock('../../../hooks/useDevices/useDevices');
jest.mock('../../../hooks/useVideoContext/useVideoContext');
jest.mock('../../../state');

const setMax = jest.fn();
const setSink = jest.fn();
const devices = [{ deviceId: 'a', label: 'A' }, { deviceId: 'b', label: 'B' }];

beforeEach(() => {
  (useDevices as jest.Mock).mockReturnValue({ audioInputDevices: devices, audioOutputDevices: devices, videoInputDevices: devices });
  (useVideoContext as jest.Mock).mockReturnValue({ localTracks: [] });
  (useAppState as jest.Mock).mockReturnValue({ activeSinkId: 'a', setActiveSinkId: setSink, maxGalleryViewParticipants: 12, setMaxGalleryViewParticipants: setMax });
});

afterEach(() => {
  jest.clearAllMocks();
  setI18n(testI18n);
});

it('names each rendered select in both languages without instance IDs', async () => {
  const i18n = createI18n({ detect: false, lng: 'es' });
  i18n.addResourceBundle('es', 'completeControls', es);
  i18n.addResourceBundle('en', 'completeControls', en);
  const controls = () => <><AudioInputList /><AudioOutputList /><VideoInputList /><MaxGalleryViewParticipants /></>;
  const wrapper = mount(<I18nextProvider i18n={i18n}>{controls()}{controls()}</I18nextProvider>);
  const assertNames = (locale: typeof es) => {
    const buttons = wrapper.find('[role="button"]');
    expect(buttons).toHaveLength(8);
    expect(buttons.map(button => button.prop('aria-label'))).toEqual([
      locale.audioInput, locale.audioOutput, locale.videoInput, locale.maxParticipants,
      locale.audioInput, locale.audioOutput, locale.videoInput, locale.maxParticipants,
    ]);
    const ids = buttons.map(button => button.prop('id')).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  };
  assertNames(es);
  await act(async () => { await i18n.changeLanguage('en'); });
  wrapper.update();
  assertNames(en);
  wrapper.unmount();
});

it('preserves gallery and audio output selection callbacks', () => {
  shallow(<MaxGalleryViewParticipants />).find(Select).simulate('change', { target: { value: '24' } });
  shallow(<AudioOutputList />).find(Select).simulate('change', { target: { value: 'b' } });
  expect(setMax).toHaveBeenCalledWith(24);
  expect(setSink).toHaveBeenCalledWith('b');
});
