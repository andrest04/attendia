import React from 'react';
import { createStyles, Grid, Hidden, makeStyles, Theme } from '@material-ui/core';
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
      gap: theme.spacing(1),
      width: '100%',
    },
    endCallContainer: {
      marginLeft: 'auto',
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
    <Grid container alignItems="center" className={classes.controlsRow} data-testid="student-room-toolbar">
      <ToggleAudioButton disabled={isReconnecting} />
      <ToggleVideoButton disabled={isReconnecting} />
      <ToggleCaptionsButton disabled={isReconnecting} />
      {!isSharingScreen && !isMobile && <ToggleScreenShareButton disabled={isReconnecting} />}
      <RaiseHandButton handRaised={handRaised} onHandRaisedChange={onHandRaisedChange} />
      <Hidden smDown>
        <div className={classes.endCallContainer}>
          <EndCallButton />
        </div>
      </Hidden>
    </Grid>
  );
}
