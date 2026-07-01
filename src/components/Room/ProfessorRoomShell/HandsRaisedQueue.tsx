import React from 'react';
import { makeStyles, Theme } from '@material-ui/core';

const useStyles = makeStyles((theme: Theme) => ({
  handsQueue: {
    backgroundColor: '#fff8e1',
    borderBottom: '1px solid #e2ecf9',
    padding: '12px 18px 13px',
    flexShrink: 0,
  },
  handsQueueTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 10,
    color: '#7c4e00',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginBottom: theme.spacing(1),
  },
  handRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 0',
  },
  handIdentityWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  handDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffb800',
    flexShrink: 0,
  },
  handIdentity: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: 12,
    color: '#7c4e00',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  grantTurnButton: {
    flexShrink: 0,
    padding: '4px 0',
    width: 74,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontSize: 11,
    fontWeight: 700,
    color: '#ffffff',
    backgroundColor: '#1d2f6f',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    boxShadow: '0px 1px 2px rgba(29,110,237,0.07)',
    textAlign: 'center',
    lineHeight: '16.5px',
    '&:hover': {
      backgroundColor: '#152356',
    },
  },
}));

interface HandsRaisedQueueProps {
  /** Identities of participants with a raised hand, in queue order. */
  handsRaised: string[];
  /** Give the named participant the turn (clears their raised hand). */
  onGrantTurn?: (identity: string) => void;
}

/**
 * The left-rail raised-hands queue. Renders nothing when no hands are up, so the
 * container can compose it unconditionally.
 */
export default function HandsRaisedQueue({ handsRaised, onGrantTurn }: HandsRaisedQueueProps) {
  const classes = useStyles();

  if (handsRaised.length === 0) return null;

  return (
    <div className={classes.handsQueue} data-testid="professor-room-shell-hands-queue">
      <div className={classes.handsQueueTitle}>✋ Manos levantadas ({handsRaised.length})</div>
      {handsRaised.map(identity => (
        <div key={identity} className={classes.handRow}>
          <div className={classes.handIdentityWrapper}>
            <div className={classes.handDot} />
            <span className={classes.handIdentity} title={identity}>
              {identity}
            </span>
          </div>
          <button type="button" className={classes.grantTurnButton} onClick={() => onGrantTurn?.(identity)}>
            Dar turno
          </button>
        </div>
      ))}
    </div>
  );
}
