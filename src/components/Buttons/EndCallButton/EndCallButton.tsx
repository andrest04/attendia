import React from 'react';
import clsx from 'clsx';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import { Button } from '@material-ui/core';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';
import { clearRejoinSession } from '../../PreJoinScreens/rejoinSession';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    button: {
      // attendia design: filled dark-navy rounded pill with exit icon
      background: '#1d2f6f',
      color: '#ffffff',
      borderRadius: '12px',
      padding: '10px 20px',
      fontFamily: 'Poppins, Inter, sans-serif',
      fontWeight: 700,
      fontSize: '14px',
      letterSpacing: '0.14px',
      boxShadow: '0px 4px 7px rgba(29, 47, 111, 0.3)',
      '&:hover': {
        background: '#152356',
        boxShadow: '0px 4px 10px rgba(29, 47, 111, 0.4)',
      },
      '& .MuiButton-startIcon': {
        marginRight: '6px',
        '& svg': {
          fontSize: '18px',
          color: '#ffffff',
        },
      },
    },
    dark: {
      background: '#1B2126',
      color: '#ffffff',
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
  /** Use the neutral dark surface instead of the navy surface (toolbar chip style). */
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
      startIcon={props.startIcon ?? <ExitToAppIcon />}
      className={clsx(props.dark ? classes.dark : classes.button, props.className)}
      data-cy-disconnect
    >
      {props.label ?? 'Salir'}
    </Button>
  );
}
