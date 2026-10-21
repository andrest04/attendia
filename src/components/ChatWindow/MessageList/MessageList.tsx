import React from 'react';
import { Message } from '@twilio/conversations';
import MessageInfo from './MessageInfo/MessageInfo';
import MessageListScrollContainer from './MessageListScrollContainer/MessageListScrollContainer';
import TextMessage from './TextMessage/TextMessage';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';
import MediaMessage from './MediaMessage/MediaMessage';
import { useTranslation } from 'react-i18next';
import { formatTime } from '../../../i18n/format';

interface MessageListProps {
  messages: Message[];
}

// Lowercase keeps the compact "10:15 am" label in every language.
const getFormattedTime = (message: Message | undefined, language: string) =>
  message?.dateCreated ? formatTime(message.dateCreated, language).toLowerCase() : undefined;

export default function MessageList({ messages }: MessageListProps) {
  const { room } = useVideoContext();
  const { i18n } = useTranslation('chat');
  const localParticipant = room!.localParticipant;

  return (
    <MessageListScrollContainer messages={messages}>
      {messages.map((message, idx) => {
        const time = getFormattedTime(message, i18n.language)!;
        const previousTime = getFormattedTime(messages[idx - 1], i18n.language);

        // Display the MessageInfo component when the author or formatted timestamp differs from the previous message
        const shouldDisplayMessageInfo = time !== previousTime || message.author !== messages[idx - 1]?.author;

        const isLocalParticipant = localParticipant.identity === message.author;

        return (
          <React.Fragment key={message.sid}>
            {shouldDisplayMessageInfo && (
              <MessageInfo author={message.author!} isLocalParticipant={isLocalParticipant} dateCreated={time} />
            )}
            {message.type === 'text' && <TextMessage body={message.body!} isLocalParticipant={isLocalParticipant} />}
            {message.type === 'media' && <MediaMessage media={message.attachedMedia![0]} />}
          </React.Fragment>
        );
      })}
    </MessageListScrollContainer>
  );
}
