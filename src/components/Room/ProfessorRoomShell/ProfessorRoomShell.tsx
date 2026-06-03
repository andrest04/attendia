import React from 'react';
import clsx from 'clsx';
import { makeStyles, Theme } from '@material-ui/core';
import WarningIcon from '@material-ui/icons/Warning';
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { useAttention } from '../../AttentionProvider';
import { AttentionLevel, ProctoringAlert } from '../../AttentionProvider/types';
import SessionStatusBar from './SessionStatusBar';
import GroupAttentionGauge from './GroupAttentionGauge';
import { exportAttentionReport, ExportFormat } from './exportAttentionReport';

const proctoringKindLabel: Record<ProctoringAlert['kind'], string> = {
  multiface: 'Múltiples rostros',
  absent: 'Sin presencia',
  away: 'Ausente',
};

const levelLabel: Record<AttentionLevel, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

const levelColor: Record<AttentionLevel, string> = {
  high: '#14B053',
  medium: '#E6A817',
  low: '#E22525',
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
    backgroundColor: theme.palette.background.default,
  },
  body: {
    flex: 1,
    minHeight: 0,
    display: 'grid',
    gridTemplateColumns: '240px 1fr 320px',
    gridTemplateRows: '1fr',
  },
  leftRail: {
    borderRight: `1px solid ${theme.palette.divider}`,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflowY: 'auto',
  },
  center: {
    minWidth: 0,
    display: 'grid',
    gridTemplateRows: 'auto 1fr auto',
    overflow: 'hidden',
  },
  stageHeader: {
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    fontSize: 12,
  },
  stageContent: {
    minHeight: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  toolbar: {
    borderTop: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1),
  },
  rightRail: {
    borderLeft: `1px solid ${theme.palette.divider}`,
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    minWidth: 0,
  },
  rightTabs: {
    display: 'flex',
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  tab: {
    flex: 1,
    padding: theme.spacing(1.25, 2),
    fontSize: 12,
    fontWeight: 600,
    textAlign: 'center',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    marginBottom: -1,
    color: theme.palette.text.secondary,
    cursor: 'pointer',
  },
  tabActive: {
    color: theme.palette.text.primary,
    borderBottomColor: theme.palette.text.primary,
  },
  rightContent: {
    minHeight: 0,
    overflowY: 'auto',
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  section: {
    padding: theme.spacing(1.5),
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: 12,
    marginBottom: theme.spacing(1),
  },
  contextLine: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginTop: theme.spacing(0.5),
  },
  handsQueue: {
    padding: theme.spacing(1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: '#FAFAFA',
  },
  handRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 0),
  },
  handIdentity: {
    fontSize: 12,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  grantTurnButton: {
    flexShrink: 0,
    padding: theme.spacing(0.25, 1),
    fontSize: 11,
    fontWeight: 600,
    color: '#FFFFFF',
    backgroundColor: '#027AC5',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#0269A8',
    },
  },
  proctoringFeed: {
    padding: theme.spacing(1.5),
    borderTop: `1px solid ${theme.palette.divider}`,
    marginTop: 'auto',
  },
  proctoringAlert: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: theme.spacing(1),
    borderRadius: 4,
    backgroundColor: '#FFF8E1',
    marginBottom: theme.spacing(1),
  },
  proctoringAlertHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    fontWeight: 600,
    color: '#7A4B00',
  },
  proctoringAlertMeta: {
    fontSize: 11,
    color: theme.palette.text.secondary,
  },
  mockTag: {
    fontSize: 9,
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
  },
  participantRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    fontSize: 12,
  },
  participantName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  badge: {
    fontSize: 9,
    padding: '1px 5px',
    borderRadius: 3,
    color: '#FFFFFF',
  },
  groupGauge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    borderRadius: 4,
    backgroundColor: '#FFF8E1',
    border: '1px solid #E6A817',
    color: '#7A4B00',
    fontSize: 12,
  },
  bannerIcon: {
    fontSize: 16,
    color: '#E6A817',
    flexShrink: 0,
  },
  chartTitle: {
    fontWeight: 600,
    fontSize: 12,
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
  },
  individualRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  individualHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#E4E7E9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  exportContainer: {
    position: 'relative',
  },
  exportButton: {
    width: '100%',
    padding: theme.spacing(1.25),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 6,
    backgroundColor: theme.palette.background.default,
    fontSize: 12,
    cursor: 'pointer',
  },
  exportMenu: {
    position: 'absolute',
    bottom: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 6,
    overflow: 'hidden',
    boxShadow: theme.shadows[3],
    zIndex: 10,
  },
  exportMenuItem: {
    padding: theme.spacing(1, 1.5),
    fontSize: 12,
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
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
  onExportReport?: (format: ExportFormat) => void;
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
  onExportReport,
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

  const [isExportMenuOpen, setIsExportMenuOpen] = React.useState(false);

  // Defaults to a client-side download (PDF or Excel) of the current attention
  // snapshot; `onExportReport` lets a parent intercept (e.g. a real backend later).
  const runExport = (format: ExportFormat) => {
    setIsExportMenuOpen(false);
    if (onExportReport) {
      onExportReport(format);
      return;
    }
    exportAttentionReport(format, {
      source,
      groupAttention,
      attentionThreshold,
      timeline,
      participants,
      proctoringAlerts,
    });
  };

  return (
    <section className={classes.root} data-testid="professor-room-shell-root">
      <SessionStatusBar
        sessionName={sessionName}
        studentCount={Math.max(0, participantCount - 1)}
        recording={recording}
      />
      <div className={classes.body}>
        <aside className={classes.leftRail} data-testid="professor-room-shell-left-rail">
          <div className={classes.section}>
            <div className={classes.sectionTitle}>Participantes</div>
            <div className={classes.contextLine} data-testid="professor-room-shell-participant-count">
              {participantCount} en sala
            </div>
          </div>

          {handsRaised.length > 0 && (
            <div className={classes.handsQueue} data-testid="professor-room-shell-hands-queue">
              <div className={classes.sectionTitle}>Manos levantadas ({handsRaised.length})</div>
              {handsRaised.map(identity => (
                <div key={identity} className={classes.handRow}>
                  <span className={classes.handIdentity}>{identity}</span>
                  <button type="button" className={classes.grantTurnButton} onClick={() => onGrantTurn?.(identity)}>
                    Dar turno
                  </button>
                </div>
              ))}
            </div>
          )}

          <div data-testid="professor-room-shell-roster">
            {participants.map(participant => (
              <div key={participant.identity} className={classes.participantRow}>
                <span className={classes.participantName}>{participant.identity}</span>
                {participant.multiface && (
                  <span data-testid="professor-room-shell-multiface-flag" title="Múltiples rostros detectados">
                    ⚠
                  </span>
                )}
                <span className={classes.badge} style={{ backgroundColor: levelColor[participant.level] }}>
                  {levelLabel[participant.level]}
                </span>
              </div>
            ))}
          </div>

          {proctoringEnabled && (
            <div className={classes.proctoringFeed} data-testid="professor-room-shell-proctoring-feed">
              <div className={classes.sectionTitle}>Alertas de proctoring ({proctoringAlerts.length})</div>
              {proctoringAlerts.map(alert => (
                <div key={alert.id} className={classes.proctoringAlert}>
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

        <div className={classes.center} data-testid="professor-room-shell-center-stage">
          <header className={classes.stageHeader} data-testid="professor-room-shell-stage-header">
            <div>{sessionLabel}</div>
            {isGroupBelowThreshold && (
              <div className={classes.banner} data-testid="professor-room-shell-group-banner">
                <WarningIcon className={classes.bannerIcon} />
                <span>Atención grupal por debajo del umbral ({attentionThreshold}%)</span>
              </div>
            )}
          </header>
          <div className={classes.stageContent}>{stage}</div>
          <div className={classes.toolbar} data-testid="professor-room-shell-toolbar-slot">
            {toolbarSlot}
          </div>
        </div>

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
                  <div className={classes.contextLine}>Atención grupal (0–100)</div>
                </div>
                {isGroupBelowThreshold && (
                  <div className={classes.banner}>
                    <WarningIcon className={classes.bannerIcon} />
                    <span>Atención grupal por debajo del umbral</span>
                  </div>
                )}
                <div data-testid="professor-room-shell-timeline-section">
                  <div className={classes.chartTitle}>Evolución temporal</div>
                  <div style={{ height: 130 }} data-testid="professor-room-shell-timeline">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timeline} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E4E7E9" />
                        <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#606B85' }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#606B85' }} />
                        <Tooltip contentStyle={{ fontSize: 10 }} />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#027AC5"
                          strokeWidth={2}
                          fill="#027AC5"
                          fillOpacity={0.15}
                          dot={{ r: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className={classes.exportContainer}>
                  <button
                    type="button"
                    className={classes.exportButton}
                    onClick={() => setIsExportMenuOpen(open => !open)}
                    aria-haspopup="menu"
                    aria-expanded={isExportMenuOpen}
                  >
                    Exportar reporte
                  </button>
                  {isExportMenuOpen && (
                    <div className={classes.exportMenu} role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        className={classes.exportMenuItem}
                        onClick={() => runExport('pdf')}
                      >
                        PDF
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className={classes.exportMenuItem}
                        onClick={() => runExport('xlsx')}
                      >
                        Excel (.xlsx)
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div data-testid="professor-room-shell-individual-list">
                {sortedParticipants.map(participant => {
                  const pct = levelPercent[attentionLevel(participant.index)];
                  return (
                    <div key={participant.identity} className={classes.individualRow}>
                      <div className={classes.individualHeader}>
                        <span>{participant.identity}</span>
                        <span className={classes.contextLine}>{participant.index}</span>
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
    </section>
  );
}
