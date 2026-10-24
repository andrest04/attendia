import React from 'react';
import { Button, createStyles, makeStyles, Theme, Typography } from '@material-ui/core';
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline';
import { useAppState } from '../../state';
import { t } from '../../i18n/translate';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: theme.spacing(3),
      backgroundColor: '#f0f5ff',
    },
    icon: {
      fontSize: 64,
      color: '#1d6eed',
      marginBottom: theme.spacing(2),
    },
    title: {
      fontFamily: 'Poppins, Inter, sans-serif',
      fontWeight: 700,
      color: '#1d2f6f',
      marginBottom: theme.spacing(1),
    },
    subtitle: {
      fontFamily: 'Inter, sans-serif',
      color: '#64748b',
      maxWidth: 420,
      marginBottom: theme.spacing(3),
    },
    button: {
      background: '#1d2f6f',
      color: '#ffffff',
      borderRadius: 12,
      padding: '10px 24px',
      fontFamily: 'Poppins, Inter, sans-serif',
      fontWeight: 700,
      textTransform: 'none',
      '&:hover': { background: '#152356' },
    },
  })
);

/**
 * Full-screen "the class has ended" state shown after the teacher ends the session for
 * everyone. App renders this (instead of the prejoin lobby) while
 * `sessionEndedByProfessor` is set, so students land on a clear message rather than
 * silently being dropped back to the join screen. "Volver al inicio" clears the flag,
 * which returns App to the normal prejoin flow.
 */
export default function SessionEndedScreen() {
  const classes = useStyles();
  const { setSessionEndedByProfessor } = useAppState();

  return (
    <div className={classes.root} data-testid="session-ended-screen">
      <CheckCircleOutlineIcon className={classes.icon} />
      <Typography variant="h5" className={classes.title}>
        {t('La sesión finalizó')}
      </Typography>
      <Typography variant="body1" className={classes.subtitle}>
        {t('El docente terminó la clase. Gracias por participar.')}
      </Typography>
      <Button
        className={classes.button}
        onClick={() => setSessionEndedByProfessor(false)}
        data-testid="session-ended-home"
      >
        {t('Volver al inicio')}
      </Button>
    </div>
  );
}
