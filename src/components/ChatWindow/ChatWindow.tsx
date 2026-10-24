import React, { useEffect } from 'react';
import { makeStyles, createStyles, Theme } from '@material-ui/core/styles';
import ChatWindowHeader from './ChatWindowHeader/ChatWindowHeader';
import ChatInput from './ChatInput/ChatInput';
import clsx from 'clsx';
import MessageList from './MessageList/MessageList';
import useChatContext from '../../hooks/useChatContext/useChatContext';
import { featureFlags } from '../../utils/featureFlags';
import { t } from '../../i18n/translate';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    chatWindowContainer: {
      background: '#FFFFFF',
      zIndex: 9,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
      borderLeft: '1px solid #e2ecf9',
      [theme.breakpoints.down('sm')]: {
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        zIndex: 100,
      },
    },
    // When embedded inside a room shell's right rail, the rail already provides the divider,
    // so the chat fills its cell without an extra inner border.
    embedded: {
      borderLeft: 'none',
      flex: 1,
      minHeight: 0,
    },
    hide: {
      display: 'none',
    },
    unavailableMessage: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      fontFamily: 'Inter, sans-serif',
      fontSize: 13,
      color: '#64748b',
      textAlign: 'center',
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
  const { isChatWindowOpen, setIsChatWindowOpen, messages, conversation } = useChatContext();
  const isConversationsDisabled = featureFlags.isConversationsDisabled();
  const isUnavailable = isConversationsDisabled || !conversation;
  const effectiveVisible = embedded ? isVisible : isChatWindowOpen;

  // Keep ChatProvider's unread tracking accurate for embedded shells: while the embedded
  // chat is visible the window counts as "open" (clears hasUnreadMessages). The legacy
  // mobile drawer manages this flag itself, so the effect is gated on `embedded`.
  useEffect(() => {
    if (!embedded) return;
    setIsChatWindowOpen(isVisible);
    return () => setIsChatWindowOpen(false);
  }, [embedded, isVisible, setIsChatWindowOpen]);

  const unavailableMessage = isConversationsDisabled
    ? t('El chat no está disponible en esta sesión.')
    : 'Conectando chat...';

  return (
    <aside
      className={clsx(classes.chatWindowContainer, {
        [classes.embedded]: embedded,
        [classes.hide]: !effectiveVisible,
      })}
      data-testid="chat-window"
    >
      {!embedded && <ChatWindowHeader />}
      {isUnavailable ? (
        <div className={classes.unavailableMessage} data-testid="chat-window-unavailable">
          {unavailableMessage}
        </div>
      ) : (
        <>
          <MessageList messages={messages} />
          <ChatInput conversation={conversation} isChatWindowOpen={effectiveVisible} />
        </>
      )}
    </aside>
  );
}
