import React from 'react';
import { mount } from 'enzyme';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n/createI18n';
import useChatContext from '../../hooks/useChatContext/useChatContext';
import ChatInput from './ChatInput/ChatInput';
import { BaseChatWindow } from './ChatWindow';

jest.mock('../../hooks/useChatContext/useChatContext');
const mockUseChatContext = useChatContext as jest.Mock<any>;

describe('chat in English', () => {
  let wrapper: ReturnType<typeof mount> | undefined;
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('translates the header and the connecting state', () => {
    mockUseChatContext.mockImplementation(() => ({
      isChatWindowOpen: true,
      setIsChatWindowOpen: jest.fn(),
      messages: [],
      conversation: null,
    }));
    wrapper = mount(
      <I18nextProvider i18n={createI18n({ detect: false, lng: 'en' })}>
        <BaseChatWindow />
      </I18nextProvider>
    );
    expect(wrapper.text()).toContain('Chat');
    expect(wrapper.find('[data-testid="chat-window-unavailable"]').text()).toBe('Connecting chat...');
  });

  it('translates the message input', () => {
    wrapper = mount(
      <I18nextProvider i18n={createI18n({ detect: false, lng: 'en' })}>
        <ChatInput conversation={{ sendMessage: jest.fn() } as any} isChatWindowOpen={false} />
      </I18nextProvider>
    );
    const input = wrapper.find('textarea').first();
    expect(input.prop('placeholder')).toBe('Write a message...');
    expect(input.prop('aria-label')).toBe('Chat input');
  });
});
