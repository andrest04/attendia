import React from 'react';
import { createStyles, makeStyles, Theme } from '@material-ui/core';
import { isMobile } from '../../../utils';
import useRoomState from '../../../hooks/useRoomState/useRoomState';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';
import ToggleAudioButton from '../../Buttons/ToggleAudioButton/ToggleAudioButton';
import ToggleVideoButton from '../../Buttons/ToggleVideoButton/ToggleVideoButton';
import ToggleCaptionsButton from '../../Buttons/ToggleCaptionsButton/ToggleCaptionsButton';
import ToggleScreenShareButton from '../../Buttons/ToogleScreenShareButton/ToggleScreenShareButton';
import RaiseHandButton from '../../Buttons/RaiseHandButton/RaiseHandButton';
import EndCallButton from '../../Buttons/EndCallButton/EndCallButton';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    controlsRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing(1.75),
    },
    divider: {
      width: 1,
      height: 44,
      backgroundColor: '#e2ecf9',
      flexShrink: 0,
      margin: '0 6px',
    },
  })
);

interface StudentRoomToolbarProps {
  handRaised?: boolean;
  onHandRaisedChange?: (next: boolean) => void;
}

export default function StudentRoomToolbar({ handRaised, onHandRaisedChange }: StudentRoomToolbarProps = {}) {
  const classes = useStyles();
  const { isSharingScreen } = useVideoContext();
  const roomState = useRoomState();
  const isReconnecting = roomState === 'reconnecting';

  return (
    <div className={classes.controlsRow} data-testid="student-room-toolbar">
      <ToggleAudioButton disabled={isReconnecting} />
      <ToggleVideoButton disabled={isReconnecting} />
      <ToggleCaptionsButton disabled={isReconnecting} />
      {!isSharingScreen && !isMobile && <ToggleScreenShareButton disabled={isReconnecting} />}
      <RaiseHandButton handRaised={handRaised} onHandRaisedChange={onHandRaisedChange} />
      <div className={classes.divider} />
      <EndCallButton />
    </div>
  );
}
