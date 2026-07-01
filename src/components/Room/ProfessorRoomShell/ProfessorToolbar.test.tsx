import React from 'react';
import { shallow } from 'enzyme';
import ProfessorToolbar from './ProfessorToolbar';
import useChatContext from '../../../hooks/useChatContext/useChatContext';
import useIsRecording from '../../../hooks/useIsRecording/useIsRecording';
import useRoomState from '../../../hooks/useRoomState/useRoomState';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';
import { useAppState } from '../../../state';

jest.mock('../../../hooks/useChatContext/useChatContext');
jest.mock('../../../hooks/useIsRecording/useIsRecording');
jest.mock('../../../hooks/useRoomState/useRoomState');
jest.mock('../../../hooks/useVideoContext/useVideoContext');
jest.mock('../../../state');

const mockUseChatContext = useChatContext as jest.Mock<any>;
const mockUseIsRecording = useIsRecording as jest.Mock<any>;
const mockUseRoomState = useRoomState as jest.Mock<any>;
const mockUseVideoContext = useVideoContext as jest.Mock<any>;
const mockUseAppState = useAppState as jest.Mock<any>;

const mockUpdateRecordingRules = jest.fn();
const mockSetIsGalleryViewActive = jest.fn();

// View, record and proctoring now live behind the "more options" kebab, so most
// assertions need the menu opened first.
function openMore(wrapper: ReturnType<typeof shallow>) {
  wrapper.find('[data-testid="professor-toolbar-more"]').simulate('click');
  wrapper.update();
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
    mockUseVideoContext.mockImplementation(() => ({ isSharingScreen: false, room: { sid: 'RM123' } }));
    mockUseAppState.mockImplementation(() => ({
      updateRecordingRules: mockUpdateRecordingRules,
      isFetching: false,
      roomType: 'group',
      isGalleryViewActive: true,
      setIsGalleryViewActive: mockSetIsGalleryViewActive,
    }));
  });

  it('renders primary controls in the bar and secondary controls behind the kebab', () => {
    const wrapper = shallow(<ProfessorToolbar />);
    // Primary bar: mic, camera, chat, more, leave.
    expect(wrapper.find('ToggleAudioButton').exists()).toBe(true);
    expect(wrapper.find('ToggleVideoButton').exists()).toBe(true);
    expect(wrapper.find('[data-testid="professor-toolbar-chat"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="professor-toolbar-more"]').exists()).toBe(true);
    expect(wrapper.find('EndCallButton').exists()).toBe(true);
    // Secondary controls stay hidden until the kebab is opened.
    expect(wrapper.find('[data-testid="professor-toolbar-more-menu"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="professor-toolbar-record"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="professor-toolbar-proctoring"]').exists()).toBe(false);
    // Teachers do not get the student-only raise-hand control.
    expect(wrapper.find('RaiseHandButton').exists()).toBe(false);
  });

  it('reveals attention, view, record and proctoring inside the kebab menu', () => {
    const wrapper = shallow(<ProfessorToolbar />);
    openMore(wrapper);
    expect(wrapper.find('[data-testid="professor-toolbar-more-menu"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="professor-toolbar-attention"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="professor-toolbar-view"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="professor-toolbar-record"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="professor-toolbar-proctoring"]').exists()).toBe(true);
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
      openMore(wrapper);
      const item = wrapper.find('[data-testid="professor-toolbar-attention"]');
      expect(item.text()).toContain('Panel de atención');

      item.simulate('click');
      expect(onAttentionToggle).toHaveBeenCalled();
    });

    it('offers to hide the attention panel while it is open', () => {
      const wrapper = shallow(<ProfessorToolbar attentionOpen onAttentionToggle={jest.fn()} />);
      openMore(wrapper);
      expect(wrapper.find('[data-testid="professor-toolbar-attention"]').text()).toContain('Ocultar atención');
    });
  });

  describe('screen-share button', () => {
    it('renders the screen-share button when not sharing', () => {
      const wrapper = shallow(<ProfessorToolbar />);
      expect(wrapper.find('ToggleScreenShareButton').exists()).toBe(true);
    });

    it('still renders the screen-share button while the professor is sharing their screen', () => {
      mockUseVideoContext.mockImplementationOnce(() => ({ isSharingScreen: true, room: { sid: 'RM123' } }));
      const wrapper = shallow(<ProfessorToolbar />);
      expect(wrapper.find('ToggleScreenShareButton').exists()).toBe(true);
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

    openMore(wrapper);
    wrapper.find('[data-testid="professor-toolbar-proctoring"]').simulate('click');
    expect(onProctoringChange).toHaveBeenCalledWith(true);
  });

  describe('record menu item', () => {
    it('starts a real recording through recording rules when idle', () => {
      const wrapper = shallow(<ProfessorToolbar />);
      openMore(wrapper);
      const item = wrapper.find('[data-testid="professor-toolbar-record"]');
      expect(item.text()).toContain('Grabar');

      item.simulate('click');
      expect(mockUpdateRecordingRules).toHaveBeenCalledWith('RM123', [{ type: 'include', all: true }]);
    });

    it('stops the recording through recording rules while recording', () => {
      mockUseIsRecording.mockImplementation(() => true);
      const wrapper = shallow(<ProfessorToolbar />);
      openMore(wrapper);
      const item = wrapper.find('[data-testid="professor-toolbar-record"]');
      expect(item.text()).toContain('Detener grabación');

      item.simulate('click');
      expect(mockUpdateRecordingRules).toHaveBeenCalledWith('RM123', [{ type: 'exclude', all: true }]);
    });

    it('hides the record item in rooms without recording support', () => {
      mockUseAppState.mockImplementation(() => ({
        updateRecordingRules: mockUpdateRecordingRules,
        isFetching: false,
        roomType: 'go',
        isGalleryViewActive: true,
        setIsGalleryViewActive: mockSetIsGalleryViewActive,
      }));
      const wrapper = shallow(<ProfessorToolbar />);
      openMore(wrapper);
      expect(wrapper.find('[data-testid="professor-toolbar-record"]').exists()).toBe(false);
    });

    it('disables the record item while a recording request is in flight', () => {
      mockUseAppState.mockImplementation(() => ({
        updateRecordingRules: mockUpdateRecordingRules,
        isFetching: true,
        roomType: 'group',
        isGalleryViewActive: true,
        setIsGalleryViewActive: mockSetIsGalleryViewActive,
      }));
      const wrapper = shallow(<ProfessorToolbar />);
      openMore(wrapper);
      expect(wrapper.find('[data-testid="professor-toolbar-record"]').prop('disabled')).toBe(true);
    });
  });

  describe('view toggle menu item', () => {
    it('offers speaker view while gallery view is active and toggles on click', () => {
      const wrapper = shallow(<ProfessorToolbar />);
      openMore(wrapper);
      const item = wrapper.find('[data-testid="professor-toolbar-view"]');
      expect(item.text()).toContain('Vista de orador');

      item.simulate('click');
      // The setter is localStorage-backed, so the functional updater form matters.
      expect(mockSetIsGalleryViewActive).toHaveBeenCalledWith(expect.any(Function));
      const updater = mockSetIsGalleryViewActive.mock.calls[0][0];
      expect(updater(true)).toBe(false);
      expect(updater(false)).toBe(true);
    });

    it('offers gallery view while speaker view is active', () => {
      mockUseAppState.mockImplementation(() => ({
        updateRecordingRules: mockUpdateRecordingRules,
        isFetching: false,
        roomType: 'group',
        isGalleryViewActive: false,
        setIsGalleryViewActive: mockSetIsGalleryViewActive,
      }));
      const wrapper = shallow(<ProfessorToolbar />);
      openMore(wrapper);
      expect(wrapper.find('[data-testid="professor-toolbar-view"]').text()).toContain('Vista de galería');
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
