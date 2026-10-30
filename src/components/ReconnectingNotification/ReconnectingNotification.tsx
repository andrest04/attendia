import React from 'react';
import { useTranslation } from 'react-i18next';
import Snackbar from '../Snackbar/Snackbar';
import useRoomState from '../../hooks/useRoomState/useRoomState';

export default function ReconnectingNotification() {
  const roomState = useRoomState();
  const { t } = useTranslation();

  return (
    <Snackbar
      variant="error"
      headline={t('connectionNotice.lost')}
      message={t('connectionNotice.reconnecting')}
      open={roomState === 'reconnecting'}
    />
  );
}
