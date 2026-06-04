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

  it('renders teacher controls including record, proctoring and end call', () => {
    const wrapper = shallow(<ProfessorToolbar />);
    expect(wrapper.find('ToggleAudioButton').exists()).toBe(true);
    expect(wrapper.find('ToggleVideoButton').exists()).toBe(true);
    expect(wrapper.find('[data-testid="professor-toolbar-record"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="professor-toolbar-proctoring"]').exists()).toBe(true);
    expect(wrapper.find('EndCallButton').exists()).toBe(true);
    // Teachers do not get the student-only raise-hand control.
    expect(wrapper.find('RaiseHandButton').exists()).toBe(false);
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

    wrapper.find('[data-testid="professor-toolbar-proctoring"]').simulate('click');
    expect(onProctoringChange).toHaveBeenCalledWith(true);
  });

  describe('record chip', () => {
    it('starts a real recording through recording rules when idle', () => {
      const wrapper = shallow(<ProfessorToolbar />);
      const chip = wrapper.find('[data-testid="professor-toolbar-record"]');
      expect(chip.text()).toContain('Grabar');

      chip.simulate('click');
      expect(mockUpdateRecordingRules).toHaveBeenCalledWith('RM123', [{ type: 'include', all: true }]);
    });

    it('stops the recording through recording rules while recording', () => {
      mockUseIsRecording.mockImplementation(() => true);
      const wrapper = shallow(<ProfessorToolbar />);
      const chip = wrapper.find('[data-testid="professor-toolbar-record"]');
      expect(chip.text()).toContain('Detener REC');

      chip.simulate('click');
      expect(mockUpdateRecordingRules).toHaveBeenCalledWith('RM123', [{ type: 'exclude', all: true }]);
    });

    it('hides the record chip in rooms without recording support', () => {
      mockUseAppState.mockImplementationOnce(() => ({
        updateRecordingRules: mockUpdateRecordingRules,
        isFetching: false,
        roomType: 'go',
        isGalleryViewActive: true,
        setIsGalleryViewActive: mockSetIsGalleryViewActive,
      }));
      const wrapper = shallow(<ProfessorToolbar />);
      expect(wrapper.find('[data-testid="professor-toolbar-record"]').exists()).toBe(false);
    });

    it('disables the record chip while a recording request is in flight', () => {
      mockUseAppState.mockImplementationOnce(() => ({
        updateRecordingRules: mockUpdateRecordingRules,
        isFetching: true,
        roomType: 'group',
        isGalleryViewActive: true,
        setIsGalleryViewActive: mockSetIsGalleryViewActive,
      }));
      const wrapper = shallow(<ProfessorToolbar />);
      expect(wrapper.find('[data-testid="professor-toolbar-record"]').prop('disabled')).toBe(true);
    });
  });

  describe('view toggle chip', () => {
    it('offers speaker view while gallery view is active and toggles on click', () => {
      const wrapper = shallow(<ProfessorToolbar />);
      const chip = wrapper.find('[data-testid="professor-toolbar-view"]');
      expect(chip.text()).toContain('Vista de orador');

      chip.simulate('click');
      // The setter is localStorage-backed, so the functional updater form matters.
      expect(mockSetIsGalleryViewActive).toHaveBeenCalledWith(expect.any(Function));
      const updater = mockSetIsGalleryViewActive.mock.calls[0][0];
      expect(updater(true)).toBe(false);
      expect(updater(false)).toBe(true);
    });

    it('offers gallery view while speaker view is active', () => {
      mockUseAppState.mockImplementationOnce(() => ({
        updateRecordingRules: mockUpdateRecordingRules,
        isFetching: false,
        roomType: 'group',
        isGalleryViewActive: false,
        setIsGalleryViewActive: mockSetIsGalleryViewActive,
      }));
      const wrapper = shallow(<ProfessorToolbar />);
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
