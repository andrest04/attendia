import React from 'react';
import { makeStyles, createStyles, Theme } from '@material-ui/core/styles';
import ChatWindowHeader from './ChatWindowHeader/ChatWindowHeader';
import ChatInput from './ChatInput/ChatInput';
import clsx from 'clsx';
import MessageList from './MessageList/MessageList';
import useChatContext from '../../hooks/useChatContext/useChatContext';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    chatWindowContainer: {
      background: '#FFFFFF',
      zIndex: 9,
      display: 'flex',
      flexDirection: 'column',
      borderLeft: '1px solid #E4E7E9',
      [theme.breakpoints.down('sm')]: {
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        zIndex: 100,
      },
    },
    hide: {
      display: 'none',
    },
  })
);

// In this component, we are toggling the visibility of the ChatWindow with CSS instead of
// conditionally rendering the component in the DOM. This is done so that the ChatWindow is
// not unmounted while a file upload is in progress.

interface ChatWindowProps {
  embedded?: boolean;
  isVisible?: boolean;
}

export default function ChatWindow(props: ChatWindowProps = {}) {
  return <BaseChatWindow {...props} />;
}

export function BaseChatWindow({ embedded = false, isVisible = true }: ChatWindowProps = {}) {
  const classes = useStyles();
  const { isChatWindowOpen, messages, conversation } = useChatContext();
  const isConversationsDisabled = process.env.REACT_APP_DISABLE_TWILIO_CONVERSATIONS === 'true';
  const isUnavailable = isConversationsDisabled || !conversation;
  const effectiveVisible = embedded ? isVisible : isChatWindowOpen;

  const unavailableMessage = isConversationsDisabled
    ? 'El chat no está disponible en esta sesión.'
    : 'Conectando chat...';

  return (
    <aside
      className={clsx(classes.chatWindowContainer, { [classes.hide]: !effectiveVisible })}
      data-testid="chat-window"
    >
      {!embedded && <ChatWindowHeader />}
      {isUnavailable ? (
        <div data-testid="chat-window-unavailable">{unavailableMessage}</div>
      ) : (
        <>
          <MessageList messages={messages} />
          <ChatInput conversation={conversation} isChatWindowOpen={effectiveVisible} />
        </>
      )}
    </aside>
  );
}
