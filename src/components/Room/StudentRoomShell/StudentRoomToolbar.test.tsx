import React from 'react';
import { shallow } from 'enzyme';
import StudentRoomToolbar from './StudentRoomToolbar';
import useRoomState from '../../../hooks/useRoomState/useRoomState';

jest.mock('../../../hooks/useRoomState/useRoomState');

const mockUseRoomState = useRoomState as jest.Mock<any>;

describe('StudentRoomToolbar', () => {
  beforeEach(() => {
    mockUseRoomState.mockImplementation(() => 'connected');
  });

  it('renders student-safe controls and end call', () => {
    const wrapper = shallow(<StudentRoomToolbar />);
    expect(wrapper.find('ToggleAudioButton').exists()).toBe(true);
    expect(wrapper.find('ToggleVideoButton').exists()).toBe(true);
    expect(wrapper.find('ToggleCaptionsButton').exists()).toBe(true);
    expect(wrapper.find('RaiseHandButton').exists()).toBe(true);
    expect(wrapper.find('EndCallButton').exists()).toBe(true);
    expect(wrapper.find('ToggleChatButton').exists()).toBe(false);
    expect(wrapper.find('ToggleAttentionButton').exists()).toBe(false);
    expect(wrapper.find('Menu').exists()).toBe(false);
  });

  it('disables media controls while reconnecting', () => {
    mockUseRoomState.mockImplementationOnce(() => 'reconnecting');
    const wrapper = shallow(<StudentRoomToolbar />);
    expect(wrapper.find('ToggleAudioButton').prop('disabled')).toBe(true);
    expect(wrapper.find('ToggleVideoButton').prop('disabled')).toBe(true);
    expect(wrapper.find('ToggleCaptionsButton').prop('disabled')).toBe(true);
  });

  describe('screen-share button', () => {
    it('renders the screen-share button on desktop', () => {
      const wrapper = shallow(<StudentRoomToolbar />);
      // isMobile is false in the jsdom test environment, so the button is visible.
      expect(wrapper.find('ToggleScreenShareButton').exists()).toBe(true);
    });
  });
});
