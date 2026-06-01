import React from 'react';
import { shallow } from 'enzyme';
import { BaseChatWindow } from './ChatWindow';
import useChatContext from '../../hooks/useChatContext/useChatContext';

jest.mock('../../hooks/useChatContext/useChatContext');

const mockUseChatContext = useChatContext as jest.Mock<any>;

describe('ChatWindow embedded mode', () => {
  beforeEach(() => {
    mockUseChatContext.mockImplementation(() => ({
      isChatWindowOpen: true,
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
});
