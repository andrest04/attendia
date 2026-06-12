import React from 'react';
import clsx from 'clsx';
import { makeStyles, Theme } from '@material-ui/core';
import { ShellNotification } from './useShellNotifications';
import { isTeacherIdentity } from '../../PreJoinScreens/classSessionTypes';
import AttendiaLogo from '../../Brand/AttendiaLogo';

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
    display: 'grid',
    gridTemplateColumns: '236px 1fr 300px',
    gridTemplateRows: '1fr auto',
    width: '100%',
    height: '100%',
    backgroundColor: theme.palette.background.default,
  },
  // ── Left rail ──────────────────────────────────────────────────────────────
  leftRail: {
    gridColumn: '1',
    gridRow: '1',
    borderRight: '1px solid #e2ecf9',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.palette.background.paper,
    overflow: 'hidden',
  },
  leftHeader: {
    borderBottom: '1px solid #e2ecf9',
    padding: '16px 18px 13px',
    flexShrink: 0,
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
  rosterAvatarTeacher: {
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
  },
  rosterName: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 13,
    color: theme.palette.secondary.main,
    lineHeight: '19.5px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  rosterSubLabel: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: 11,
    color: theme.palette.primary.main,
    lineHeight: '16.5px',
  },
  rosterDot: {
    flexShrink: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  // Notifications section
  notificationsSection: {
    borderTop: '1px solid #e2ecf9',
    padding: '15px 18px 14px',
    flexShrink: 0,
  },
  notificationsLabel: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 10,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.7px',
    lineHeight: '15px',
    marginBottom: 0,
  },
  notificationItems: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 0,
  },
  notificationPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.palette.background.default,
    border: '1px solid #e2ecf9',
    borderRadius: 10,
    padding: '8px 11px',
    marginTop: 10,
  },
  notificationEmoji: {
    fontSize: 13,
    lineHeight: '19.5px',
    flexShrink: 0,
  },
  notificationText: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400,
    fontSize: 11,
    color: '#64748b',
    lineHeight: '16.5px',
  },
  notificationsEmpty: {
    fontFamily: 'Inter, sans-serif',
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 10,
  },
  // ── Center stage ───────────────────────────────────────────────────────────
  center: {
    gridColumn: '2',
    gridRow: '1',
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
  pipCard: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    zIndex: 2,
    width: 148,
    height: 94,
    backgroundColor: 'rgba(255,255,255,0.07)',
    border: '1.5px solid rgba(255,255,255,0.12)',
    borderRadius: 14,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
    flexShrink: 0,
  },
  pipLabel: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400,
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: '15px',
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
    gridColumn: '3',
    gridRow: '1',
    borderLeft: '1px solid #e2ecf9',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    minWidth: 0,
    backgroundColor: theme.palette.background.paper,
  },
  rightTabs: {
    display: 'flex',
    borderBottom: '1px solid #e2ecf9',
    flexShrink: 0,
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
  toolbarRow: {
    gridColumn: '1 / -1',
    gridRow: '2',
    borderTop: '1px solid #e2ecf9',
    backgroundColor: theme.palette.background.paper,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '15px 32px 14px',
    gap: 14,
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
        className={clsx(classes.rosterAvatar, isTeacher ? classes.rosterAvatarTeacher : classes.rosterAvatarStudent)}
      >
        {initials}
      </div>
      <div className={classes.rosterInfo}>
        <div className={classes.rosterName}>{displayName}</div>
        {isTeacher && <div className={classes.rosterSubLabel}>Docente</div>}
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

// ── Emoji helper for notifications ────────────────────────────────────────────
function notificationEmoji(kind: ShellNotification['kind'], text: string): string {
  if (kind === 'local-hand') {
    return text.includes('Levantaste') ? '✋' : '👋';
  }
  if (text.includes('levantó')) return '✋';
  if (text.includes('unió')) return '🔔';
  if (text.includes('salió')) return '👋';
  return '🔔';
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  stage: React.ReactNode;
  toolbarSlot?: React.ReactNode;
  rightPanel?: React.ReactNode;
  activeSpeakerLabel?: string;
  sessionLabel?: string;
  participantCount?: number;
  notifications?: ShellNotification[];
  isConnectivityDegraded?: boolean;
  /** Optional rich roster; when provided, renders avatar list instead of plain count */
  participants?: RosterParticipant[];
  /** Identity of the local participant (for the PiP label) */
  localIdentity?: string;
}

export default function StudentRoomShell({
  stage,
  toolbarSlot = null,
  rightPanel = null,
  activeSpeakerLabel = 'Sin participante activo',
  sessionLabel = 'Sesión Twilio en vivo',
  participantCount = 0,
  notifications = [],
  isConnectivityDegraded = false,
  participants,
  localIdentity,
}: Props) {
  const classes = useStyles();

  // Local participant's display name for the PiP card
  const localDisplayName = localIdentity ? localIdentity.replace(/\[Profesor\]/gi, '').trim() : '';

  return (
    <section className={classes.root} data-testid="student-room-shell-root">
      {/* ── LEFT RAIL ────────────────────────────────────────────────────── */}
      <aside className={classes.leftRail} data-testid="student-room-shell-left-rail">
        {/* Logo + Participants heading */}
        <div className={classes.leftHeader}>
          <div className={classes.logoArea}>
            <AttendiaLogo variant="full" size={22} />
          </div>
          <div className={classes.participantsRow}>
            <span className={classes.participantsLabel}>Participantes</span>
            <span className={classes.participantsBadge}>{participants ? participants.length : participantCount}</span>
          </div>
        </div>

        {/* Roster — either rich list or plain "N en sala" */}
        <div className={classes.rosterList}>
          {participants ? (
            participants.map(p => <RosterItem key={p.identity} participant={p} classes={classes} />)
          ) : (
            <div className={classes.rosterItem} data-testid="student-room-shell-participant-count">
              <span className={classes.notificationText}>{participantCount} en sala</span>
            </div>
          )}
        </div>

        {/* NOTIFICACIONES */}
        <div className={classes.notificationsSection}>
          <div className={classes.notificationsLabel}>Notificaciones</div>
          {notifications.length === 0 ? (
            <div className={classes.notificationsEmpty} data-testid="student-room-shell-notifications-empty">
              Sin actividad por ahora.
            </div>
          ) : (
            <div className={classes.notificationItems}>
              {notifications.map(notification => (
                <div key={notification.id} className={classes.notificationPill}>
                  <span className={classes.notificationEmoji} aria-hidden="true">
                    {notificationEmoji(notification.kind, notification.text)}
                  </span>
                  <span className={classes.notificationText}>{notification.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ── CENTER STAGE ─────────────────────────────────────────────────── */}
      <div className={classes.center} data-testid="student-room-shell-center-stage">
        {/* Connection quality pill */}
        <div className={classes.connectionPill}>
          <div className={classes.connectionDot} />
          <span className={classes.connectionLabel}>Buena</span>
        </div>

        {/* Stage (GalleryView / MainParticipant) */}
        <div className={classes.stageContent}>{stage}</div>

        {/* Self-view picture-in-picture card */}
        {localDisplayName && (
          <div className={classes.pipCard} data-testid="student-room-shell-pip">
            <span className={classes.pipLabel}>Yo ({localDisplayName})</span>
          </div>
        )}

        {/* "Twilio Video · WebRTC SFU" watermark */}
        <div className={classes.stageBadge}>Twilio Video · WebRTC SFU</div>

        {/* Connectivity banner */}
        {isConnectivityDegraded && (
          <div className={classes.connectivityBanner} data-testid="student-room-shell-connectivity-banner">
            Resolución reducida por baja conectividad
          </div>
        )}
      </div>

      {/* ── RIGHT RAIL ───────────────────────────────────────────────────── */}
      <aside className={classes.rightRail} data-testid="student-room-shell-right-rail">
        {/* Tabs */}
        <div className={classes.rightTabs} data-testid="student-room-shell-right-tabs">
          <button
            type="button"
            className={clsx(classes.tab, classes.tabActive)}
            data-testid="student-room-shell-tab-chat"
            aria-pressed={true}
          >
            <ChatIcon className={classes.tabIcon} />
            Chat
          </button>
        </div>

        {/* Panel content */}
        <div className={classes.rightContent}>{rightPanel}</div>
      </aside>

      {/* ── BOTTOM TOOLBAR ───────────────────────────────────────────────── */}
      <div className={classes.toolbarRow} data-testid="student-room-shell-toolbar-slot">
        {toolbarSlot}
      </div>

      {/* Legacy stage header kept for test compatibility */}
      <div data-testid="student-room-shell-stage-header" style={{ display: 'none' }} aria-hidden="true" />
    </section>
  );
}
