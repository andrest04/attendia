import React from 'react';
import clsx from 'clsx';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';

const useStyles = makeStyles((theme: Theme) => ({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(40, 42, 43, 0.75)',
    zIndex: 1,
  },
  text: {
    color: 'white',
  },
  // Small gallery tiles shrink the message on phones.
  compactText: {
    [theme.breakpoints.down('sm')]: {
      fontSize: '0.75rem',
    },
  },
}));

/** Dims a participant's video and says they are reconnecting. */
export default function ReconnectingOverlay({ compact }: { compact?: boolean }) {
  const classes = useStyles();
  return (
    <div className={classes.overlay}>
      <Typography variant="body1" className={clsx(classes.text, { [classes.compactText]: compact })}>
        Reconnecting...
      </Typography>
    </div>
  );
}
