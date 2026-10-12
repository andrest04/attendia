import React from 'react';
import clsx from 'clsx';
import { makeStyles, Theme } from '@material-ui/core';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import MicOffIcon from '@material-ui/icons/MicOff';
import { isTeacherIdentity, stripTeacherSuffix } from '../../PreJoinScreens/classSessionTypes';
import RoleBadge from '../../RoleBadge/RoleBadge';
import { ParticipantAttention } from '../../AttentionProvider/types';
import { ATTENTION_LEVEL_STYLE } from '../../AttentionProvider/attentionLevelStyle';
import { classifyAttention } from '../../AttentionProvider/presence';
import { getInitials, presenceView } from './professorShellHelpers';
import { attentionStatusColors } from '../../../theme';

const useStyles = makeStyles((theme: Theme) => ({
  rosterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 18px 10px',
    borderBottom: '1px solid #f0f5ff',
    flexShrink: 0,
  },
  rosterAvatar: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#ebf3ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 10,
    color: '#1d6eed',
    flexShrink: 0,
  },
  // The local user's own avatar gets the filled accent treatment so they can spot
  // themselves in the roster (consistent across both shells).
  rosterAvatarSelf: {
    backgroundColor: theme.palette.secondary.main,
    color: '#ffffff',
    boxShadow: '0px 1px 2px rgba(29,110,237,0.07)',
  },
  rosterNameWrap: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  rosterName: {
    flex: '0 1 auto',
    minWidth: 0,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 500,
    fontSize: 12,
    color: '#1d2f6f',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  attBadge: {
    flexShrink: 0,
    fontSize: 10,
    fontWeight: 700,
    fontFamily: 'Poppins, Inter, sans-serif',
    padding: '2px 8px',
    borderRadius: 12,
    lineHeight: '15px',
  },
  multifaceWarning: {
    flexShrink: 0,
    fontSize: 11,
    color: attentionStatusColors.low,
  },
  cameraOffFlag: {
    flexShrink: 0,
    fontSize: 16,
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
  },

  // Per-student moderation menu (kebab) in the roster. Hand-rolled (not MUI Menu)
  // to stay portal-free and trivially testable, mirroring the proctoring modal.
  rosterMenuWrap: {
    position: 'relative',
    flexShrink: 0,
    display: 'flex',
  },
  rosterMenuButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#94a3b8',
    padding: '2px 4px',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    '&:hover': { backgroundColor: '#f0f5ff', color: '#1d2f6f' },
  },
  rosterMenuBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 15,
  },
  rosterMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    zIndex: 16,
    minWidth: 150,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    border: '1px solid #e2ecf9',
    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
    overflow: 'hidden',
    padding: '4px 0',
  },
  rosterMenuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '8px 12px',
    background: 'none',
    border: 'none',
    textAlign: 'left' as const,
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    fontSize: 12,
    color: '#1d2f6f',
    '&:hover': { backgroundColor: '#f0f5ff' },
  },
}));

interface RosterListProps {
  /** Real room participants (including the professor), in room order. */
  participants: Array<{ identity: string; isLocal?: boolean }>;
  /** Attention decoration keyed by identity; identities absent from the map render no badge. */
  attentionByIdentity: Map<string, ParticipantAttention>;
  /** When provided, students (never the professor) get a moderation kebab with "Silenciar". */
  onMuteParticipant?: (identity: string) => void;
}

/**
 * What the roster shows next to a participant the attention pipeline knows about: their level
 * badge when they are measured, otherwise a flag that says why there is no reading (never a
 * stale or placeholder level).
 */
function AttentionDecoration({
  attention,
  classes,
}: {
  attention: ParticipantAttention;
  classes: ReturnType<typeof useStyles>;
}) {
  const presence = classifyAttention(attention);
  if (presence !== 'measured') {
    const { Icon, label, rosterTestId } = presenceView[presence];
    return (
      <span className={classes.cameraOffFlag} data-testid={rosterTestId} title={label}>
        <Icon fontSize="inherit" />
      </span>
    );
  }
  const level = ATTENTION_LEVEL_STYLE[attention.level];
  return (
    <span
      className={classes.attBadge}
      data-testid="professor-room-shell-attention-badge"
      style={{ backgroundColor: level.badgeBg, color: level.badgeText }}
    >
      {level.label}
    </span>
  );
}

/**
 * The left-rail participant roster: avatar + name + attention decoration (badge or
 * camera-off / no-measure / unsupported flag) and a per-student moderation kebab.
 * Pins the teacher to the top and owns only the open-menu state.
 */
export default function RosterList({ participants, attentionByIdentity, onMuteParticipant }: RosterListProps) {
  const classes = useStyles();

  // Identity whose roster moderation (kebab) menu is currently open, or null.
  const [openMenuIdentity, setOpenMenuIdentity] = React.useState<string | null>(null);

  // Pin the teacher to the top of the roster (stable sort keeps student order).
  const orderedParticipants = [...participants].sort(
    (a, b) => Number(isTeacherIdentity(b.identity)) - Number(isTeacherIdentity(a.identity))
  );

  return (
    <div data-testid="professor-room-shell-roster">
      {orderedParticipants.map(participant => {
        const attention = attentionByIdentity.get(participant.identity);
        return (
          <div key={participant.identity} className={classes.rosterRow}>
            <div
              className={clsx(classes.rosterAvatar, {
                [classes.rosterAvatarSelf]: participant.isLocal,
              })}
            >
              {getInitials(participant.identity)}
            </div>
            <div className={classes.rosterNameWrap}>
              <span className={classes.rosterName} title={participant.identity}>
                {stripTeacherSuffix(participant.identity)}
              </span>
              {isTeacherIdentity(participant.identity) && <RoleBadge size="sm" />}
            </div>
            {attention?.multiface && (
              <span
                className={classes.multifaceWarning}
                data-testid="professor-room-shell-multiface-flag"
                title="Múltiples rostros detectados"
              >
                ⚠
              </span>
            )}
            {attention && <AttentionDecoration attention={attention} classes={classes} />}
            {/* Moderation kebab — students only (never the professor's own row). */}
            {onMuteParticipant && !isTeacherIdentity(participant.identity) && (
              <div className={classes.rosterMenuWrap}>
                <button
                  type="button"
                  className={classes.rosterMenuButton}
                  data-testid="professor-room-shell-roster-menu-button"
                  aria-label={`Acciones para ${participant.identity}`}
                  aria-haspopup="true"
                  aria-expanded={openMenuIdentity === participant.identity}
                  onClick={() =>
                    setOpenMenuIdentity(prev => (prev === participant.identity ? null : participant.identity))
                  }
                >
                  <MoreVertIcon style={{ fontSize: 18 }} />
                </button>
                {openMenuIdentity === participant.identity && (
                  <>
                    <div className={classes.rosterMenuBackdrop} onClick={() => setOpenMenuIdentity(null)} />
                    <div className={classes.rosterMenu} data-testid="professor-room-shell-roster-menu" role="menu">
                      <button
                        type="button"
                        className={classes.rosterMenuItem}
                        data-testid="professor-room-shell-roster-mute"
                        role="menuitem"
                        onClick={() => {
                          onMuteParticipant(participant.identity);
                          setOpenMenuIdentity(null);
                        }}
                      >
                        <MicOffIcon style={{ fontSize: 16 }} /> Silenciar
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
