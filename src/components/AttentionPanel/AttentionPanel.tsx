import React from 'react';
import { makeStyles, createStyles, Theme } from '@material-ui/core/styles';
import { Switch, FormControlLabel, Typography, Chip } from '@material-ui/core';
import WarningIcon from '@material-ui/icons/Warning';
import VisibilityIcon from '@material-ui/icons/Visibility';
import clsx from 'clsx';
import CloseIcon from '../../icons/CloseIcon';
import { useAttention } from '../AttentionProvider';
import useChatContext from '../../hooks/useChatContext/useChatContext';
import { AttentionLevel } from '../AttentionProvider/types';

const levelColor: Record<AttentionLevel, string> = {
  high: '#10b981',
  medium: '#ffb800',
  low: '#ef4444',
};

const levelLabel: Record<AttentionLevel, string> = {
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
};

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    container: {
      background: '#FFFFFF',
      zIndex: 9,
      display: 'flex',
      flexDirection: 'column',
      borderLeft: '1px solid #e2ecf9',
      [theme.breakpoints.down('sm')]: {
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        zIndex: 100,
      },
    },
    // Embedded mode: no extra border (right rail already provides it)
    embedded: {
      borderLeft: 'none',
      flex: 1,
      minHeight: 0,
    },
    hide: {
      display: 'none',
    },
    header: {
      height: '56px',
      background: '#f0f5ff',
      borderBottom: '1px solid #e2ecf9',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0 1em',
      flexShrink: 0,
    },
    headerText: {
      fontFamily: 'Poppins, Inter, sans-serif',
      fontWeight: 700,
      fontSize: 14,
      color: theme.palette.secondary.main,
    },
    closeButton: {
      cursor: 'pointer',
      display: 'flex',
      background: 'transparent',
      border: '0',
      padding: '0.4em',
      color: '#64748b',
    },
    body: {
      flex: 1,
      overflowY: 'auto',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    },
    // Privacy toggle section
    privacySection: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    },
    // Gauge area
    gaugeWrapper: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 0',
    },
    indexNumber: {
      fontSize: '3rem',
      fontFamily: 'Poppins, Inter, sans-serif',
      fontWeight: 700,
      lineHeight: 1,
      color: theme.palette.secondary.main,
    },
    indexLabel: {
      fontSize: '0.75rem',
      fontFamily: 'Inter, sans-serif',
      color: '#64748b',
      textAlign: 'center',
    },
    separator: {
      height: '1px',
      backgroundColor: '#e2ecf9',
    },
    // Section label
    sectionLabel: {
      fontSize: '0.75rem',
      fontFamily: 'Poppins, Inter, sans-serif',
      fontWeight: 600,
      color: '#94a3b8',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.7px',
    },
    // Metric row (label + bar)
    metricGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    },
    metricRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    metricLabel: {
      fontSize: '0.8rem',
      fontFamily: 'Inter, sans-serif',
      color: theme.palette.secondary.main,
    },
    metricValue: {
      fontSize: '0.75rem',
      fontFamily: 'Inter, sans-serif',
      color: '#64748b',
      fontVariantNumeric: 'tabular-nums',
    },
    progressTrack: {
      height: '6px',
      backgroundColor: '#e2ecf9',
      borderRadius: '3px',
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: '3px',
      transition: 'width 0.3s ease',
    },
    // Status chips
    statusRow: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap' as const,
    },
    statusChip: {
      fontSize: '0.7rem',
      height: '22px',
      fontFamily: 'Inter, sans-serif',
    },
    // Lighting alert
    lightingAlert: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '6px',
      padding: '8px 10px',
      backgroundColor: '#FFF8E1',
      border: '1px solid #F9A825',
      borderRadius: '8px',
    },
    lightingText: {
      fontSize: '0.75rem',
      fontFamily: 'Inter, sans-serif',
      color: theme.palette.secondary.main,
    },
    // Disabled state
    disabledMessage: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
      padding: '32px 16px',
      textAlign: 'center',
      color: '#64748b',
    },
    // Privacy note
    privacyNote: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '6px',
      padding: '8px 10px',
      backgroundColor: theme.palette.background.default,
      border: '1px dashed #e2ecf9',
      borderRadius: '8px',
    },
    privacyText: {
      fontSize: '0.7rem',
      fontFamily: 'Inter, sans-serif',
      color: '#64748b',
      margin: 0,
    },
  })
);

