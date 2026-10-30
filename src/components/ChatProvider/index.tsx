import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { Client } from '@twilio/conversations';
import { Conversation } from '@twilio/conversations/';
import { Message } from '@twilio/conversations/';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import { useTranslation } from 'react-i18next';
import { i18n as I18nInstance } from 'i18next';

// Keep app-created errors readable in the current language even while a dialog is open.
function chatError(i18n: I18nInstance, key: string, fallback: string): Error {
  const error = new Error();
  Object.defineProperty(error, 'message', { configurable: true, get: () => i18n.t(key, { defaultValue: fallback }) });
  return error;
}

type ChatContextType = {
  isChatWindowOpen: boolean;
  setIsChatWindowOpen: (isChatWindowOpen: boolean) => void;
  connect: (token: string) => void;
  hasUnreadMessages: boolean;
  messages: Message[];
  conversation: Conversation | null;
};

export const ChatContext = createContext<ChatContextType>(null!);

export const ChatProvider: React.FC = ({ children }) => {
  const { room, onError } = useVideoContext();
  const { i18n } = useTranslation();
  const isChatWindowOpenRef = useRef(false);
  const [isChatWindowOpen, setIsChatWindowOpen] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [chatClient, setChatClient] = useState<Client>();

  const connect = useCallback(
    (token: string) => {
      const client = new Client(token);

      const handleClientInitialized = (state: string) => {
        if (state === 'initialized') {
          // @ts-ignore
          window.chatClient = client;
          setChatClient(client);
        } else if (state === 'failed') {
          onError(chatError(i18n, 'completePreview.chatConnection', 'Hubo un problema al conectar con el servicio de conversaciones de Twilio.'));
        }
      };

      client.once('stateChanged', handleClientInitialized);
    },
    [onError, i18n]
  );

  useEffect(() => {
    if (conversation) {
      const handleMessageAdded = (message: Message) => setMessages(oldMessages => [...oldMessages, message]);
      conversation.getMessages().then(newMessages => setMessages(newMessages.items));
      conversation.on('messageAdded', handleMessageAdded);
      return () => {
        conversation.off('messageAdded', handleMessageAdded);
      };
    }
  }, [conversation]);

  useEffect(() => {
    // If the chat window is closed and there are new messages, set hasUnreadMessages to true
    if (!isChatWindowOpenRef.current && messages.length) {
      setHasUnreadMessages(true);
    }
  }, [messages]);

  useEffect(() => {
    isChatWindowOpenRef.current = isChatWindowOpen;
    if (isChatWindowOpen) setHasUnreadMessages(false);
  }, [isChatWindowOpen]);

  useEffect(() => {
    if (room && chatClient) {
      chatClient
        .getConversationByUniqueName(room.sid)
        .then(newConversation => {
          //@ts-ignore
          window.chatConversation = newConversation;
          setConversation(newConversation);
        })
        .catch(e => {
          console.error(e);
          onError(chatError(i18n, 'completePreview.chatConversation', 'Hubo un problema al obtener la conversación asociada a esta sala.'));
        });
    }
  }, [room, chatClient, onError, i18n]);

  return (
    <ChatContext.Provider
      value={{
        isChatWindowOpen,
        setIsChatWindowOpen,
        connect,
        hasUnreadMessages,
        messages,
        conversation,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
