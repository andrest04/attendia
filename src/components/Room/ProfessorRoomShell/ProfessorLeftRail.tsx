import React from 'react';
import { makeStyles } from '@material-ui/core';
import { ParticipantAttention, ProctoringAlert } from '../../AttentionProvider/types';
import { ShellNotification } from '../shellNotification';
import { CollapsibleRail, RailCloseButton } from '../ShellLayout/CollapsibleRail';
import RosterList from './RosterList';
import HandsRaisedQueue from './HandsRaisedQueue';
import NotificationsFeed from './NotificationsFeed';
import ProctoringFeed from './ProctoringFeed';

const useStyles = makeStyles(() => ({
  leftRail: {
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflowY: 'auto',
  },
  leftHeader: {
    padding: '16px 18px 17px',
    borderBottom: '1px solid #e2ecf9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  leftHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  leftHeading: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 14,
    color: '#1d2f6f',
    lineHeight: 1.4,
  },
  participantCountBadge: {
    backgroundColor: '#ebf3ff',
    borderRadius: 20,
    padding: '2px 8px',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 11,
    color: '#1d6eed',
    lineHeight: 1.5,
    minWidth: 28,
    textAlign: 'center',
  },
}));

interface ProfessorLeftRailProps {
  /** Whether the rail is open. Collapses to 0px (still mounted) when false. */
  open: boolean;
  /** Dismiss the rail from its header × button. */
  onClose?: () => void;
  participantCount: number;
  /** Real room participants (including the professor), in room order. */
  participants: Array<{ identity: string; isLocal?: boolean }>;
  /** Attention decoration keyed by identity; identities absent from the map render no badge. */
  attentionByIdentity: Map<string, ParticipantAttention>;
  /** Identities of participants with a raised hand, in queue order. */
  handsRaised: string[];
  onGrantTurn?: (identity: string) => void;
  onMuteParticipant?: (identity: string) => void;
  onRequestUnmute?: (identity: string) => void;
  notifications: ShellNotification[];
  /** When true, surface the proctoring alerts feed (US30). */
  proctoringEnabled: boolean;
  /** Alerts not yet resolved by the professor (parent filters out dismissed ones). */
  visibleAlerts: ProctoringAlert[];
  /** Attention data source — drives the "datos simulados" tag on the feed. */
  source: 'mock' | 'live';
  /** Open the proctoring detail modal for the clicked alert. */
  onAlertClick: (alert: ProctoringAlert) => void;
}

/**
 * The professor shell's left rail: a scrollable column that composes the roster,
 * the raised-hands queue, the classmate notifications feed and (when enabled) the
 * proctoring feed. Presentational shell — it owns only the header and the
 * open/collapsed animation; each section is its own component.
 */
export default function ProfessorLeftRail({
  open,
  onClose,
  participantCount,
  participants,
  attentionByIdentity,
  handsRaised,
  onGrantTurn,
  onMuteParticipant,
  onRequestUnmute,
  notifications,
  proctoringEnabled,
  visibleAlerts,
  source,
  onAlertClick,
}: ProfessorLeftRailProps) {
  const classes = useStyles();

  return (
    <CollapsibleRail side="left" open={open} className={classes.leftRail} data-testid="professor-room-shell-left-rail">
      <div className={classes.leftHeader}>
        <span className={classes.leftHeading}>Participantes</span>
        <div className={classes.leftHeaderActions}>
          <span className={classes.participantCountBadge} data-testid="professor-room-shell-participant-count">
            {participantCount}
          </span>
          {onClose && (
            <RailCloseButton
              onClick={onClose}
              aria-label="Cerrar participantes"
              data-testid="professor-room-shell-close-left"
            />
          )}
        </div>
      </div>

      <HandsRaisedQueue handsRaised={handsRaised} onGrantTurn={onGrantTurn} />

      <RosterList
        participants={participants}
        attentionByIdentity={attentionByIdentity}
        onMuteParticipant={onMuteParticipant}
        onRequestUnmute={onRequestUnmute}
      />

      <NotificationsFeed notifications={notifications} />

      {proctoringEnabled && (
        <ProctoringFeed visibleAlerts={visibleAlerts} source={source} onAlertClick={onAlertClick} />
      )}
    </CollapsibleRail>
  );
}
