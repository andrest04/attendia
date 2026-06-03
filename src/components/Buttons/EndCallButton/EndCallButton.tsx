import React from 'react';
import clsx from 'clsx';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';

import { Button } from '@material-ui/core';

import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';
import { clearRejoinSession } from '../../PreJoinScreens/rejoinSession';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    button: {
      background: theme.brand,
      color: 'white',
      '&:hover': {
        background: '#600101',
      },
    },
    dark: {
      background: '#1B2126',
      color: 'white',
      '&:hover': {
        background: '#0E1316',
      },
    },
  })
);

interface EndCallButtonProps {
  className?: string;
  /** Defaults to "Salir". The professor shell uses "Terminar sesión" to match the wireframe. */
  label?: string;
  startIcon?: React.ReactNode;
  /** Use the neutral dark surface instead of the red brand surface (toolbar chip style). */
  dark?: boolean;
}

export default function EndCallButton(props: EndCallButtonProps = {}) {
  const classes = useStyles();
  const { room } = useVideoContext();

  // Leaving on purpose must not auto-rejoin on the next refresh, so drop the saved
  // session here. A page refresh disconnects via 'beforeunload' instead, which does
  // not run this handler — that path keeps the session and reconnects.
  const handleEndCall = () => {
    clearRejoinSession();
    room!.disconnect();
  };

  return (
    <Button
      onClick={handleEndCall}
      startIcon={props.startIcon}
      className={clsx(props.dark ? classes.dark : classes.button, props.className)}
      data-cy-disconnect
    >
      {props.label ?? 'Salir'}
    </Button>
  );
}
