import React from 'react';
import clsx from 'clsx';
import { makeStyles, Theme } from '@material-ui/core';
import { useSnackbar } from 'notistack';
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline';
import VisibilityIcon from '@material-ui/icons/Visibility';
import WarningIcon from '@material-ui/icons/Warning';
import VideocamOffIcon from '@material-ui/icons/VideocamOff';
import SmartphoneIcon from '@material-ui/icons/Smartphone';
import PeopleAltIcon from '@material-ui/icons/PeopleAlt';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import PersonOutlineIcon from '@material-ui/icons/PersonOutline';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import MicOffIcon from '@material-ui/icons/MicOff';
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Tooltip } from 'recharts';
import { useAttention } from '../../AttentionProvider';
import { isTeacherIdentity, stripTeacherSuffix } from '../../PreJoinScreens/classSessionTypes';
import RoleBadge from '../../RoleBadge/RoleBadge';
import { ShellNotification } from '../StudentRoomShell/useShellNotifications';
import { AttentionLevel, ProctoringAlert } from '../../AttentionProvider/types';
import { levelColor, levelLabel, proctoringKindLabel } from '../../AttentionProvider/attentionLabels';
import SessionStatusBar from './SessionStatusBar';
import GroupAttentionGauge from './GroupAttentionGauge';
import AttentionReportOverlay from '../AttentionReportOverlay/AttentionReportOverlay';

type ProctoringKind = ProctoringAlert['kind'];

// Per-kind icon for the proctoring feed and modal, so the cue matches the actual
// condition instead of a single generic warning glyph.
const proctoringKindIcon: Record<ProctoringKind, React.ComponentType<{ style?: React.CSSProperties }>> = {
  'camera-off': VideocamOffIcon,
  multiface: PeopleAltIcon,
  away: VisibilityOffIcon,
  absent: PersonOutlineIcon,
};

// Honest, kind-specific copy. Note we do NOT claim an exact face count: the live
// pipeline does not carry one in the alert and the number fluctuates per sample.
function proctoringKindMessage(kind: ProctoringKind, name: string, detectedAt: string): string {
  switch (kind) {
    case 'camera-off':
      return `${name} apagó su cámara. No hay datos de atención mientras esté apagada · Detectado a las ${detectedAt}`;
    case 'multiface':
      return `Se detectaron varios rostros en la cámara de ${name} · Detectado a las ${detectedAt}`;
    case 'away':
      return `${name} apartó la mirada de la pantalla · Detectado a las ${detectedAt}`;
    case 'absent':
      return `No se detecta a ${name} frente a la cámara · Detectado a las ${detectedAt}`;
  }
}

