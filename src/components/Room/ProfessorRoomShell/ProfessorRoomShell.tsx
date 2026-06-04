import React from 'react';
import clsx from 'clsx';
import { makeStyles, Theme, Slider } from '@material-ui/core';
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline';
import WarningIcon from '@material-ui/icons/Warning';
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Tooltip } from 'recharts';
import { useAttention } from '../../AttentionProvider';
import { AttentionLevel } from '../../AttentionProvider/types';
import { levelColor, levelLabel, proctoringKindLabel } from '../../AttentionProvider/attentionLabels';
import SessionStatusBar from './SessionStatusBar';
import GroupAttentionGauge from './GroupAttentionGauge';
import AttentionReportOverlay from '../AttentionReportOverlay/AttentionReportOverlay';

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

const levelPercent: Record<AttentionLevel, number> = {
  high: 85,
  medium: 60,
  low: 35,
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
  rosterName: {
    flex: 1,
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

  // Proctoring feed
  proctoringFeed: {
    borderTop: '1px solid #e2ecf9',
    padding: '12px 18px',
    marginTop: 'auto',
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
    justifyContent: 'space-between',
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
  gaugeSub: {
    fontFamily: 'Inter, sans-serif',
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
  },
  chartTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: 12,
    color: '#1d2f6f',
    marginBottom: theme.spacing(1),
  },
  exportButton: {
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
    overflow: 'hidden',
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
  sliderSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  sliderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderLabel: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: 13,
    color: '#1d2f6f',
  },
  sliderValue: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 13,
    color: '#1d6eed',
  },
  sliderMarks: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 10,
    color: '#94a3b8',
    fontFamily: 'Inter, sans-serif',
    marginTop: -4,
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

export type ProfessorRightTab = 'grupo' | 'individual';

interface Props {
  stage: React.ReactNode;
  toolbarSlot?: React.ReactNode;
  rightTab?: ProfessorRightTab;
  onRightTabChange?: (tab: ProfessorRightTab) => void;
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
  /** When true, surface the proctoring alerts feed (US30). Driven by the toolbar toggle. */
  proctoringEnabled?: boolean;
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
  sessionLabel = 'Sesión Twilio en vivo',
  sessionName = 'Sesión Twilio en vivo',
  participantCount = 0,
  recording = false,
  handsRaised = [],
  onGrantTurn,
  proctoringEnabled = false,
}: Props) {
  const classes = useStyles();
  const {
    groupAttention,
    attentionThreshold,
    timeline,
    participants,
    proctoringAlerts,
    source,
    attentionLevel,
  } = useAttention();
  const isGroupBelowThreshold = groupAttention < attentionThreshold;
  const sortedParticipants = [...participants].sort((a, b) => b.index - a.index);
  const studentCount = Math.max(0, participantCount - 1);

  const [isReportOpen, setIsReportOpen] = React.useState(false);

  // Proctoring modal local state
  const [proctoringModalAlert, setProctoringModalAlert] = React.useState<null | typeof proctoringAlerts[0]>(null);
  const [sensitivityValue, setSensitivityValue] = React.useState<number>(65);

  const handleOpenProctoringModal = (alert: typeof proctoringAlerts[0]) => {
    setProctoringModalAlert(alert);
  };
  const handleCloseProctoringModal = () => {
    setProctoringModalAlert(null);
  };
  const handleMarkLegitimate = () => {
    setProctoringModalAlert(null);
  };
  const handleSendWarning = () => {
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
                    <span className={classes.handIdentity}>{identity}</span>
                  </div>
                  <button type="button" className={classes.grantTurnButton} onClick={() => onGrantTurn?.(identity)}>
                    Dar turno
                  </button>
                </div>
              ))}
            </div>
          )}

          <div data-testid="professor-room-shell-roster">
            {participants.map(participant => (
              <div key={participant.identity} className={classes.rosterRow}>
                <div className={classes.rosterAvatar}>{getInitials(participant.identity)}</div>
                <span className={classes.rosterName}>{participant.identity}</span>
                {participant.multiface && (
                  <span
                    className={classes.multifaceWarning}
                    data-testid="professor-room-shell-multiface-flag"
                    title="Múltiples rostros detectados"
                  >
                    ⚠
                  </span>
                )}
                <span
                  className={classes.attBadge}
                  style={{
                    backgroundColor: attBadgeBg[participant.level],
                    color: attBadgeText[participant.level],
                  }}
                >
                  {levelLabel[participant.level]}
                </span>
              </div>
            ))}
          </div>

          {proctoringEnabled && (
            <div className={classes.proctoringFeed} data-testid="professor-room-shell-proctoring-feed">
              <div className={classes.proctoringFeedTitle}>Alertas de proctoring ({proctoringAlerts.length})</div>
              {proctoringAlerts.map(alert => (
                <div
                  key={alert.id}
                  className={classes.proctoringAlertCard}
                  onClick={() => handleOpenProctoringModal(alert)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && handleOpenProctoringModal(alert)}
                >
                  <div className={classes.proctoringAlertHeader}>
                    <span>{alert.identity}</span>
                    <span>{Math.round(alert.confidence * 100)}%</span>
                  </div>
                  <span className={classes.proctoringAlertMeta}>
                    {proctoringKindLabel[alert.kind]} · {alert.detectedAt}
                  </span>
                </div>
              ))}
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
          </div>

          <div className={classes.rightContent}>
            {rightTab === 'grupo' ? (
              <>
                <div className={classes.groupGauge} data-testid="professor-room-shell-group-gauge">
                  <GroupAttentionGauge value={groupAttention} level={attentionLevel(groupAttention)} />
                  <span className={classes.gaugeLabel}>Atención grupal</span>
                  <span className={classes.gaugeSub}>(US24)</span>
                </div>

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
                        <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#94a3b8' }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: '#94a3b8' }} />
                        <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #e2ecf9' }} />
                        <ReferenceLine
                          y={attentionThreshold}
                          stroke="#ffb800"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#1d6eed"
                          strokeWidth={2}
                          fill="#1d6eed"
                          fillOpacity={0.1}
                          dot={{ r: 2, fill: '#1d6eed', strokeWidth: 0 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <button
                  type="button"
                  className={classes.exportButton}
                  data-testid="professor-room-shell-export"
                  onClick={() => setIsReportOpen(true)}
                >
                  <span>&#8595;</span> Exportar reporte
                </button>
              </>
            ) : (
              <div data-testid="professor-room-shell-individual-list">
                {sortedParticipants.map(participant => {
                  const pct = levelPercent[attentionLevel(participant.index)];
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
                <div className={classes.modalHeaderIcon}>⚠️</div>
                <div>
                  <div className={classes.modalTitle}>Detección múltiple de rostros</div>
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
                  <div className={classes.studentCardName}>{proctoringModalAlert.identity}</div>
                  <div className={classes.studentCardRole}>Estudiante · Sesión activa</div>
                  <div className={classes.alertBox}>
                    <WarningIcon className={classes.alertBoxIcon} style={{ fontSize: 14, color: '#ffb800' }} />
                    <span className={classes.alertBoxText}>
                      Se detectaron 2 rostros en la cámara de {proctoringModalAlert.identity} · Detectado a la{' '}
                      {proctoringModalAlert.detectedAt} · Confianza: {Math.round(proctoringModalAlert.confidence * 100)}
                      %
                    </span>
                  </div>
                </div>
              </div>

              <div className={classes.sliderSection}>
                <div className={classes.sliderHeader}>
                  <span className={classes.sliderLabel}>Umbral de sensibilidad de proctoring</span>
                  <span className={classes.sliderValue}>{sensitivityValue}%</span>
                </div>
                <Slider
                  value={sensitivityValue}
                  onChange={(_e, val) => setSensitivityValue(val as number)}
                  min={0}
                  max={100}
                  aria-label="Umbral de sensibilidad"
                  data-testid="professor-proctoring-modal-slider"
                />
                <div className={classes.sliderMarks}>
                  <span>Permisivo</span>
                  <span>Estricto</span>
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