/** Renders a thin horizontal progress bar (0–100). */
function MetricBar({ value, color }: { value: number; color: string }) {
  const classes = useStyles();
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={classes.progressTrack}>
      <div className={classes.progressFill} style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

/**
 * Mi Atención panel — shows the local student's own attention data.
 * Visibility is toggled by the `isAttentionPanelOpen` flag in ChatContext
 * (same pattern as ChatWindow / isChatWindowOpen).
 */
interface AttentionPanelProps {
  embedded?: boolean;
  isVisible?: boolean;
}

export default function AttentionPanel({ embedded = false, isVisible = true }: AttentionPanelProps = {}) {
  const classes = useStyles();
  const { isAttentionPanelOpen, setIsAttentionPanelOpen } = useChatContext();
  const { self, enabled, setEnabled, attentionLevel } = useAttention();
  const effectiveVisible = embedded ? isVisible : isAttentionPanelOpen;

  const level = attentionLevel(self.index);
  const chipColor = levelColor[level];

  return (
    <aside
      className={clsx(classes.container, {
        [classes.embedded]: embedded,
        [classes.hide]: !effectiveVisible,
      })}
      data-testid="attention-panel"
      aria-hidden={!effectiveVisible}
    >
      {/* Header — only shown in drawer/standalone mode */}
      <div className={classes.header}>
        <span className={classes.headerText}>Mi Atención</span>
        {!embedded && (
          <button
            className={classes.closeButton}
            onClick={() => setIsAttentionPanelOpen(false)}
            aria-label="Cerrar panel"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Body */}
      <div className={classes.body}>
        {/* Privacy toggle */}
        <div className={classes.privacySection}>
          <FormControlLabel
            control={
              <Switch
                checked={enabled}
                onChange={e => setEnabled(e.target.checked)}
                color="primary"
                inputProps={{ 'aria-label': 'Análisis de atención' }}
                data-testid="attention-toggle"
              />
            }
            label={<Typography variant="body2">Análisis de atención</Typography>}
          />
        </div>

        {enabled ? (
          <>
            {/* Index number + level chip */}
            <div className={classes.gaugeWrapper}>
              <span className={classes.indexNumber} data-testid="attention-index">
                {self.index}
              </span>
              <span className={classes.indexLabel}>Índice de atención (0–100)</span>
              <Chip
                label={levelLabel[level]}
                size="small"
                className={classes.statusChip}
                data-testid="attention-level-chip"
                style={{ backgroundColor: chipColor, color: '#FFFFFF' }}
              />
            </div>

            <div className={classes.separator} />

            {/* Component bars */}
            <span className={classes.sectionLabel}>Componentes</span>

            <div className={classes.metricGroup}>
              <div className={classes.metricRow}>
                <span className={classes.metricLabel}>Ojos</span>
                <span className={classes.metricValue}>{self.components.eyes}</span>
              </div>
              <MetricBar value={self.components.eyes} color="#1d6eed" />
            </div>

            <div className={classes.metricGroup}>
              <div className={classes.metricRow}>
                <span className={classes.metricLabel}>Postura</span>
                <span className={classes.metricValue}>{self.components.posture}</span>
              </div>
              <MetricBar value={self.components.posture} color="#1d6eed" />
            </div>

            <div className={classes.metricGroup}>
              <div className={classes.metricRow}>
                <span className={classes.metricLabel}>Orientación</span>
                <span className={classes.metricValue}>{self.components.head}</span>
              </div>
              <MetricBar value={self.components.head} color="#1d6eed" />
            </div>

            <div className={classes.separator} />

            {/* Capture + lighting status */}
            <span className={classes.sectionLabel}>Estado de captura</span>

            <div className={classes.statusRow}>
              <Chip
                label={self.capture === 'active' ? 'Análisis activo' : 'Análisis inactivo'}
                size="small"
                className={classes.statusChip}
                data-testid="capture-status"
                style={{
                  backgroundColor: self.capture === 'active' ? '#10b981' : '#e2ecf9',
                  color: self.capture === 'active' ? '#FFFFFF' : '#1d2f6f',
                }}
              />
              <Chip
                label={self.lighting === 'ok' ? 'Iluminación ok' : 'Iluminación baja'}
                size="small"
                className={classes.statusChip}
                data-testid="lighting-status"
                style={{
                  backgroundColor: self.lighting === 'ok' ? '#e2ecf9' : '#FFF8E1',
                  color: '#1d2f6f',
                  border: self.lighting === 'low' ? '1px solid #F9A825' : undefined,
                }}
              />
            </div>

            {/* Lighting warning (only when low) */}
            {self.lighting === 'low' && (
              <div className={classes.lightingAlert} data-testid="lighting-alert">
                <WarningIcon style={{ fontSize: 14, color: '#F9A825', marginTop: 1 }} />
                <span className={classes.lightingText}>Iluminación insuficiente detectada</span>
              </div>
            )}

            {/* Privacy note */}
            <div className={classes.privacyNote}>
              <VisibilityIcon style={{ fontSize: 12, color: '#64748b', marginTop: 2 }} />
              <p className={classes.privacyText}>Análisis procesado localmente — no se almacenan datos</p>
            </div>
          </>
        ) : (
          /* Disabled state */
          <div className={classes.disabledMessage} data-testid="attention-disabled">
            <VisibilityIcon style={{ fontSize: 32, color: '#e2ecf9' }} />
            <Typography variant="body2" style={{ color: '#64748b' }}>
              Análisis de atención desactivado
            </Typography>
            <Typography variant="caption" style={{ color: '#94a3b8' }}>
              Activa el análisis para ver tu índice de atención.
            </Typography>
          </div>
        )}
      </div>
    </aside>
  );
}
