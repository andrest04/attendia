import React from 'react';
import { mount, shallow } from 'enzyme';
import { BaseChatWindow } from './ChatWindow';
import useChatContext from '../../hooks/useChatContext/useChatContext';

jest.mock('../../hooks/useChatContext/useChatContext');

const mockUseChatContext = useChatContext as jest.Mock<any>;

const mockSetIsChatWindowOpen = jest.fn();

describe('ChatWindow embedded mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseChatContext.mockImplementation(() => ({
      isChatWindowOpen: true,
      setIsChatWindowOpen: mockSetIsChatWindowOpen,
      messages: [],
      conversation: { sid: 'CH123' },
    }));
    process.env.REACT_APP_DISABLE_TWILIO_CONVERSATIONS = 'false';
  });

  it('hides header in embedded mode and renders list/input when conversation exists', () => {
    const wrapper = shallow(<BaseChatWindow embedded isVisible />);
    expect(wrapper.find('ChatWindowHeader').exists()).toBe(false);
    expect(wrapper.find('MessageList').exists()).toBe(true);
    expect(wrapper.find('ChatInput').exists()).toBe(true);
  });

  it('shows unavailable state when conversations are disabled', () => {
    process.env.REACT_APP_DISABLE_TWILIO_CONVERSATIONS = 'true';
    const wrapper = shallow(<BaseChatWindow embedded isVisible />);
    expect(wrapper.find('[data-testid="chat-window-unavailable"]').exists()).toBe(true);
    expect(wrapper.find('ChatInput').exists()).toBe(false);
  });

  it('shows connecting state when conversation is null', () => {
    mockUseChatContext.mockImplementationOnce(() => ({
      isChatWindowOpen: true,
      messages: [],
      conversation: null,
    }));
    const wrapper = shallow(<BaseChatWindow embedded isVisible />);
    expect(wrapper.find('[data-testid="chat-window-unavailable"]').text()).toContain('Conectando chat');
  });

  it('keeps embedded chat visible even when legacy drawer flag is closed', () => {
    mockUseChatContext.mockImplementationOnce(() => ({
      isChatWindowOpen: false,
      messages: [{ sid: 'IM1', body: 'Hola' }],
      conversation: { sid: 'CH456' },
    }));

    const wrapper = shallow(<BaseChatWindow embedded isVisible />);
    expect(wrapper.find('MessageList').exists()).toBe(true);
  });

  // The embedded chat reports its visibility to ChatProvider so unread tracking stays
  // accurate (hasUnreadMessages clears while the chat tab is open). useEffect does not
  // run under enzyme's shallow renderer, so these tests use mount; the conversations
  // kill-switch keeps the mounted DOM minimal (no MessageList/ChatInput children).
  describe('open-state sync with ChatProvider', () => {
    beforeEach(() => {
      process.env.REACT_APP_DISABLE_TWILIO_CONVERSATIONS = 'true';
    });

    it('marks the chat window open while the embedded chat is visible and closed on unmount', () => {
      const wrapper = mount(<BaseChatWindow embedded isVisible />);
      expect(mockSetIsChatWindowOpen).toHaveBeenLastCalledWith(true);

      wrapper.unmount();
      expect(mockSetIsChatWindowOpen).toHaveBeenLastCalledWith(false);
    });

    it('marks the chat window closed when the embedded chat is hidden', () => {
      mount(<BaseChatWindow embedded isVisible={false} />);
      expect(mockSetIsChatWindowOpen).toHaveBeenLastCalledWith(false);
    });

    it('does not touch the flag in legacy (non-embedded) mode', () => {
      const wrapper = mount(<BaseChatWindow />);
      wrapper.unmount();
      expect(mockSetIsChatWindowOpen).not.toHaveBeenCalled();
    });
  });
});
