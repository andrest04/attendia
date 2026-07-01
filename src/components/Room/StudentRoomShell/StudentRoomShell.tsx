import React from 'react';
import clsx from 'clsx';
import { makeStyles, Theme } from '@material-ui/core';
import { isTeacherIdentity } from '../../PreJoinScreens/classSessionTypes';
import AttendiaLogo from '../../Brand/AttendiaLogo';
import RoleBadge from '../../RoleBadge/RoleBadge';

// ─── Design tokens (from theme + Figma) ─────────────────────────────────────
// Primary blue:  #1d6eed
// Navy dark:     #1d2f6f
// Stage bg:      #0f1e45
// Light bg:      #f0f5ff
// Border:        #e2ecf9
// Green:         #10b981
// Text primary:  #1d2f6f
// Text secondary:#64748b
// ─────────────────────────────────────────────────────────────────────────────

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    backgroundColor: theme.palette.background.default,
  },
  // The rails + stage live in a grid that fills the height above the toolbar; the
  // toolbar is a full-width footer (sibling), so controls stay centered on screen
  // regardless of which rails are open (Meet-style). Rails collapse on entry.
  body: {
    flex: 1,
    minHeight: 0,
    display: 'grid',
    gridTemplateRows: '1fr',
    overflow: 'hidden',
    // Smoothly animate the rails opening/closing. The grid always keeps THREE
    // tracks (closed rails collapse to 0px, not removed) so the column widths are
    // interpolable — a changing track count would snap instead of transition.
    transition: 'grid-template-columns 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  },
  bodyBoth: {
    gridTemplateColumns: '236px 1fr 300px',
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: '200px 1fr 264px',
    },
  },
  bodyLeftOnly: {
    gridTemplateColumns: '236px 1fr 0px',
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: '200px 1fr 0px',
    },
  },
  bodyRightOnly: {
    gridTemplateColumns: '0px 1fr 300px',
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: '0px 1fr 264px',
    },
  },
  bodyNoRails: {
    gridTemplateColumns: '0px 1fr 0px',
  },
  // ── Left rail ──────────────────────────────────────────────────────────────
  leftRail: {
    borderRight: '1px solid #e2ecf9',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.palette.background.paper,
    overflow: 'hidden',
    // Fade + micro-scale the content in as the column widens. The grid handles the
    // spatial reveal; this GPU-cheap fade hides the frame-by-frame reflow so opening
    // reads smooth instead of a hard clip.
    transition: 'opacity 0.24s ease, transform 0.24s ease, border-color 0.2s linear',
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  },
  // Applied to a rail whose column has collapsed to 0px: drop the seam border, fade
  // out the content, and block interaction with the clipped content while it is hidden.
  railCollapsed: {
    borderColor: 'transparent',
    opacity: 0,
    transform: 'scale(0.98)',
    pointerEvents: 'none',
  },
  leftHeader: {
    borderBottom: '1px solid #e2ecf9',
    padding: '16px 18px 13px',
    flexShrink: 0,
  },
  // Shared "close this rail" × affordance in the rail headers.
  railClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#94a3b8',
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 18,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    '&:hover': { color: '#1d2f6f', backgroundColor: '#f0f5ff' },
  },
  logoArea: {
    height: 22,
    marginBottom: 14,
  },
  logoText: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 16,
    color: theme.palette.secondary.main,
    letterSpacing: '-0.3px',
  },
  logoAccent: {
    color: theme.palette.primary.main,
  },
  participantsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  participantsLabel: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 14,
    color: theme.palette.secondary.main,
    lineHeight: '19.6px',
  },
  participantsBadge: {
    backgroundColor: '#ebf3ff',
    borderRadius: 20,
    padding: '2.5px 7px',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 11,
    color: theme.palette.primary.main,
    lineHeight: '16.5px',
  },
  // Roster list
  rosterList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 0',
  },
  rosterItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 18px',
  },
  rosterAvatar: {
    flexShrink: 0,
    width: 34,
    height: 34,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 11,
    lineHeight: '16.5px',
  },
  // The local user's own avatar gets the filled accent treatment so they can spot
  // themselves in the roster (consistent across both shells).
  rosterAvatarSelf: {
    backgroundColor: theme.palette.secondary.main,
    color: '#ffffff',
    boxShadow: '0px 1px 2px rgba(29,110,237,0.07)',
  },
  rosterAvatarStudent: {
    backgroundColor: '#ebf3ff',
    color: theme.palette.primary.main,
  },
  rosterInfo: {
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
    fontWeight: 700,
    fontSize: 13,
    color: theme.palette.secondary.main,
    lineHeight: '19.5px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  rosterDot: {
    flexShrink: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  // Plain count fallback text (when no rich roster is provided).
  countText: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400,
    fontSize: 11,
    color: '#64748b',
    lineHeight: '16.5px',
  },
  // ── Center stage ───────────────────────────────────────────────────────────
  center: {
    minWidth: 0,
    backgroundColor: '#0f1e45',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  stageContent: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  connectionPill: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 20,
    padding: '7px 13px',
    pointerEvents: 'none',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: '#10b981',
    flexShrink: 0,
  },
  connectionLabel: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 500,
    fontSize: 12,
    color: '#ffffff',
    lineHeight: '18px',
  },
  stageBadge: {
    position: 'absolute',
    bottom: 9,
    left: 16,
    zIndex: 2,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 8,
    padding: '7px 10px',
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400,
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: '15px',
    pointerEvents: 'none',
  },
  connectivityBanner: {
    position: 'absolute',
    bottom: 48,
    left: 16,
    right: 16,
    zIndex: 2,
    padding: '8px 12px',
    borderRadius: 8,
    backgroundColor: '#FFF8E1',
    color: '#7A4B00',
    fontSize: 11,
    fontFamily: 'Inter, sans-serif',
  },
  // ── Right rail ─────────────────────────────────────────────────────────────
  rightRail: {
    borderLeft: '1px solid #e2ecf9',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    minWidth: 0,
    backgroundColor: theme.palette.background.paper,
    overflow: 'hidden',
    // Matches leftRail: fade + micro-scale the content in as the column widens so the
    // reveal feels smooth, not a hard clip (see leftRail for the full rationale).
    transition: 'opacity 0.24s ease, transform 0.24s ease, border-color 0.2s linear',
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  },
  rightTabs: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid #e2ecf9',
    flexShrink: 0,
    paddingRight: 8,
  },
  tab: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '14px 0 16px',
    fontSize: 13,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    textAlign: 'center',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    marginBottom: -1,
    color: '#64748b',
    cursor: 'pointer',
    lineHeight: '19.5px',
  },
  tabActive: {
    color: theme.palette.primary.main,
    borderBottomColor: theme.palette.primary.main,
  },
  tabIcon: {
    width: 14,
    height: 14,
    flexShrink: 0,
  },
  rightContent: {
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  // ── Bottom toolbar ─────────────────────────────────────────────────────────
  // Dark navy surface matching ProfessorRoomShell; a full-width footer so the
  // controls stay centered on screen no matter which rails are open.
  toolbar: {
    flexShrink: 0,
    backgroundColor: '#0f1e45',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    padding: theme.spacing(1.25, 2),
  },
}));

