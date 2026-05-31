import React from 'react';
import { makeStyles, Theme, Typography } from '@material-ui/core';
import { useAppState } from '../../state';
import UserMenu from './UserMenu/UserMenu';
import { useLocation } from 'react-router-dom';

const useStyles = makeStyles((theme: Theme) => ({
  // ── Full-page layout (S1 design) ────────────────────────────────────────────
  root: {
    minHeight: '100%',
    backgroundColor: '#F5F5F5',
    display: 'flex',
    flexDirection: 'column',
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: '#FFFFFF',
    borderBottom: '1px solid #E0E0E0',
    padding: '20px 40px',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    [theme.breakpoints.down('sm')]: {
      padding: '16px 20px',
    },
  },
  headerTitle: {
    color: '#000000',
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 4,
  },
  userMenuWrapper: {
    marginLeft: 'auto',
  },

  // ── Main content area ────────────────────────────────────────────────────────
  main: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    [theme.breakpoints.down('sm')]: {
      padding: '24px 16px',
      alignItems: 'flex-start',
    },
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E0E0E0',
    borderRadius: 8,
    padding: '28px 32px',
    width: '100%',
    maxWidth: 520,
    boxShadow: '0px 1px 4px rgba(40,42,43,0.08)',
    [theme.breakpoints.down('sm')]: {
      padding: '20px 16px',
    },
  },

  // ── Footer ──────────────────────────────────────────────────────────────────
  footer: {
    borderTop: '1px solid #E0E0E0',
    backgroundColor: '#FFFFFF',
    padding: '12px 40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    [theme.breakpoints.down('sm')]: {
      padding: '12px 20px',
    },
  },
  footerText: {
    fontSize: 11,
    color: '#9E9E9E',
  },
}));

interface IntroContainerProps {
  children: React.ReactNode;
  // Width of the content card. Defaults to the narrow form width (S1); the
  // device-check step (S2) passes a wider value for its two-column layout.
  maxWidth?: number;
}

const IntroContainer = (props: IntroContainerProps) => {
  const classes = useStyles();
  const { user } = useAppState();
  const location = useLocation();

  return (
    <div className={classes.root}>
      {/* Header */}
      <div className={classes.header}>
        <div>
          <Typography component="h1" className={classes.headerTitle}>
            Plataforma de Prueba
          </Typography>
          <Typography className={classes.headerSubtitle}>
            Plataforma de Videoconferencia Síncrona para Aulas Híbridas
          </Typography>
        </div>
        {user && location.pathname !== '/login' && (
          <div className={classes.userMenuWrapper}>
            <UserMenu />
          </div>
        )}
      </div>

      {/* Main content */}
      <div className={classes.main}>
        <div className={classes.contentCard} style={props.maxWidth ? { maxWidth: props.maxWidth } : undefined}>
          {props.children}
        </div>
      </div>

      {/* Footer */}
      <div className={classes.footer}>
        <Typography className={classes.footerText}>
          Infraestructura: <strong>Twilio Video WebRTC SFU</strong>
        </Typography>
      </div>
    </div>
  );
};

export default IntroContainer;