// Attention level → badge background / text pairs from the attendia design.
const attBadgeBg: Record<AttentionLevel, string> = {
  high: '#d1fae5',
  medium: '#fff8e1',
  low: '#fee2e2',
};
const attBadgeText: Record<AttentionLevel, string> = {
  high: '#065f46',
  medium: '#7c4e00',
  low: '#991b1b',
};

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    minHeight: 0,
    backgroundColor: '#f0f5ff',
    position: 'relative',
  },
  body: {
    flex: 1,
    minHeight: 0,
    display: 'grid',
    gridTemplateColumns: '228px 1fr 280px',
    gridTemplateRows: '1fr',
    overflow: 'hidden',
    // Narrow the fixed rails on tight desktop widths (960-1280) so the video stage
    // keeps a usable width instead of being crushed by two full-size rails.
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: 'minmax(180px, 200px) minmax(0, 1fr) minmax(220px, 240px)',
    },
  },

  // ── LEFT RAIL ──
  leftRail: {
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e2ecf9',
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

  // Hands raised section
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

  // Roster
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
    color: '#ef4444',
  },
  cameraOffFlag: {
    flexShrink: 0,
    fontSize: 16,
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
  },
  individualCameraOff: {
    fontFamily: 'Inter, sans-serif',
    fontSize: 11,
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
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

  // Notifications feed — a short, persistent log of students joining/leaving the
  // session. Sits at the bottom of the rail (owns the marginTop:auto push) with the
  // proctoring feed stacked right below it.
  notificationsSection: {
    borderTop: '1px solid #e2ecf9',
    padding: '12px 18px',
    marginTop: 'auto',
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
  },
  notificationItems: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  notificationPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0f5ff',
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

  // Proctoring feed
  proctoringFeed: {
    borderTop: '1px solid #e2ecf9',
    padding: '12px 18px',
    flexShrink: 0,
  },
  proctoringFeedTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 11,
    color: '#1d2f6f',
    marginBottom: 8,
  },
  proctoringAlertCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '8px 10px',
    borderRadius: 6,
    backgroundColor: '#fff8e1',
    marginBottom: 6,
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#fef3c7',
    },
  },
  proctoringAlertHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontSize: 12,
    fontWeight: 600,
    color: '#7c4e00',
  },
  proctoringAlertMeta: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'Inter, sans-serif',
  },
  mockTag: {
    fontSize: 9,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginTop: 4,
  },

  // ── CENTER ──
  center: {
    minWidth: 0,
    display: 'grid',
    gridTemplateRows: '1fr auto',
    overflow: 'hidden',
    backgroundColor: '#121C2D',
  },
  stageContent: {
    minHeight: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  toolbar: {
    backgroundColor: '#0f1e45',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    padding: theme.spacing(1.25, 2),
  },

  // ── RIGHT RAIL ──
  rightRail: {
    backgroundColor: '#ffffff',
    borderLeft: '1px solid #e2ecf9',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    minWidth: 0,
    overflow: 'hidden',
  },
  rightTabs: {
    display: 'flex',
    borderBottom: '1px solid #e2ecf9',
    flexShrink: 0,
  },
  tab: {
    flex: 1,
    padding: '10px 16px',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    textAlign: 'center',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    marginBottom: -1,
    color: '#64748b',
    cursor: 'pointer',
  },
  tabActive: {
    color: '#1d2f6f',
    borderBottomColor: '#1d6eed',
  },
  rightContent: {
    minHeight: 0,
    overflowY: 'auto',
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  // The embedded chat manages its own scrolling and needs the full rail cell,
  // so the chat tab drops the analytics padding/gap (mirrors StudentRoomShell).
  rightContentChat: {
    padding: 0,
    gap: 0,
    overflowY: 'hidden',
  },
  groupGauge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  gaugeLabel: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: 12,
    color: '#1d2f6f',
    textAlign: 'center',
    lineHeight: 1.3,
  },
  chartTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: 12,
    color: '#1d2f6f',
    marginBottom: theme.spacing(1),
  },
  viewReportButton: {
    width: '100%',
    padding: '10px 16px',
    border: '1.5px solid #e2ecf9',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: 12,
    color: '#1d2f6f',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    '&:hover': {
      backgroundColor: '#f0f5ff',
      borderColor: '#1d6eed',
    },
  },
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    borderRadius: 6,
    backgroundColor: '#fff8e1',
    border: '1px solid rgba(255,184,0,0.4)',
    color: '#7c4e00',
    fontSize: 12,
    fontFamily: 'Inter, sans-serif',
  },
  bannerIcon: {
    fontSize: 16,
    color: '#ffb800',
    flexShrink: 0,
  },
  // Neutral "no data" banner — distinct from the amber below-threshold alarm so a
  // connection gap never reads as "the group has zero attention".
  bannerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    border: '1px solid #cbd5e1',
    color: '#475569',
    fontSize: 12,
    fontFamily: 'Inter, sans-serif',
  },
  bannerInfoIcon: {
    fontSize: 16,
    color: '#94a3b8',
    flexShrink: 0,
  },

  // Individual tab
  individualRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginBottom: theme.spacing(1.5),
  },
  individualHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontFamily: 'Inter, sans-serif',
    fontSize: 12,
    color: '#1d2f6f',
  },
  individualScore: {
    color: '#64748b',
    fontSize: 11,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#e2ecf9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // ── PROCTORING MODAL ──
  modalBackdrop: {
    position: 'absolute',
    inset: 0,
    zIndex: 10,
    backgroundColor: 'rgba(15,30,69,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
    width: 460,
    maxWidth: '90vw',
    borderLeft: '4px solid #ffb800',
    // Cap height and scroll so the footer actions stay reachable on short viewports.
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  modalHeader: {
    padding: '16px 20px 12px',
    borderBottom: '1px solid #e2ecf9',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  modalHeaderLeft: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  modalHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#fff8e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: 18,
  },
  modalTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 15,
    color: '#1d2f6f',
    lineHeight: 1.3,
  },
  modalCaption: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'Inter, sans-serif',
    marginTop: 2,
  },
  modalClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#94a3b8',
    fontSize: 20,
    lineHeight: 1,
    padding: '2px 6px',
    borderRadius: 4,
    flexShrink: 0,
    '&:hover': { color: '#1d2f6f', backgroundColor: '#f0f5ff' },
  },
  modalBody: {
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  studentCard: {
    display: 'flex',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #e2ecf9',
    backgroundColor: '#f8fbff',
    alignItems: 'flex-start',
  },
  studentCardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#1d2f6f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 13,
    color: '#ffffff',
    flexShrink: 0,
  },
  studentCardInfo: {
    flex: 1,
  },
  studentCardName: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 13,
    color: '#1d2f6f',
  },
  studentCardRole: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'Inter, sans-serif',
    marginBottom: 6,
  },
  alertBox: {
    backgroundColor: '#fff8e1',
    borderRadius: 6,
    padding: '8px 10px',
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
  },
  alertBoxIcon: {
    fontSize: 14,
    color: '#ffb800',
    flexShrink: 0,
    marginTop: 1,
  },
  alertBoxText: {
    fontSize: 12,
    color: '#7c4e00',
    fontFamily: 'Inter, sans-serif',
    lineHeight: 1.4,
  },
  modalFooter: {
    padding: '12px 20px',
    borderTop: '1px solid #e2ecf9',
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
  },
  btnOutlined: {
    padding: '9px 18px',
    borderRadius: 8,
    border: '1.5px solid #e2ecf9',
    backgroundColor: '#ffffff',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: 13,
    color: '#1d2f6f',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    '&:hover': { backgroundColor: '#f0f5ff', borderColor: '#1d2f6f' },
  },
  btnPrimary: {
    padding: '9px 18px',
    borderRadius: 8,
    border: 'none',
    backgroundColor: '#1d6eed',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: 13,
    color: '#ffffff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    '&:hover': { backgroundColor: '#1557c8' },
  },
}));

