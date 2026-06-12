import React from 'react';
import { mount, shallow } from 'enzyme';
import useScreenShareParticipant from '../../../hooks/useScreenShareParticipant/useScreenShareParticipant';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';

import ToggleScreenShareButton, {
  SHARE_IN_PROGRESS_TEXT,
  SHARE_NOT_SUPPORTED_TEXT,
  STOP_SCREEN_SHARE_TEXT,
} from './ToggleScreenShareButton';
import ScreenShareIcon from '../../../icons/ScreenShareIcon';
import { Button, Tooltip } from '@material-ui/core';

jest.mock('../../../hooks/useScreenShareParticipant/useScreenShareParticipant');
jest.mock('../../../hooks/useVideoContext/useVideoContext');

const mockUseScreenShareParticipant = useScreenShareParticipant as jest.Mock<any>;
const mockUseVideoContext = useVideoContext as jest.Mock<any>;

const mockToggleScreenShare = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockUseScreenShareParticipant.mockImplementation(() => null);
  mockUseVideoContext.mockImplementation(() => ({
    toggleScreenShare: mockToggleScreenShare,
    isSharingScreen: false,
  }));
  // Restore getDisplayMedia support by default.
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getDisplayMedia: () => {} },
    configurable: true,
  });
});

describe('the ToggleScreenShareButton component', () => {
  it('renders with "Compartir" label and enabled when nobody is sharing', () => {
    const wrapper = mount(<ToggleScreenShareButton />);
    expect(wrapper.find(ScreenShareIcon).exists()).toBe(true);
    expect(wrapper.find(Button).text()).toContain('Compartir');
    expect(wrapper.find(Button).prop('disabled')).toBe(false);
  });

  it('renders "Dejar de compartir" label and stays ENABLED while the local user is sharing', () => {
    mockUseVideoContext.mockImplementation(() => ({
      toggleScreenShare: mockToggleScreenShare,
      isSharingScreen: true,
    }));
    // screenShareParticipant is truthy because the local user's track is tracked too.
    mockUseScreenShareParticipant.mockImplementation(() => 'mockLocalParticipant');
    const wrapper = mount(<ToggleScreenShareButton />);
    expect(wrapper.find(Button).text()).toContain(STOP_SCREEN_SHARE_TEXT);
    expect(wrapper.find(Button).prop('disabled')).toBe(false);
  });

  it('calls toggleScreenShare when clicked while sharing', () => {
    mockUseVideoContext.mockImplementation(() => ({
      toggleScreenShare: mockToggleScreenShare,
      isSharingScreen: true,
    }));
    mockUseScreenShareParticipant.mockImplementation(() => 'mockLocalParticipant');
    const wrapper = shallow(<ToggleScreenShareButton />);
    wrapper.find(Button).simulate('click');
    expect(mockToggleScreenShare).toHaveBeenCalled();
  });

  it('disables the button and shows in-progress tooltip when someone ELSE is sharing', () => {
    mockUseScreenShareParticipant.mockImplementation(() => 'mockRemoteParticipant');
    // isSharingScreen remains false — a remote participant is sharing.
    const wrapper = mount(<ToggleScreenShareButton />);
    expect(wrapper.find(Button).prop('disabled')).toBe(true);
    expect(wrapper.find(Tooltip).prop('title')).toBe(SHARE_IN_PROGRESS_TEXT);
  });

  it('calls the correct toggle function when clicked (not sharing)', () => {
    const wrapper = shallow(<ToggleScreenShareButton />);
    wrapper.find(Button).simulate('click');
    expect(mockToggleScreenShare).toHaveBeenCalled();
  });

  it('disables the button with unsupported-browser tooltip when getDisplayMedia is absent', () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getDisplayMedia: undefined },
      configurable: true,
    });
    const wrapper = mount(<ToggleScreenShareButton />);
    expect(wrapper.find(Button).prop('disabled')).toBe(true);
    expect(wrapper.find(Tooltip).prop('title')).toBe(SHARE_NOT_SUPPORTED_TEXT);
  });
});
