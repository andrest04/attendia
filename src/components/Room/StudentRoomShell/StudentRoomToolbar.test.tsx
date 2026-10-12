import React from 'react';
import { shallow } from 'enzyme';
import StudentRoomToolbar from './StudentRoomToolbar';
import useRoomState from '../../../hooks/useRoomState/useRoomState';
import useScreenShareParticipant from '../../../hooks/useScreenShareParticipant/useScreenShareParticipant';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';

jest.mock('../../../hooks/useRoomState/useRoomState');
jest.mock('../../../hooks/useScreenShareParticipant/useScreenShareParticipant');
jest.mock('../../../hooks/useVideoContext/useVideoContext');

const mockUseRoomState = useRoomState as jest.Mock<any>;
const mockUseScreenShareParticipant = useScreenShareParticipant as jest.Mock<any>;
const mockUseVideoContext = useVideoContext as jest.Mock<any>;

const mockToggleScreenShare = jest.fn();

// The kebab is its own component (OverflowMenu), so the toolbar's shallow tree only holds the
// element: dive into it to reach the kebab and the menu items it renders.
function moreMenu(wrapper: ReturnType<typeof shallow>) {
  return wrapper.find('OverflowMenu').dive();
}

// Screen share lives behind the kebab, so those assertions need the menu opened first.
// Returns the menu's own wrapper.
function openMore(wrapper: ReturnType<typeof shallow>) {
  const menu = moreMenu(wrapper);
  menu.find('[data-testid="student-toolbar-more"]').simulate('click');
  return menu;
}

describe('StudentRoomToolbar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRoomState.mockImplementation(() => 'connected');
    mockUseScreenShareParticipant.mockImplementation(() => undefined);
    mockUseVideoContext.mockImplementation(() => ({
      isSharingScreen: false,
      toggleScreenShare: mockToggleScreenShare,
    }));
    // jsdom has no mediaDevices; the kebab's screen-share item needs getDisplayMedia to exist.
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getDisplayMedia: () => Promise.resolve() },
    });
  });

  it('renders primary controls in the bar and secondary controls behind the kebab', () => {
    const wrapper = shallow(<StudentRoomToolbar />);
    // Primary bar: mic, camera, participants, chat, raise hand, more, leave.
    expect(wrapper.find('ToggleAudioButton').exists()).toBe(true);
    expect(wrapper.find('ToggleVideoButton').exists()).toBe(true);
    expect(wrapper.find('[data-testid="student-toolbar-participants"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="student-toolbar-chat"]').exists()).toBe(true);
    expect(wrapper.find('RaiseHandButton').exists()).toBe(true);
    expect(
      moreMenu(wrapper)
        .find('[data-testid="student-toolbar-more"]')
        .exists()
    ).toBe(true);
    expect(wrapper.find('EndCallButton').exists()).toBe(true);
    // Secondary controls stay hidden until the kebab is opened.
    expect(
      moreMenu(wrapper)
        .find('[data-testid="student-toolbar-more-menu"]')
        .exists()
    ).toBe(false);
  });

  it('disables media controls while reconnecting', () => {
    mockUseRoomState.mockImplementationOnce(() => 'reconnecting');
    const wrapper = shallow(<StudentRoomToolbar />);
    expect(wrapper.find('ToggleAudioButton').prop('disabled')).toBe(true);
    expect(wrapper.find('ToggleVideoButton').prop('disabled')).toBe(true);
  });

  describe('rail toggles', () => {
    it('toggles the Participantes rail through its callback and reflects open state', () => {
      const onParticipantsToggle = jest.fn();
      const wrapper = shallow(
        <StudentRoomToolbar participantsOpen={false} onParticipantsToggle={onParticipantsToggle} />
      );
      const button = wrapper.find('[data-testid="student-toolbar-participants"]');
      expect(button.prop('aria-pressed')).toBe(false);

      button.simulate('click');
      expect(onParticipantsToggle).toHaveBeenCalled();
    });

    it('toggles the Chat rail through its callback and reflects open state', () => {
      const onChatToggle = jest.fn();
      const wrapper = shallow(<StudentRoomToolbar chatOpen onChatToggle={onChatToggle} />);
      const button = wrapper.find('[data-testid="student-toolbar-chat"]');
      expect(button.prop('aria-pressed')).toBe(true);

      button.simulate('click');
      expect(onChatToggle).toHaveBeenCalled();
    });
  });

  describe('screen-share menu item', () => {
    it('does not render the screen-share chip in the primary bar', () => {
      const wrapper = shallow(<StudentRoomToolbar />);
      expect(wrapper.find('ToggleScreenShareButton').exists()).toBe(false);
    });

    it('toggles screen share from the kebab and closes the menu', () => {
      const wrapper = shallow(<StudentRoomToolbar />);
      const menu = openMore(wrapper);
      const item = menu.find('[data-testid="student-toolbar-screenshare"]');
      expect(item.text()).toContain('Compartir pantalla');
      expect(item.prop('disabled')).toBe(false);

      item.simulate('click');
      expect(mockToggleScreenShare).toHaveBeenCalled();
      expect(menu.find('[data-testid="student-toolbar-more-menu"]').exists()).toBe(false);
    });

    it('offers to stop sharing while the student is sharing their screen', () => {
      mockUseVideoContext.mockImplementation(() => ({
        isSharingScreen: true,
        toggleScreenShare: mockToggleScreenShare,
      }));
      const wrapper = shallow(<StudentRoomToolbar />);
      const menu = openMore(wrapper);
      expect(menu.find('[data-testid="student-toolbar-screenshare"]').text()).toContain('Dejar de compartir');
    });

    it('disables the item while someone else is sharing their screen', () => {
      mockUseScreenShareParticipant.mockImplementation(() => ({ identity: 'teacher' }));
      const wrapper = shallow(<StudentRoomToolbar />);
      const menu = openMore(wrapper);
      expect(menu.find('[data-testid="student-toolbar-screenshare"]').prop('disabled')).toBe(true);
    });

    it('disables the item when the browser does not support screen sharing', () => {
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
      const wrapper = shallow(<StudentRoomToolbar />);
      const menu = openMore(wrapper);
      expect(menu.find('[data-testid="student-toolbar-screenshare"]').prop('disabled')).toBe(true);
    });
  });
});
