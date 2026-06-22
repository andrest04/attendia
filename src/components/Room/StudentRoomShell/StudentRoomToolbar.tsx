import React from 'react';
import clsx from 'clsx';
import { createStyles, makeStyles, Theme } from '@material-ui/core';
import { isMobile } from '../../../utils';
import useRoomState from '../../../hooks/useRoomState/useRoomState';
import ToggleAudioButton from '../../Buttons/ToggleAudioButton/ToggleAudioButton';
import ToggleVideoButton from '../../Buttons/ToggleVideoButton/ToggleVideoButton';
import ToggleScreenShareButton from '../../Buttons/ToogleScreenShareButton/ToggleScreenShareButton';
import ToggleViewButton from '../../Buttons/ToggleViewButton/ToggleViewButton';
import RaiseHandButton from '../../Buttons/RaiseHandButton/RaiseHandButton';
import EndCallButton from '../../Buttons/EndCallButton/EndCallButton';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    controlsRow: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing(1),
    },
    // Vertical "chip" layout on a dark surface — identical to ProfessorToolbar so
    // both shells share the same toolbar look (icon stacked over a small caption).
    chipLayout: {
      minWidth: 78,
      padding: theme.spacing(0.75, 1.25),
      borderRadius: 8,
      '& .MuiButton-label': {
        flexDirection: 'column',
        gap: 4,
        fontSize: 11,
        fontFamily: 'Poppins, Inter, sans-serif',
        fontWeight: 600,
        lineHeight: 1.2,
        textTransform: 'none',
      },
      '& .MuiButton-startIcon': {
        margin: 0,
      },
    },
    chipDark: {
      backgroundColor: 'rgba(255,255,255,0.08)',
      color: 'rgba(255,255,255,0.8)',
      '&:hover': {
        backgroundColor: 'rgba(255,255,255,0.14)',
      },
    },
    divider: {
      width: 1,
      alignSelf: 'stretch',
      margin: theme.spacing(0.5),
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
  })
);

interface StudentRoomToolbarProps {
  handRaised?: boolean;
  onHandRaisedChange?: (next: boolean) => void;
}

export default function StudentRoomToolbar({ handRaised, onHandRaisedChange }: StudentRoomToolbarProps = {}) {
  const classes = useStyles();
  const roomState = useRoomState();
  const isReconnecting = roomState === 'reconnecting';
  const chip = clsx(classes.chipLayout, classes.chipDark);

  return (
    <div className={classes.controlsRow} data-testid="student-room-toolbar">
      <ToggleAudioButton disabled={isReconnecting} className={chip} />
      <ToggleVideoButton disabled={isReconnecting} className={chip} />
      {!isMobile && <ToggleScreenShareButton disabled={isReconnecting} className={chip} />}
      <ToggleViewButton disabled={isReconnecting} className={chip} />
      <RaiseHandButton handRaised={handRaised} onHandRaisedChange={onHandRaisedChange} className={chip} />
      <div className={classes.divider} />
      <EndCallButton />
    </div>
  );
}
