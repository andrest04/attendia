import React from 'react';
import { Button, createStyles, Grid, Hidden, makeStyles, Theme } from '@material-ui/core';
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import VisibilityIcon from '@material-ui/icons/Visibility';
import { isMobile } from '../../../utils';
import useRoomState from '../../../hooks/useRoomState/useRoomState';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';
import ToggleAudioButton from '../../Buttons/ToggleAudioButton/ToggleAudioButton';
import ToggleVideoButton from '../../Buttons/ToggleVideoButton/ToggleVideoButton';
import ToggleScreenShareButton from '../../Buttons/ToogleScreenShareButton/ToggleScreenShareButton';
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

interface ProfessorToolbarProps {
  /** REC indicator state. Local-only stub until recording rules are wired (US12). */
  recording?: boolean;
  onRecordingChange?: (next: boolean) => void;
  /** Proctoring monitoring state. Local-only stub until the CV pipeline lands (US30). */
  proctoringEnabled?: boolean;
  onProctoringChange?: (next: boolean) => void;
}

export default function ProfessorToolbar({
  recording = false,
  onRecordingChange,
  proctoringEnabled = false,
  onProctoringChange,
}: ProfessorToolbarProps = {}) {
  const classes = useStyles();
  const { isSharingScreen } = useVideoContext();
  const roomState = useRoomState();
  const isReconnecting = roomState === 'reconnecting';

  return (
    <Grid container alignItems="center" className={classes.controlsRow} data-testid="professor-toolbar">
      <ToggleAudioButton disabled={isReconnecting} />
      <ToggleVideoButton disabled={isReconnecting} />
      {!isSharingScreen && !isMobile && <ToggleScreenShareButton disabled={isReconnecting} />}
      <Button
        onClick={() => onRecordingChange?.(!recording)}
        startIcon={<FiberManualRecordIcon style={{ color: recording ? '#E22525' : undefined }} />}
        data-testid="professor-toolbar-record"
        aria-pressed={recording}
      >
        {recording ? 'Detener REC' : 'Grabar'}
      </Button>
      <Button
        onClick={() => onProctoringChange?.(!proctoringEnabled)}
        startIcon={<VisibilityIcon />}
        data-testid="professor-toolbar-proctoring"
        aria-pressed={proctoringEnabled}
      >
        Proctoring
      </Button>
      <Hidden smDown>
        <div className={classes.endCallContainer}>
          <EndCallButton />
        </div>
      </Hidden>
    </Grid>
  );
}
