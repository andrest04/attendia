import React from 'react';
import { shallow } from 'enzyme';
import ProfessorToolbar from './ProfessorToolbar';
import useChatContext from '../../../hooks/useChatContext/useChatContext';
import useRoomState from '../../../hooks/useRoomState/useRoomState';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';

jest.mock('../../../hooks/useChatContext/useChatContext');
jest.mock('../../../hooks/useRoomState/useRoomState');
jest.mock('../../../hooks/useVideoContext/useVideoContext');

const mockUseChatContext = useChatContext as jest.Mock<any>;
const mockUseRoomState = useRoomState as jest.Mock<any>;
const mockUseVideoContext = useVideoContext as jest.Mock<any>;

describe('ProfessorToolbar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseChatContext.mockImplementation(() => ({
      conversation: { sid: 'CH123' },
      hasUnreadMessages: false,
    }));
    mockUseRoomState.mockImplementation(() => 'connected');
    mockUseVideoContext.mockImplementation(() => ({ isSharingScreen: false }));
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

  it('toggles recording and proctoring through callbacks', () => {
    const onRecordingChange = jest.fn();
    const onProctoringChange = jest.fn();
    const wrapper = shallow(
      <ProfessorToolbar
        recording={false}
        onRecordingChange={onRecordingChange}
        proctoringEnabled={false}
        onProctoringChange={onProctoringChange}
      />
    );

    wrapper.find('[data-testid="professor-toolbar-record"]').simulate('click');
    expect(onRecordingChange).toHaveBeenCalledWith(true);

    wrapper.find('[data-testid="professor-toolbar-proctoring"]').simulate('click');
    expect(onProctoringChange).toHaveBeenCalledWith(true);
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