export type ProfessorRightTab = 'grupo' | 'individual' | 'chat';

interface Props {
  stage: React.ReactNode;
  toolbarSlot?: React.ReactNode;
  rightTab?: ProfessorRightTab;
  onRightTabChange?: (tab: ProfessorRightTab) => void;
  /** Content for the chat tab — the embedded ChatWindow, resolved by Room.tsx. */
  rightPanel?: React.ReactNode;
  /** Real room participants (including the professor), in room order. Drives the left-rail roster. */
  participants?: Array<{ identity: string; isLocal?: boolean }>;
  sessionLabel?: string;
  /** Human-facing session/room name shown in the top status bar. */
  sessionName?: string;
  participantCount?: number;
  /** REC indicator state, mirrored from the toolbar toggle (US12). */
  recording?: boolean;
  /** Identities of participants with a raised hand, in queue order. */
  handsRaised?: string[];
  /** Professor action: give the named participant the turn (clears their raised hand). */
  onGrantTurn?: (identity: string) => void;
  /** Professor action: mute the named student's microphone (via the roster kebab menu). */
  onMuteParticipant?: (identity: string) => void;
  /** Professor action: warn the named student about a proctoring condition (from the alert modal). */
  onSendWarning?: (identity: string, kind: ProctoringAlert['kind']) => void;
  /** When true, surface the proctoring alerts feed (US30). Driven by the toolbar toggle. */
  proctoringEnabled?: boolean;
  /** Short, persistent log of students joining/leaving — rendered in the left-rail Notificaciones feed. */
  notifications?: ShellNotification[];
}

/** Emoji cue for a notification pill, derived from the event copy. */
function notificationEmoji(text: string): string {
  if (text.includes('levantó')) return '✋';
  if (text.includes('unió')) return '🔔';
  if (text.includes('salió')) return '👋';
  return '🔔';
}

