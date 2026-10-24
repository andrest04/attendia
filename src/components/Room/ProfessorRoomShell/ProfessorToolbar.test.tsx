import React from 'react';
import { shallow } from 'enzyme';
import ProfessorToolbar from './ProfessorToolbar';
import useChatContext from '../../../hooks/useChatContext/useChatContext';
import useIsRecording from '../../../hooks/useIsRecording/useIsRecording';
import useRoomState from '../../../hooks/useRoomState/useRoomState';
import useScreenShareParticipant from '../../../hooks/useScreenShareParticipant/useScreenShareParticipant';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';
import { useAppState } from '../../../state';

jest.mock('../../../hooks/useChatContext/useChatContext');
jest.mock('../../../hooks/useIsRecording/useIsRecording');
jest.mock('../../../hooks/useRoomState/useRoomState');
jest.mock('../../../hooks/useScreenShareParticipant/useScreenShareParticipant');
jest.mock('../../../hooks/useVideoContext/useVideoContext');
jest.mock('../../../state');

const mockUseChatContext = useChatContext as jest.Mock<any>;
const mockUseIsRecording = useIsRecording as jest.Mock<any>;
const mockUseRoomState = useRoomState as jest.Mock<any>;
const mockUseScreenShareParticipant = useScreenShareParticipant as jest.Mock<any>;
const mockUseVideoContext = useVideoContext as jest.Mock<any>;
const mockUseAppState = useAppState as jest.Mock<any>;

const mockUpdateRecordingRules = jest.fn();
const mockToggleScreenShare = jest.fn();

// The kebab is its own component (OverflowMenu), so the toolbar's shallow tree only holds the
// element: dive into it to reach the kebab and the menu items it renders.
function moreMenu(wrapper: ReturnType<typeof shallow>) {
  return wrapper.find('OverflowMenu').dive();
}

// Screen share, attention, record and proctoring live behind the kebab, so most assertions
// need the menu opened first. Returns the menu's own wrapper.
function openMore(wrapper: ReturnType<typeof shallow>) {
  const menu = moreMenu(wrapper);
  menu.find('[data-testid="professor-toolbar-more"]').simulate('click');
  return menu;
}

