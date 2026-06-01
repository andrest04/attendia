import React from 'react';
import { makeStyles, Theme } from '@material-ui/core';
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import useSessionElapsed from './useSessionElapsed';

const useStyles = makeStyles((theme: Theme) => ({
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(0.75, 2),
    backgroundColor: '#282A2B',
    color: '#E4E7E9',
    flexShrink: 0,
  },
  recBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 4,
    backgroundColor: 'rgba(226, 37, 37, 0.18)',
  },
  recDot: { fontSize: 10, color: '#E22525' },
  recText: { fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: '#FFFFFF' },
  info: { fontSize: 12 },
  infra: {
    fontSize: 10,
    fontStyle: 'italic',
    color: '#9DA4A6',
    marginLeft: 'auto',
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
 * Top status bar for the professor session (S4): REC indicator, session name,
 * connected-student count, a live elapsed clock, and the Twilio infra label.
 */
export default function SessionStatusBar({ sessionName = 'Sesión', studentCount = 0, recording = false }: Props) {
  const classes = useStyles();
  const elapsed = useSessionElapsed();

  return (
    <div className={classes.bar} data-testid="professor-room-shell-session-bar">
      {recording && (
        <span className={classes.recBadge} data-testid="professor-room-shell-rec-badge">
          <FiberManualRecordIcon className={classes.recDot} />
          <span className={classes.recText}>REC</span>
        </span>
      )}
      <span className={classes.info} data-testid="professor-room-shell-session-info">
        {sessionName} · {studentCount} {studentCount === 1 ? 'estudiante' : 'estudiantes'} · {elapsed}
      </span>
      <span className={classes.infra}>Twilio Video · WebRTC SFU</span>
    </div>
  );
}