// ── Helper: derive initials from an identity string ──────────────────────────
function getInitials(identity: string): string {
  const clean = identity.replace(/\[Profesor\]/gi, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface RosterParticipant {
  identity: string;
  isOnline?: boolean;
  isLocal?: boolean;
}

function RosterItem({
  participant,
  classes,
}: {
  participant: RosterParticipant;
  classes: ReturnType<typeof useStyles>;
}) {
  const isTeacher = isTeacherIdentity(participant.identity);
  const initials = getInitials(participant.identity);
  const displayName = participant.identity.replace(/\[Profesor\]/gi, '').trim();

  return (
    <div className={classes.rosterItem}>
      <div
        className={clsx(
          classes.rosterAvatar,
          participant.isLocal ? classes.rosterAvatarSelf : classes.rosterAvatarStudent
        )}
      >
        {initials}
      </div>
      <div className={classes.rosterInfo}>
        <div className={classes.rosterName} title={displayName}>
          {displayName}
        </div>
        {isTeacher && <RoleBadge size="sm" />}
      </div>
      {participant.isOnline && <div className={classes.rosterDot} />}
    </div>
  );
}

// Chat tab icon (speech bubble)
function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M7 1C3.686 1 1 3.462 1 6.5c0 1.04.305 2.01.831 2.83L1 13l3.67-.83A6.01 6.01 0 007 12c3.314 0 6-2.462 6-5.5S10.314 1 7 1z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
// Maps a Twilio network quality level (0–5, 5 = best; null/undefined = no data
// yet) to the connection pill's label and dot color. The <=2 "Débil" cut mirrors
// the threshold that drives the degraded-connectivity banner, so the two never
// contradict each other.
type ConnectionQuality = { label: string; color: string };
function connectionQuality(level: number | null | undefined): ConnectionQuality {
  if (level == null) return { label: 'Sin datos', color: '#9ca3af' };
  if (level <= 2) return { label: 'Débil', color: '#ef4444' };
  if (level === 3) return { label: 'Media', color: '#f59e0b' };
  return { label: 'Buena', color: '#10b981' };
}

interface Props {
  stage: React.ReactNode;
  toolbarSlot?: React.ReactNode;
  rightPanel?: React.ReactNode;
  activeSpeakerLabel?: string;
  sessionLabel?: string;
  participantCount?: number;
  isConnectivityDegraded?: boolean;
  /** Twilio network quality level (0–5) of the local participant; null/undefined = unknown. */
  networkQualityLevel?: number | null;
  /** Optional rich roster; when provided, renders avatar list instead of plain count */
  participants?: RosterParticipant[];
  /** Whether the left (Participantes) rail is open. Collapses on entry, Meet-style. Defaults open for legacy callers/tests. */
  leftOpen?: boolean;
  /** Whether the right (chat) rail is open. Collapses on entry. Defaults open for legacy callers/tests. */
  rightOpen?: boolean;
  /** Dismiss the left rail from its header × button. */
  onCloseLeft?: () => void;
  /** Dismiss the right rail from its header × button. */
  onCloseRight?: () => void;
}

export default function StudentRoomShell({
  stage,
  toolbarSlot = null,
  rightPanel = null,
  activeSpeakerLabel = 'Sin participante activo',
  sessionLabel = 'Sesión Twilio en vivo',
  participantCount = 0,
  isConnectivityDegraded = false,
  networkQualityLevel,
  participants,
  leftOpen = true,
  rightOpen = true,
  onCloseLeft,
  onCloseRight,
}: Props) {
  const classes = useStyles();
  const connection = connectionQuality(networkQualityLevel);

  return (
    <section className={classes.root} data-testid="student-room-shell-root">
      <div
        className={clsx(classes.body, {
          [classes.bodyBoth]: leftOpen && rightOpen,
          [classes.bodyLeftOnly]: leftOpen && !rightOpen,
          [classes.bodyRightOnly]: !leftOpen && rightOpen,
          [classes.bodyNoRails]: !leftOpen && !rightOpen,
        })}
      >
        {/* ── LEFT RAIL ── (always mounted so it can animate open/closed) */}
        <aside
          className={clsx(classes.leftRail, { [classes.railCollapsed]: !leftOpen })}
          data-testid="student-room-shell-left-rail"
          aria-hidden={!leftOpen}
        >
          {/* Logo + Participants heading */}
          <div className={classes.leftHeader}>
            <div className={classes.logoArea}>
              <AttendiaLogo variant="full" size={22} />
            </div>
            <div className={classes.participantsRow}>
              <span className={classes.participantsLabel}>Participantes</span>
              <div className={classes.participantsRow} style={{ gap: 8 }}>
                <span className={classes.participantsBadge}>
                  {participants ? participants.length : participantCount}
                </span>
                {onCloseLeft && (
                  <button
                    type="button"
                    className={classes.railClose}
                    onClick={onCloseLeft}
                    aria-label="Cerrar participantes"
                    data-testid="student-room-shell-close-left"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Roster — either rich list or plain "N en sala" */}
          <div className={classes.rosterList}>
            {participants ? (
              participants.map(p => <RosterItem key={p.identity} participant={p} classes={classes} />)
            ) : (
              <div className={classes.rosterItem} data-testid="student-room-shell-participant-count">
                <span className={classes.countText}>{participantCount} en sala</span>
              </div>
            )}
          </div>
        </aside>

        {/* ── CENTER STAGE ─────────────────────────────────────────────────── */}
        <div className={classes.center} data-testid="student-room-shell-center-stage">
          {/* Video region — overlays anchor here so the toolbar below stays clear. */}
          <div className={classes.stageContent}>
            {/* Connection quality pill */}
            <div className={classes.connectionPill} data-testid="student-connection-pill">
              <div className={classes.connectionDot} style={{ backgroundColor: connection.color }} />
              <span className={classes.connectionLabel}>{connection.label}</span>
            </div>

            {/* Stage (GalleryView / MainParticipant). The student sees their own tile here
                as a regular cell, exactly like the professor — no separate PiP self-view. */}
            {stage}

            {/* "Twilio Video · WebRTC SFU" watermark */}
            <div className={classes.stageBadge}>Twilio Video · WebRTC SFU</div>

            {/* Connectivity banner */}
            {isConnectivityDegraded && (
              <div className={classes.connectivityBanner} data-testid="student-room-shell-connectivity-banner">
                Resolución reducida por baja conectividad
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT RAIL ── (always mounted so it can animate open/closed) */}
        <aside
          className={clsx(classes.rightRail, { [classes.railCollapsed]: !rightOpen })}
          data-testid="student-room-shell-right-rail"
          aria-hidden={!rightOpen}
        >
          <div className={classes.rightTabs} data-testid="student-room-shell-right-tabs">
            <span className={clsx(classes.tab, classes.tabActive)} data-testid="student-room-shell-tab-chat">
              <ChatIcon className={classes.tabIcon} />
              Chat
            </span>
            {onCloseRight && (
              <button
                type="button"
                className={classes.railClose}
                onClick={onCloseRight}
                aria-label="Cerrar chat"
                data-testid="student-room-shell-close-right"
              >
                ×
              </button>
            )}
          </div>
          <div className={classes.rightContent}>{rightPanel}</div>
        </aside>
      </div>

      {/* ── TOOLBAR (full-width footer, always screen-centered) ── */}
      <div className={classes.toolbar} data-testid="student-room-shell-toolbar-slot">
        {toolbarSlot}
      </div>

      {/* Legacy stage header kept for test compatibility */}
      <div data-testid="student-room-shell-stage-header" style={{ display: 'none' }} aria-hidden="true" />
    </section>
  );
}