describe('ProfessorToolbar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseChatContext.mockImplementation(() => ({
      conversation: { sid: 'CH123' },
      hasUnreadMessages: false,
    }));
    mockUseIsRecording.mockImplementation(() => false);
    mockUseRoomState.mockImplementation(() => 'connected');
    mockUseScreenShareParticipant.mockImplementation(() => undefined);
    mockUseVideoContext.mockImplementation(() => ({
      isSharingScreen: false,
      toggleScreenShare: mockToggleScreenShare,
      room: { sid: 'RM123' },
    }));
    // jsdom has no mediaDevices; the kebab's screen-share item needs getDisplayMedia to exist.
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getDisplayMedia: () => Promise.resolve() },
    });
    mockUseAppState.mockImplementation(() => ({
      updateRecordingRules: mockUpdateRecordingRules,
      isFetching: false,
      roomType: 'group',
    }));
  });

  it('renders primary controls in the bar and secondary controls behind the kebab', () => {
    const wrapper = shallow(<ProfessorToolbar />);
    // Primary bar: mic, camera, chat, more, leave.
    expect(wrapper.find('ToggleAudioButton').exists()).toBe(true);
    expect(wrapper.find('ToggleVideoButton').exists()).toBe(true);
    expect(wrapper.find('[data-testid="professor-toolbar-chat"]').exists()).toBe(true);
    expect(
      moreMenu(wrapper)
        .find('[data-testid="professor-toolbar-more"]')
        .exists()
    ).toBe(true);
    expect(wrapper.find('EndCallButton').exists()).toBe(true);
    // Secondary controls stay hidden until the kebab is opened.
    const menu = moreMenu(wrapper);
    expect(menu.find('[data-testid="professor-toolbar-more-menu"]').exists()).toBe(false);
    expect(menu.find('[data-testid="professor-toolbar-record"]').exists()).toBe(false);
    expect(menu.find('[data-testid="professor-toolbar-proctoring"]').exists()).toBe(false);
    // Teachers do not get the student-only raise-hand control.
    expect(wrapper.find('RaiseHandButton').exists()).toBe(false);
  });

  it('reveals screen share, attention, record and proctoring inside the kebab menu', () => {
    const wrapper = shallow(<ProfessorToolbar />);
    const menu = openMore(wrapper);
    expect(menu.find('[data-testid="professor-toolbar-more-menu"]').exists()).toBe(true);
    expect(menu.find('[data-testid="professor-toolbar-screenshare"]').exists()).toBe(true);
    expect(menu.find('[data-testid="professor-toolbar-attention"]').exists()).toBe(true);
    expect(menu.find('[data-testid="professor-toolbar-record"]').exists()).toBe(true);
    expect(menu.find('[data-testid="professor-toolbar-proctoring"]').exists()).toBe(true);
  });

  describe('rail toggles', () => {
    it('toggles the Participantes rail through its callback and reflects open state', () => {
      const onParticipantsToggle = jest.fn();
      const wrapper = shallow(
        <ProfessorToolbar participantsOpen={false} onParticipantsToggle={onParticipantsToggle} />
      );
      const button = wrapper.find('[data-testid="professor-toolbar-participants"]');
      expect(button.prop('aria-pressed')).toBe(false);

      button.simulate('click');
      expect(onParticipantsToggle).toHaveBeenCalled();
    });

    it('marks the Participantes button pressed while the rail is open', () => {
      const wrapper = shallow(<ProfessorToolbar participantsOpen />);
      expect(wrapper.find('[data-testid="professor-toolbar-participants"]').prop('aria-pressed')).toBe(true);
    });

    it('toggles the attention panel from the kebab and advertises the target action', () => {
      const onAttentionToggle = jest.fn();
      const wrapper = shallow(<ProfessorToolbar attentionOpen={false} onAttentionToggle={onAttentionToggle} />);
      const menu = openMore(wrapper);
      const item = menu.find('[data-testid="professor-toolbar-attention"]');
      expect(item.text()).toContain('Panel de atención');

      item.simulate('click');
      expect(onAttentionToggle).toHaveBeenCalled();
    });

    it('offers to hide the attention panel while it is open', () => {
      const wrapper = shallow(<ProfessorToolbar attentionOpen onAttentionToggle={jest.fn()} />);
      const menu = openMore(wrapper);
      expect(menu.find('[data-testid="professor-toolbar-attention"]').text()).toContain('Ocultar atención');
    });
  });

  describe('screen-share menu item', () => {
    it('does not render the screen-share chip in the primary bar', () => {
      const wrapper = shallow(<ProfessorToolbar />);
      expect(wrapper.find('ToggleScreenShareButton').exists()).toBe(false);
    });

    it('toggles screen share from the kebab and closes the menu', () => {
      const wrapper = shallow(<ProfessorToolbar />);
      const menu = openMore(wrapper);
      const item = menu.find('[data-testid="professor-toolbar-screenshare"]');
      expect(item.text()).toContain('Compartir pantalla');
      expect(item.prop('disabled')).toBe(false);

      item.simulate('click');
      expect(mockToggleScreenShare).toHaveBeenCalled();
      expect(menu.find('[data-testid="professor-toolbar-more-menu"]').exists()).toBe(false);
    });

    it('offers to stop sharing while the professor is sharing their screen', () => {
      mockUseVideoContext.mockImplementation(() => ({
        isSharingScreen: true,
        toggleScreenShare: mockToggleScreenShare,
        room: { sid: 'RM123' },
      }));
      const wrapper = shallow(<ProfessorToolbar />);
      const menu = openMore(wrapper);
      const item = menu.find('[data-testid="professor-toolbar-screenshare"]');
      expect(item.text()).toContain('Dejar de compartir');
      expect(item.prop('disabled')).toBe(false);
    });

    it('disables the item while someone else is sharing their screen', () => {
      mockUseScreenShareParticipant.mockImplementation(() => ({ identity: 'student' }));
      const wrapper = shallow(<ProfessorToolbar />);
      const menu = openMore(wrapper);
      expect(menu.find('[data-testid="professor-toolbar-screenshare"]').prop('disabled')).toBe(true);
    });

    it('disables the item when the browser does not support screen sharing', () => {
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
      const wrapper = shallow(<ProfessorToolbar />);
      const menu = openMore(wrapper);
      expect(menu.find('[data-testid="professor-toolbar-screenshare"]').prop('disabled')).toBe(true);
    });
  });

  it('disables media controls while reconnecting', () => {
    mockUseRoomState.mockImplementationOnce(() => 'reconnecting');
    const wrapper = shallow(<ProfessorToolbar />);
    expect(wrapper.find('ToggleAudioButton').prop('disabled')).toBe(true);
    expect(wrapper.find('ToggleVideoButton').prop('disabled')).toBe(true);
  });

  it('toggles proctoring through its callback', () => {
    const onProctoringChange = jest.fn();
    const wrapper = shallow(<ProfessorToolbar proctoringEnabled={false} onProctoringChange={onProctoringChange} />);

    const menu = openMore(wrapper);
    menu.find('[data-testid="professor-toolbar-proctoring"]').simulate('click');
    expect(onProctoringChange).toHaveBeenCalledWith(true);
  });

  describe('record menu item', () => {
    it('starts a real recording through recording rules when idle', () => {
      const wrapper = shallow(<ProfessorToolbar />);
      const menu = openMore(wrapper);
      const item = menu.find('[data-testid="professor-toolbar-record"]');
      expect(item.text()).toContain('Grabar');

      item.simulate('click');
      expect(mockUpdateRecordingRules).toHaveBeenCalledWith('RM123', [{ type: 'include', all: true }]);
    });

    it('stops the recording through recording rules while recording', () => {
      mockUseIsRecording.mockImplementation(() => true);
      const wrapper = shallow(<ProfessorToolbar />);
      const menu = openMore(wrapper);
      const item = menu.find('[data-testid="professor-toolbar-record"]');
      expect(item.text()).toContain('Detener grabación');

      item.simulate('click');
      expect(mockUpdateRecordingRules).toHaveBeenCalledWith('RM123', [{ type: 'exclude', all: true }]);
    });

    it('hides the record item in rooms without recording support', () => {
      mockUseAppState.mockImplementation(() => ({
        updateRecordingRules: mockUpdateRecordingRules,
        isFetching: false,
        roomType: 'go',
      }));
      const wrapper = shallow(<ProfessorToolbar />);
      const menu = openMore(wrapper);
      expect(menu.find('[data-testid="professor-toolbar-record"]').exists()).toBe(false);
    });

    it('keeps the record item for a co-teacher (they can start and stop a recording)', () => {
      const wrapper = shallow(<ProfessorToolbar isCoTeacher />);
      const menu = openMore(wrapper);
      expect(menu.find('[data-testid="professor-toolbar-record"]').exists()).toBe(true);
      expect(menu.find('[data-testid="professor-toolbar-attention"]').exists()).toBe(true);
    });

    it('disables the record item while a recording request is in flight', () => {
      mockUseAppState.mockImplementation(() => ({
        updateRecordingRules: mockUpdateRecordingRules,
        isFetching: true,
        roomType: 'group',
      }));
      const wrapper = shallow(<ProfessorToolbar />);
      const menu = openMore(wrapper);
      expect(menu.find('[data-testid="professor-toolbar-record"]').prop('disabled')).toBe(true);
    });
  });

  describe('chat chip', () => {
    it('renders the chat chip and toggles through the callback', () => {
      const onChatToggle = jest.fn();
      const wrapper = shallow(<ProfessorToolbar chatOpen={false} onChatToggle={onChatToggle} />);

      const chip = wrapper.find('[data-testid="professor-toolbar-chat"]');
      expect(chip.exists()).toBe(true);
      expect(chip.prop('aria-pressed')).toBe(false);

      chip.simulate('click');
      expect(onChatToggle).toHaveBeenCalled();
    });

    it('reflects the open state through aria-pressed', () => {
      const wrapper = shallow(<ProfessorToolbar chatOpen />);
      expect(wrapper.find('[data-testid="professor-toolbar-chat"]').prop('aria-pressed')).toBe(true);
    });

    it('is disabled until the conversation is ready', () => {
      mockUseChatContext.mockImplementationOnce(() => ({ conversation: null, hasUnreadMessages: false }));
      const wrapper = shallow(<ProfessorToolbar />);
      expect(wrapper.find('[data-testid="professor-toolbar-chat"]').prop('disabled')).toBe(true);
    });

    it('shows the unread dot only when there are unread messages', () => {
      // The dot lives inside the chip's startIcon prop, which shallow rendering does not
      // traverse — render the prop element itself to assert on it.
      const renderStartIcon = (toolbar: ReturnType<typeof shallow>) =>
        shallow(toolbar.find('[data-testid="professor-toolbar-chat"]').prop('startIcon') as React.ReactElement);

      mockUseChatContext.mockImplementationOnce(() => ({
        conversation: { sid: 'CH123' },
        hasUnreadMessages: true,
      }));
      const withUnread = renderStartIcon(shallow(<ProfessorToolbar />));
      expect(withUnread.find('[data-testid="professor-toolbar-chat-unread"]').exists()).toBe(true);

      const withoutUnread = renderStartIcon(shallow(<ProfessorToolbar />));
      expect(withoutUnread.find('[data-testid="professor-toolbar-chat-unread"]').exists()).toBe(false);
    });
  });
});