/** Returns up to 2 uppercase initials from an identity string. */
function getInitials(identity: string): string {
  const parts = identity
    .replace(/\[.*?\]/g, '')
    .trim()
    .split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ProfessorRoomShell({
  stage,
  toolbarSlot = null,
  rightTab = 'grupo',
  onRightTabChange,
  rightPanel = null,
  participants = [],
  sessionLabel = 'Sesión Twilio en vivo',
  sessionName = 'Sesión Twilio en vivo',
  participantCount = 0,
  recording = false,
  handsRaised = [],
  onGrantTurn,
  onMuteParticipant,
  onSendWarning,
  proctoringEnabled = false,
  notifications = [],
}: Props) {
  const classes = useStyles();
  const { enqueueSnackbar } = useSnackbar();
  const {
    groupAttention,
    groupDataAvailable,
    attentionThreshold,
    timeline,
    participants: attentionParticipants,
    proctoringAlerts,
    source,
    attentionLevel,
  } = useAttention();
  // Only fire the below-threshold alarm when there is a real reading. With no
  // data, groupAttention is a placeholder 0 — not "0% attention" — so the alarm
  // would be a false alert during a connection drop.
  const isGroupBelowThreshold = groupDataAvailable && groupAttention < attentionThreshold;
  // The "Individual" tab is the analytics surface of the (mocked) attention pipeline,
  // so it stays on attention data; the left-rail roster below shows real room presence.
  const sortedParticipants = [...attentionParticipants].sort((a, b) => b.index - a.index);
  // Attention decoration for real participants — identities the pipeline does not know
  // about simply render without a badge (same defensive approach as GalleryView).
  const attentionByIdentity = new Map(attentionParticipants.map(p => [p.identity, p]));
  const studentCount = Math.max(0, participantCount - 1);
  // Pin the teacher to the top of the roster (stable sort keeps student order).
  const orderedParticipants = [...participants].sort(
    (a, b) => Number(isTeacherIdentity(b.identity)) - Number(isTeacherIdentity(a.identity))
  );

  const [isReportOpen, setIsReportOpen] = React.useState(false);

  // Identity whose roster moderation (kebab) menu is currently open, or null.
  const [openMenuIdentity, setOpenMenuIdentity] = React.useState<string | null>(null);

  // Proctoring modal local state
  const [proctoringModalAlert, setProctoringModalAlert] = React.useState<null | typeof proctoringAlerts[0]>(null);
  // Alert ids the professor has resolved (legitimate or warned) — filtered out of the
  // feed so a handled alert disappears. Local to the session; the provider re-logs a
  // fresh id if the condition recurs after it clears.
  const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(() => new Set());
  const visibleAlerts = proctoringAlerts.filter(a => !dismissedIds.has(a.id));
  const ModalKindIcon = proctoringModalAlert ? proctoringKindIcon[proctoringModalAlert.kind] : null;

  const handleOpenProctoringModal = (alert: typeof proctoringAlerts[0]) => {
    setProctoringModalAlert(alert);
  };
  const handleCloseProctoringModal = () => {
    setProctoringModalAlert(null);
  };
  const handleMarkLegitimate = () => {
    if (proctoringModalAlert) {
      setDismissedIds(prev => new Set(prev).add(proctoringModalAlert.id));
      enqueueSnackbar(`Alerta de ${stripTeacherSuffix(proctoringModalAlert.identity)} marcada como legítima`, {
        variant: 'success',
      });
    }
    setProctoringModalAlert(null);
  };
  const handleSendWarning = () => {
    if (proctoringModalAlert) {
      onSendWarning?.(proctoringModalAlert.identity, proctoringModalAlert.kind);
      setDismissedIds(prev => new Set(prev).add(proctoringModalAlert.id));
      enqueueSnackbar(`Advertencia enviada a ${stripTeacherSuffix(proctoringModalAlert.identity)}`, {
        variant: 'warning',
      });
    }
    setProctoringModalAlert(null);
  };

  return (
    <section className={classes.root} data-testid="professor-room-shell-root">
      <SessionStatusBar
        sessionName={sessionName}
        studentCount={Math.max(0, participantCount - 1)}
        recording={recording}
      />
      <div className={classes.body}>
        {/* ── LEFT RAIL ── */}
        <aside className={classes.leftRail} data-testid="professor-room-shell-left-rail">
          <div className={classes.leftHeader}>
            <span className={classes.leftHeading}>Participantes</span>
            <span className={classes.participantCountBadge} data-testid="professor-room-shell-participant-count">
              {participantCount}
            </span>
          </div>

          {handsRaised.length > 0 && (
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
          )}

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
                  {attention?.unsupported ? (
                    <span
                      className={classes.cameraOffFlag}
                      data-testid="professor-room-shell-unsupported-flag"
                      title="No medible (celular)"
                    >
                      <SmartphoneIcon fontSize="inherit" />
                    </span>
                  ) : attention?.cameraOff ? (
                    <span
                      className={classes.cameraOffFlag}
                      data-testid="professor-room-shell-cameraoff-flag"
                      title="Cámara apagada"
                    >
                      <VideocamOffIcon fontSize="inherit" />
                    </span>
                  ) : attention && attention.faces === 0 ? (
                    // Face not detected → don't show a (stale/placeholder) level badge.
                    <span
                      className={classes.cameraOffFlag}
                      data-testid="professor-room-shell-nomeasure-flag"
                      title="Sin medición — rostro no detectado"
                    >
                      <VisibilityOffIcon fontSize="inherit" />
                    </span>
                  ) : attention ? (
                    <span
                      className={classes.attBadge}
                      data-testid="professor-room-shell-attention-badge"
                      style={{
                        backgroundColor: attBadgeBg[attention.level],
                        color: attBadgeText[attention.level],
                      }}
                    >
                      {levelLabel[attention.level]}
                    </span>
                  ) : null}
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
                          <div
                            className={classes.rosterMenu}
                            data-testid="professor-room-shell-roster-menu"
                            role="menu"
                          >
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

          <div className={classes.notificationsSection} data-testid="professor-room-shell-notifications">
            <div className={classes.notificationsLabel}>Notificaciones</div>
            {notifications.length === 0 ? (
              <div className={classes.notificationsEmpty} data-testid="professor-room-shell-notifications-empty">
                Sin actividad por ahora.
              </div>
            ) : (
              <div className={classes.notificationItems}>
                {notifications.map(notification => (
                  <div key={notification.id} className={classes.notificationPill}>
                    <span className={classes.notificationEmoji} aria-hidden="true">
                      {notificationEmoji(notification.text)}
                    </span>
                    <span className={classes.notificationText}>{notification.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {proctoringEnabled && (
            <div className={classes.proctoringFeed} data-testid="professor-room-shell-proctoring-feed">
              <div className={classes.proctoringFeedTitle}>Alertas de proctoring ({visibleAlerts.length})</div>
              {visibleAlerts.map(alert => {
                const KindIcon = proctoringKindIcon[alert.kind];
                return (
                  <div
                    key={alert.id}
                    className={classes.proctoringAlertCard}
                    onClick={() => handleOpenProctoringModal(alert)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && handleOpenProctoringModal(alert)}
                  >
                    <div className={classes.proctoringAlertHeader}>
                      <KindIcon style={{ fontSize: 15, color: '#b45309' }} />
                      <span>{stripTeacherSuffix(alert.identity)}</span>
                    </div>
                    <span className={classes.proctoringAlertMeta}>
                      {proctoringKindLabel[alert.kind]} · {alert.detectedAt}
                    </span>
                  </div>
                );
              })}
              {source === 'mock' && <span className={classes.mockTag}>Datos simulados — pipeline CV pendiente</span>}
            </div>
          )}
        </aside>

        {/* ── CENTER STAGE ── */}
        <div className={classes.center} data-testid="professor-room-shell-center-stage">
          <div className={classes.stageContent}>{stage}</div>
          <div className={classes.toolbar} data-testid="professor-room-shell-toolbar-slot">
            {toolbarSlot}
          </div>
        </div>

        {/* ── RIGHT RAIL ── */}
        <aside className={classes.rightRail} data-testid="professor-room-shell-right-rail">
          <div className={classes.rightTabs} data-testid="professor-room-shell-right-tabs">
            <button
              type="button"
              className={clsx(classes.tab, { [classes.tabActive]: rightTab === 'grupo' })}
              data-testid="professor-room-shell-tab-grupo"
              aria-pressed={rightTab === 'grupo'}
              onClick={() => onRightTabChange?.('grupo')}
            >
              Grupo
            </button>
            <button
              type="button"
              className={clsx(classes.tab, { [classes.tabActive]: rightTab === 'individual' })}
              data-testid="professor-room-shell-tab-individual"
              aria-pressed={rightTab === 'individual'}
              onClick={() => onRightTabChange?.('individual')}
            >
              Individual
            </button>
            <button
              type="button"
              className={clsx(classes.tab, { [classes.tabActive]: rightTab === 'chat' })}
              data-testid="professor-room-shell-tab-chat"
              aria-pressed={rightTab === 'chat'}
              onClick={() => onRightTabChange?.('chat')}
            >
              Chat
            </button>
          </div>

          <div className={clsx(classes.rightContent, { [classes.rightContentChat]: rightTab === 'chat' })}>
            {rightTab === 'grupo' ? (
              <>
                <div className={classes.groupGauge} data-testid="professor-room-shell-group-gauge">
                  <GroupAttentionGauge
                    value={groupAttention}
                    level={attentionLevel(groupAttention)}
                    available={groupDataAvailable}
                  />
                  <span className={classes.gaugeLabel}>Atención grupal</span>
                </div>

                {!groupDataAvailable && (
                  <div className={classes.bannerInfo} data-testid="professor-room-shell-group-nodata-banner">
                    <WarningIcon className={classes.bannerInfoIcon} />
                    <span>Sin datos de atención — verificá la conexión de los estudiantes.</span>
                  </div>
                )}

                {isGroupBelowThreshold && (
                  <div className={classes.banner} data-testid="professor-room-shell-group-banner">
                    <WarningIcon className={classes.bannerIcon} />
                    <span>Atención grupal por debajo del umbral ({attentionThreshold}%)</span>
                  </div>
                )}

                <div data-testid="professor-room-shell-timeline-section">
                  <div className={classes.chartTitle}>Evolución temporal</div>
                  <div style={{ height: 120 }} data-testid="professor-room-shell-timeline">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timeline} margin={{ top: 4, right: 4, left: -24, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2ecf9" />
                        <XAxis
                          dataKey="time"
                          tick={{ fontSize: 8, fill: '#94a3b8' }}
                          minTickGap={40}
                          interval="preserveStartEnd"
                        />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: '#94a3b8' }} />
                        <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #e2ecf9' }} />
                        <ReferenceLine
                          y={attentionThreshold}
                          stroke="#ffb800"
                          strokeDasharray="4 4"
                          strokeWidth={1}
                          strokeOpacity={0.5}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#1d6eed"
                          strokeWidth={2}
                          fill="#1d6eed"
                          fillOpacity={0.1}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <button
                  type="button"
                  className={classes.viewReportButton}
                  data-testid="professor-room-shell-view-report"
                  onClick={() => setIsReportOpen(true)}
                >
                  <VisibilityIcon style={{ fontSize: 16 }} /> Ver reporte
                </button>
              </>
            ) : rightTab === 'individual' ? (
              <div data-testid="professor-room-shell-individual-list">
                {sortedParticipants.map(participant => {
                  if (participant.unsupported) {
                    // Mobile device — the CV pipeline is desktop-only, so attention is
                    // simply not measurable here. Distinct from "distracted" or "0%".
                    return (
                      <div key={participant.identity} className={classes.individualRow}>
                        <div className={classes.individualHeader}>
                          <span>{participant.identity}</span>
                        </div>
                        <span
                          className={classes.individualCameraOff}
                          data-testid="professor-room-shell-individual-unsupported"
                        >
                          <SmartphoneIcon fontSize="inherit" /> No medible (celular)
                        </span>
                      </div>
                    );
                  }
                  if (participant.cameraOff) {
                    // Camera off → no live attention. Show a muted state, never the stale value.
                    return (
                      <div key={participant.identity} className={classes.individualRow}>
                        <div className={classes.individualHeader}>
                          <span>{participant.identity}</span>
                        </div>
                        <span
                          className={classes.individualCameraOff}
                          data-testid="professor-room-shell-individual-cameraoff"
                        >
                          <VideocamOffIcon fontSize="inherit" /> Cámara apagada
                        </span>
                      </div>
                    );
                  }
                  if (participant.faces === 0) {
                    // Face not detected (turned away / lighting / angle) → the index has
                    // decayed to a placeholder 0. Show "sin medición", NOT "0% attention":
                    // we cannot claim she is distracted if we cannot see her face.
                    return (
                      <div key={participant.identity} className={classes.individualRow}>
                        <div className={classes.individualHeader}>
                          <span>{participant.identity}</span>
                        </div>
                        <span
                          className={classes.individualCameraOff}
                          data-testid="professor-room-shell-individual-nomeasure"
                        >
                          <VisibilityOffIcon fontSize="inherit" /> Sin medición — rostro no detectado
                        </span>
                      </div>
                    );
                  }
                  const pct = Math.max(0, Math.min(100, participant.index));
                  return (
                    <div key={participant.identity} className={classes.individualRow}>
                      <div className={classes.individualHeader}>
                        <span>{participant.identity}</span>
                        <span className={classes.individualScore}>{participant.index}</span>
                      </div>
                      <div className={classes.progressTrack}>
                        <div
                          className={classes.progressFill}
                          style={{ width: `${pct}%`, backgroundColor: levelColor[participant.level] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              rightPanel
            )}
          </div>
        </aside>
      </div>

      {/* ── PROCTORING MODAL ── */}
      {proctoringModalAlert && (
        <div className={classes.modalBackdrop} data-testid="professor-proctoring-modal">
          <div className={classes.modalCard}>
            <div className={classes.modalHeader}>
              <div className={classes.modalHeaderLeft}>
                <div className={classes.modalHeaderIcon}>
                  {ModalKindIcon && <ModalKindIcon style={{ fontSize: 20, color: '#b45309' }} />}
                </div>
                <div>
                  <div className={classes.modalTitle}>{proctoringKindLabel[proctoringModalAlert.kind]}</div>
                  <div className={classes.modalCaption}>Proctoring</div>
                </div>
              </div>
              <button
                type="button"
                className={classes.modalClose}
                aria-label="Cerrar"
                onClick={handleCloseProctoringModal}
                data-testid="professor-proctoring-modal-close"
              >
                ×
              </button>
            </div>

            <div className={classes.modalBody}>
              <div className={classes.studentCard}>
                <div className={classes.studentCardAvatar}>{getInitials(proctoringModalAlert.identity)}</div>
                <div className={classes.studentCardInfo}>
                  <div className={classes.studentCardName}>{stripTeacherSuffix(proctoringModalAlert.identity)}</div>
                  <div className={classes.studentCardRole}>Estudiante · Sesión activa</div>
                  <div className={classes.alertBox}>
                    <WarningIcon className={classes.alertBoxIcon} style={{ fontSize: 14, color: '#ffb800' }} />
                    <span className={classes.alertBoxText}>
                      {proctoringKindMessage(
                        proctoringModalAlert.kind,
                        stripTeacherSuffix(proctoringModalAlert.identity),
                        proctoringModalAlert.detectedAt
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className={classes.modalFooter}>
              <button
                type="button"
                className={classes.btnOutlined}
                onClick={handleMarkLegitimate}
                data-testid="professor-proctoring-modal-legitimate"
              >
                <CheckCircleOutlineIcon style={{ fontSize: 16, color: '#10b981' }} />
                Marcar como legítimo
              </button>
              <button
                type="button"
                className={classes.btnPrimary}
                onClick={handleSendWarning}
                data-testid="professor-proctoring-modal-warning"
              >
                ⚠ Enviar advertencia
              </button>
            </div>
          </div>
        </div>
      )}

      <AttentionReportOverlay
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        sessionName={sessionName}
        studentCount={studentCount}
      />
    </section>
  );
}
