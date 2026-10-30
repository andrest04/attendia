import React from 'react';
import { makeStyles, createStyles } from '@material-ui/core/styles';
import CloseIcon from '../../../icons/CloseIcon';
import { useTranslation } from 'react-i18next';

import useChatContext from '../../../hooks/useChatContext/useChatContext';

const useStyles = makeStyles(() =>
  createStyles({
    container: {
      height: '56px',
      background: '#f0f5ff',
      borderBottom: '1px solid #e2ecf9',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0 1em',
      flexShrink: 0,
    },
    text: {
      fontFamily: 'Poppins, Inter, sans-serif',
      fontWeight: 700,
      fontSize: 14,
      color: '#1d2f6f',
    },
    closeChatWindow: {
      cursor: 'pointer',
      display: 'flex',
      background: 'transparent',
      border: '0',
      padding: '0.4em',
      color: '#64748b',
    },
  })
);

export default function ChatWindowHeader() {
  const classes = useStyles();
  const { t } = useTranslation('chat');
  const { t: tRoom } = useTranslation('room');
  const { setIsChatWindowOpen } = useChatContext();

  return (
    <div className={classes.container}>
      <div className={classes.text}>{t('title')}</div>
      <button className={classes.closeChatWindow} aria-label={tRoom('chat.close')} onClick={() => setIsChatWindowOpen(false)}>
        <CloseIcon />
      </button>
    </div>
  );
}
