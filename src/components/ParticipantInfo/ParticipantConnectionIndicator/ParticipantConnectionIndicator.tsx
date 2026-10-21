import React from 'react';
import clsx from 'clsx';
import { makeStyles } from '@material-ui/core/styles';
import { Participant } from 'twilio-video';
import useParticipantIsReconnecting from '../../../hooks/useParticipantIsReconnecting/useParticipantIsReconnecting';
import { Tooltip } from '@material-ui/core';
import { useTranslation } from 'react-i18next';

const useStyles = makeStyles({
  indicator: {
    width: '10px',
    height: '10px',
    borderRadius: '100%',
    background: '#0c0',
    display: 'inline-block',
    marginRight: '3px',
  },
  isReconnecting: {
    background: '#ffb100',
  },
});

export default function ParticipantConnectionIndicator({ participant }: { participant: Participant }) {
  const isReconnecting = useParticipantIsReconnecting(participant);
  const classes = useStyles();
  const { t } = useTranslation('misc');
  return (
    <Tooltip title={isReconnecting ? t('tile.participantReconnecting') : t('tile.participantConnected')}>
      <span className={clsx(classes.indicator, { [classes.isReconnecting]: isReconnecting })}></span>
    </Tooltip>
  );
}
