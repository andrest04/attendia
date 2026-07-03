import React, { useState } from 'react';
import clsx from 'clsx';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@material-ui/core';
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
    // Dialog action buttons.
    endForAll: {
      color: '#ef4444',
      fontWeight: 700,
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
  /**
   * Teacher-only. When provided, clicking opens a confirm dialog offering "end the
   * session for everyone" (completes the Twilio room) alongside a plain "leave". Absent
   * (students) → clicking leaves directly, keeping the room alive for the rest of the class.
   */
  onEndForAll?: () => void;
  /**
   * Teacher-only. Replaces the default plain-leave behavior (clear rejoin +
   * disconnect) so the professor shell can snapshot the attention report before
   * disconnecting (useSessionEnd's leaveWithoutEnding). Absent (students) → the
   * default leave runs unchanged.
   */
  onLeave?: () => void;
}

export default function EndCallButton(props: EndCallButtonProps = {}) {
  const classes = useStyles();
  const { room } = useVideoContext();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Leaving on purpose must not auto-rejoin on the next refresh, so drop the saved
  // session here. A page refresh disconnects via 'beforeunload' instead, which does
  // not run this handler — that path keeps the session and reconnects.
  const defaultLeave = () => {
    clearRejoinSession();
    // Optional-chain: a refresh ('beforeunload') or a double-click race can have
    // already disconnected and nulled the room — calling disconnect() then throws.
    room?.disconnect();
  };

  const handleLeave = props.onLeave ?? defaultLeave;

  const handleClick = () => {
    // Teachers get the choice (leave vs end for everyone); students just leave.
    if (props.onEndForAll) {
      setIsDialogOpen(true);
    } else {
      handleLeave();
    }
  };

  const handleEndForAll = () => {
    setIsDialogOpen(false);
    props.onEndForAll?.();
  };

  return (
    <>
      <Button
        onClick={handleClick}
        startIcon={props.startIcon ?? <ExitToAppIcon />}
        className={clsx(props.dark ? classes.dark : classes.button, props.className)}
        data-cy-disconnect
      >
        {props.label ?? 'Salir'}
      </Button>

      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} data-testid="end-call-dialog">
        <DialogTitle>¿Terminar la sesión?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Podés salir vos solo y dejar la clase abierta para que los estudiantes sigan, o terminar la sesión para
            todos y cerrar la sala.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDialogOpen(false)} data-testid="end-call-cancel">
            Cancelar
          </Button>
          <Button onClick={handleLeave} data-testid="end-call-leave">
            Salir sin cerrar
          </Button>
          <Button onClick={handleEndForAll} className={classes.endForAll} data-testid="end-call-end-for-all">
            Terminar para todos
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
