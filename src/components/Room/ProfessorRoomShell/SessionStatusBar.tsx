import React from 'react';
import { makeStyles, Theme } from '@material-ui/core';
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import useSessionElapsed from './useSessionElapsed';
import AttendiaLogo from '../../Brand/AttendiaLogo';
import { useOnboarding } from '../OnboardingTutorial/onboardingContext';

const useStyles = makeStyles((theme: Theme) => ({
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(1.25, 3),
    backgroundColor: '#1d2f6f',
    color: 'rgba(255,255,255,0.6)',
    flexShrink: 0,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  logoIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    background: 'linear-gradient(135deg, #4d96ff 0%, #1d6eed 60%, #1d2f6f 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 2px 4px rgba(29,110,237,0.35)',
    flexShrink: 0,
  },
  logoIconDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    opacity: 0.9,
  },
  logoText: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 13,
    color: '#ffffff',
    letterSpacing: '-0.03em',
    lineHeight: 1.1,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    flexShrink: 0,
  },
  recBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 13px',
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.18)',
    border: '1px solid rgba(239,68,68,0.4)',
    flexShrink: 0,
  },
  recDot: { fontSize: 9, color: '#ef4444' },
  recText: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: '#ef4444',
    fontFamily: 'Poppins, Inter, sans-serif',
  },
  sessionInfo: {
    fontSize: 13,
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400,
    color: 'rgba(255,255,255,0.6)',
    whiteSpace: 'nowrap',
    // Let the (potentially long) session name truncate instead of pushing the
    // REC badge / Ayuda button off the right edge on a narrow status bar.
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
  },
  spacer: { flex: 1 },
  infraChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 13px',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.1)',
    flexShrink: 0,
    // Non-essential infra label — drop it on tight widths to protect REC/name/Ayuda.
    [theme.breakpoints.down('md')]: {
      display: 'none',
    },
  },
  infraDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    flexShrink: 0,
  },
  infraText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400,
    whiteSpace: 'nowrap',
  },
  helpButton: {
    padding: '5px 16px',
    borderRadius: 8,
    backgroundColor: 'rgba(29,110,237,0.25)',
    border: '1px solid rgba(29,110,237,0.4)',
    color: '#7bb8ff',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: 12,
    cursor: 'pointer',
    flexShrink: 0,
    lineHeight: '18px',
  },
}));

interface Props {
  /** Human-facing session/room name shown in the bar. */
  sessionName?: string;
  /** Connected students (excludes the professor). */
  studentCount?: number;
  /** REC indicator state, mirrored from the toolbar toggle (US12). */
  recording?: boolean;
}

/**
 * Top status bar for the professor session: attendia logo, REC indicator,
 * session name + student count + elapsed clock, infra chip, Help button.
 */
export default function SessionStatusBar({ sessionName = 'Sesión', studentCount = 0, recording = false }: Props) {
  const classes = useStyles();
  const elapsed = useSessionElapsed();
  const { openTour } = useOnboarding();

  return (
    <div className={classes.bar} data-testid="professor-room-shell-session-bar">
      <div className={classes.logo}>
        <AttendiaLogo variant="white" size={22} />
      </div>

      <div className={classes.divider} />

      {recording && (
        <span className={classes.recBadge} data-testid="professor-room-shell-rec-badge">
          <FiberManualRecordIcon className={classes.recDot} />
          <span className={classes.recText}>REC</span>
        </span>
      )}

      <span className={classes.sessionInfo} data-testid="professor-room-shell-session-info">
        {sessionName} · {studentCount} {studentCount === 1 ? 'estudiante' : 'estudiantes'} · {elapsed}
      </span>

      <div className={classes.spacer} />

      <div className={classes.infraChip}>
        <div className={classes.infraDot} />
        <span className={classes.infraText}>Twilio Video · WebRTC SFU</span>
      </div>

      <button
        type="button"
        className={classes.helpButton}
        onClick={openTour}
        data-testid="professor-room-shell-help-button"
      >
        Ayuda
      </button>
    </div>
  );
}
