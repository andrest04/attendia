import React from 'react';
import { shallow } from 'enzyme';
import StudentRoomToolbar from './StudentRoomToolbar';
import useRoomState from '../../../hooks/useRoomState/useRoomState';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';

jest.mock('../../../hooks/useRoomState/useRoomState');
jest.mock('../../../hooks/useVideoContext/useVideoContext');

const mockUseRoomState = useRoomState as jest.Mock<any>;
const mockUseVideoContext = useVideoContext as jest.Mock<any>;

describe('StudentRoomToolbar', () => {
  beforeEach(() => {
    mockUseRoomState.mockImplementation(() => 'connected');
    mockUseVideoContext.mockImplementation(() => ({ isSharingScreen: false }));
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
});
