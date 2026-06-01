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
  })
);

export default function EndCallButton(props: { className?: string }) {
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
    <Button onClick={handleEndCall} className={clsx(classes.button, props.className)} data-cy-disconnect>
      Salir
    </Button>
  );
}
