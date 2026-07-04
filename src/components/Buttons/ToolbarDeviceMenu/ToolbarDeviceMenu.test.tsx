import React from 'react';
import { shallow } from 'enzyme';
import Button from '@material-ui/core/Button';
import { SELECTED_AUDIO_INPUT_KEY, SELECTED_VIDEO_INPUT_KEY, DEFAULT_VIDEO_CONSTRAINTS } from '../../../constants';
import useDevices from '../../../hooks/useDevices/useDevices';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';
import useMediaStreamTrack from '../../../hooks/useMediaStreamTrack/useMediaStreamTrack';
import { useAppState } from '../../../state';
import ToolbarDeviceMenu from './ToolbarDeviceMenu';

jest.mock('../../../hooks/useVideoContext/useVideoContext');
jest.mock('../../../hooks/useDevices/useDevices');
jest.mock('../../../hooks/useMediaStreamTrack/useMediaStreamTrack', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../../state', () => ({ useAppState: jest.fn() }));

const mockUseVideoContext = useVideoContext as jest.Mock<any>;
const mockUseDevices = useDevices as jest.Mock<any>;
const mockUseMediaStreamTrack = useMediaStreamTrack as jest.Mock<any>;
const mockUseAppState = useAppState as jest.Mock<any>;

const mic1 = { deviceId: 'mic-1', label: 'Built-in Mic' };
const mic2 = { deviceId: 'mic-2', label: 'USB Mic' };
const speaker1 = { deviceId: 'spk-1', label: 'Speakers' };
const speaker2 = { deviceId: 'spk-2', label: 'Headphones' };
const cam1 = { deviceId: 'cam-1', label: 'Built-in Camera' };
const cam2 = { deviceId: 'cam-2', label: 'USB Camera' };

const mockAudioTrack = { kind: 'audio', name: 'microphone', restart: jest.fn() };
const mockVideoTrack = { kind: 'video', name: 'camera-1', restart: jest.fn() };
const mockSetActiveSinkId = jest.fn();

describe('the ToolbarDeviceMenu component', () => {
  beforeEach(() => {
    mockUseVideoContext.mockImplementation(() => ({ localTracks: [mockAudioTrack, mockVideoTrack] }));
    mockUseDevices.mockImplementation(() => ({
      audioInputDevices: [mic1, mic2],
      videoInputDevices: [cam1, cam2],
      audioOutputDevices: [speaker1, speaker2],
    }));
    mockUseMediaStreamTrack.mockImplementation(() => ({ getSettings: () => ({ deviceId: 'mic-1' }) }));
    mockUseAppState.mockImplementation(() => ({ activeSinkId: 'spk-1', setActiveSinkId: mockSetActiveSinkId }));
  });

  afterEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it('renders a caret button that opens on click', () => {
    const wrapper = shallow(<ToolbarDeviceMenu kind="audio" data-testid="dm" />);
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    wrapper.find(Button).simulate('click');
    expect(wrapper.find('[role="menu"]').exists()).toBe(true);
  });

  it('lists microphones and speakers for the audio kind', () => {
    const wrapper = shallow(<ToolbarDeviceMenu kind="audio" />);
    wrapper.find(Button).simulate('click');
    const items = wrapper.find('[role="menuitemradio"]');
    expect(items).toHaveLength(4); // 2 mics + 2 speakers
  });

  it('lists cameras for the video kind', () => {
    const wrapper = shallow(<ToolbarDeviceMenu kind="video" />);
    wrapper.find(Button).simulate('click');
    const items = wrapper.find('[role="menuitemradio"]');
    expect(items).toHaveLength(2);
  });

  it('restarts the audio track and stores the preference when a mic is chosen', () => {
    const wrapper = shallow(<ToolbarDeviceMenu kind="audio" />);
    wrapper.find(Button).simulate('click');
    wrapper
      .find('[role="menuitemradio"]')
      .at(1) // mic-2
      .simulate('click');
    expect(window.localStorage.getItem(SELECTED_AUDIO_INPUT_KEY)).toBe('mic-2');
    expect(mockAudioTrack.restart).toHaveBeenCalledWith({ deviceId: { exact: 'mic-2' } });
  });

  it('sets the active sink id when a speaker is chosen', () => {
    const wrapper = shallow(<ToolbarDeviceMenu kind="audio" />);
    wrapper.find(Button).simulate('click');
    wrapper
      .find('[role="menuitemradio"]')
      .at(3) // spk-2
      .simulate('click');
    expect(mockSetActiveSinkId).toHaveBeenCalledWith('spk-2');
  });

  it('restarts the video track with default constraints when a camera is chosen', () => {
    const wrapper = shallow(<ToolbarDeviceMenu kind="video" />);
    wrapper.find(Button).simulate('click');
    wrapper
      .find('[role="menuitemradio"]')
      .at(1) // cam-2
      .simulate('click');
    expect(window.localStorage.getItem(SELECTED_VIDEO_INPUT_KEY)).toBe('cam-2');
    expect(mockVideoTrack.restart).toHaveBeenCalledWith({
      ...(DEFAULT_VIDEO_CONSTRAINTS as {}),
      deviceId: { exact: 'cam-2' },
    });
  });

  it('stores the preference even with no live track (device off)', () => {
    mockUseVideoContext.mockImplementation(() => ({ localTracks: [] }));
    const wrapper = shallow(<ToolbarDeviceMenu kind="video" />);
    wrapper.find(Button).simulate('click');
    wrapper
      .find('[role="menuitemradio"]')
      .at(0)
      .simulate('click');
    expect(window.localStorage.getItem(SELECTED_VIDEO_INPUT_KEY)).toBe('cam-1');
    expect(mockVideoTrack.restart).not.toHaveBeenCalled();
  });

  it('shows a fallback row when a group has no devices', () => {
    mockUseDevices.mockImplementation(() => ({
      audioInputDevices: [],
      videoInputDevices: [],
      audioOutputDevices: [],
    }));
    const wrapper = shallow(<ToolbarDeviceMenu kind="video" />);
    wrapper.find(Button).simulate('click');
    expect(wrapper.find('[role="menuitemradio"]')).toHaveLength(0);
    expect(wrapper.text()).toContain('Cámara del sistema');
  });
});
