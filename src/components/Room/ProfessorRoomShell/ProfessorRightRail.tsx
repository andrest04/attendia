import React from 'react';
import clsx from 'clsx';
import { makeStyles, Theme } from '@material-ui/core';
import VisibilityIcon from '@material-ui/icons/Visibility';
import WarningIcon from '@material-ui/icons/Warning';
import { AttentionLevel, AttentionTimelinePoint, ParticipantAttention } from '../../AttentionProvider/types';
import { ATTENTION_LEVEL_STYLE } from '../../AttentionProvider/attentionLevelStyle';
import { classifyAttention } from '../../AttentionProvider/presence';
import { attentionStatusColors } from '../../../theme';
import { CollapsibleRail, RailCloseButton } from '../ShellLayout/CollapsibleRail';
import GroupAttentionGauge from './GroupAttentionGauge';
import { presenceView, ProfessorRightTab } from './professorShellHelpers';
import { t } from '../../../i18n/translate';

// Code-split the timeline chart: it is the only recharts consumer on the professor
// room path, so lazy-loading it keeps recharts out of the main bundle. The chunk is
// requested the first time the rail renders with `open` true (rails start collapsed).
const AttentionTimelineChart = React.lazy(() => import('./AttentionTimelineChart'));

const useStyles = makeStyles((theme: Theme) => ({
  rightRail: {
    backgroundColor: '#ffffff',
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
    color: attentionStatusColors.medium,
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
  individualCameraOff: {
    fontFamily: 'Inter, sans-serif',
    fontSize: 11,
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
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
}));

interface ProfessorRightRailProps {
  /** Whether the rail is open. Collapses to 0px (still mounted) when false. */
  open: boolean;
  /** Dismiss the rail from its tabs × button. */
  onClose?: () => void;
  rightTab: ProfessorRightTab;
  onRightTabChange?: (tab: ProfessorRightTab) => void;
  groupAttention: number;
  groupDataAvailable: boolean;
  attentionThreshold: number;
  /** True only when there is a real reading below the threshold (parent guards the placeholder). */
  isGroupBelowThreshold: boolean;
  timeline: AttentionTimelinePoint[];
  attentionLevel: (score: number) => AttentionLevel;
  /** Attention participants sorted high→low index, for the Individual tab. */
  sortedParticipants: ParticipantAttention[];
  onOpenReport: () => void;
  /** Content for the chat tab — the embedded ChatWindow, resolved by Room.tsx. */
  rightPanel?: React.ReactNode;
}

/**
 * The professor shell's right rail: the three analytics tabs (grupo | individual |
 * chat). Grupo shows the group gauge, banners and the timeline chart; Individual
 * lists per-student attention (with the camera-off / no-measure / unsupported
 * states); Chat renders the embedded ChatWindow passed via `rightPanel`.
 */
export default function ProfessorRightRail({
  open,
  onClose,
  rightTab,
  onRightTabChange,
  groupAttention,
  groupDataAvailable,
  attentionThreshold,
  isGroupBelowThreshold,
  timeline,
  attentionLevel,
  sortedParticipants,
  onOpenReport,
  rightPanel = null,
}: ProfessorRightRailProps) {
  const classes = useStyles();

  return (
    <CollapsibleRail
      side="right"
      open={open}
      className={classes.rightRail}
      data-testid="professor-room-shell-right-rail"
    >
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
        {onClose && (
          <RailCloseButton
            onClick={onClose}
            aria-label={t('Cerrar panel')}
            data-testid="professor-room-shell-close-right"
          />
        )}
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
              <span className={classes.gaugeLabel}>{t('Atención grupal')}</span>
            </div>

            {!groupDataAvailable && (
              <div className={classes.bannerInfo} data-testid="professor-room-shell-group-nodata-banner">
                <WarningIcon className={classes.bannerInfoIcon} />
                <span>{t('Sin datos de atención, verifica la conexión de los estudiantes.')}</span>
              </div>
            )}

            {isGroupBelowThreshold && (
              <div className={classes.banner} data-testid="professor-room-shell-group-banner">
                <WarningIcon className={classes.bannerIcon} />
                <span>Atención grupal por debajo del umbral ({attentionThreshold}%)</span>
              </div>
            )}

            <div data-testid="professor-room-shell-timeline-section">
              <div className={classes.chartTitle}>{t('Evolución temporal')}</div>
              <div style={{ height: 120 }} data-testid="professor-room-shell-timeline">
                {/* Skip the chart while the rail is collapsed to 0px: recharts'
                    ResponsiveContainer warns when it measures a 0-width parent.
                    The fixed-height wrapper above keeps the layout stable while the
                    lazy chunk loads (fallback renders nothing inside it). */}
                {open && (
                  <React.Suspense fallback={null}>
                    <AttentionTimelineChart timeline={timeline} attentionThreshold={attentionThreshold} />
                  </React.Suspense>
                )}
              </div>
            </div>

            <button
              type="button"
              className={classes.viewReportButton}
              data-testid="professor-room-shell-view-report"
              onClick={onOpenReport}
            >
              <VisibilityIcon style={{ fontSize: 16 }} /> Ver reporte
            </button>
          </>
        ) : rightTab === 'individual' ? (
          <div data-testid="professor-room-shell-individual-list">
            {sortedParticipants.map(participant => {
              const presence = classifyAttention(participant);
              if (presence !== 'measured') {
                // No reading: say why instead of showing a stale value or a misleading 0%.
                const { Icon, label, individualTestId } = presenceView[presence];
                return (
                  <div key={participant.identity} className={classes.individualRow}>
                    <div className={classes.individualHeader}>
                      <span>{participant.identity}</span>
                    </div>
                    <span className={classes.individualCameraOff} data-testid={individualTestId}>
                      <Icon fontSize="inherit" /> {label}
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
                      style={{ width: `${pct}%`, backgroundColor: ATTENTION_LEVEL_STYLE[participant.level].color }}
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
    </CollapsibleRail>
  );
}
