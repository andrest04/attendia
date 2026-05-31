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
  high: '#14B053',
  medium: '#E6A817',
  low: '#E22525',
};

const levelLabel: Record<AttentionLevel, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    container: {
      background: '#FFFFFF',
      zIndex: 9,
      display: 'flex',
      flexDirection: 'column',
      borderLeft: '1px solid #E4E7E9',
      [theme.breakpoints.down('sm')]: {
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        zIndex: 100,
      },
    },
    hide: {
      display: 'none',
    },
    header: {
      height: '56px',
      background: '#F4F4F6',
      borderBottom: '1px solid #E4E7E9',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0 1em',
      flexShrink: 0,
    },
    headerText: {
      fontWeight: 'bold',
      fontSize: '0.9rem',
    },
    closeButton: {
      cursor: 'pointer',
      display: 'flex',
      background: 'transparent',
      border: '0',
      padding: '0.4em',
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
      fontWeight: 700,
      lineHeight: 1,
      color: 'rgb(40, 42, 43)',
    },
    indexLabel: {
      fontSize: '0.75rem',
      color: '#606B85',
      textAlign: 'center',
    },
    separator: {
      height: '1px',
      backgroundColor: '#E4E7E9',
    },
    // Section label
    sectionLabel: {
      fontSize: '0.75rem',
      fontWeight: 600,
      color: '#606B85',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
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
      color: 'rgb(40, 42, 43)',
    },
    metricValue: {
      fontSize: '0.75rem',
      color: '#606B85',
      fontVariantNumeric: 'tabular-nums',
    },
    progressTrack: {
      height: '6px',
      backgroundColor: '#E4E7E9',
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
    },
    // Lighting alert
    lightingAlert: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '6px',
      padding: '8px 10px',
      backgroundColor: '#FFF8E1',
      border: '1px solid #F9A825',
      borderRadius: '4px',
    },
    lightingText: {
      fontSize: '0.75rem',
      color: 'rgb(40, 42, 43)',
    },
    // Disabled state
    disabledMessage: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
      padding: '32px 16px',
      textAlign: 'center',
      color: '#606B85',
    },
    // Privacy note
    privacyNote: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '6px',
      padding: '8px 10px',
      backgroundColor: '#F4F4F6',
      border: '1px dashed #E4E7E9',
      borderRadius: '4px',
    },
    privacyText: {
      fontSize: '0.7rem',
      color: '#606B85',
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
export default function AttentionPanel() {
  const classes = useStyles();
  const { isAttentionPanelOpen, setIsAttentionPanelOpen } = useChatContext();
  const { self, enabled, setEnabled, attentionLevel } = useAttention();

  const level = attentionLevel(self.index);
  const chipColor = levelColor[level];

  return (
    <aside className={clsx(classes.container, { [classes.hide]: !isAttentionPanelOpen })} data-testid="attention-panel">
      {/* Header */}
      <div className={classes.header}>
        <span className={classes.headerText}>Mi Atención</span>
        <button
          className={classes.closeButton}
          onClick={() => setIsAttentionPanelOpen(false)}
          aria-label="Cerrar panel"
        >
          <CloseIcon />
        </button>
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
              <MetricBar value={self.components.eyes} color="#027AC5" />
            </div>

            <div className={classes.metricGroup}>
              <div className={classes.metricRow}>
                <span className={classes.metricLabel}>Postura</span>
                <span className={classes.metricValue}>{self.components.posture}</span>
              </div>
              <MetricBar value={self.components.posture} color="#027AC5" />
            </div>

            <div className={classes.metricGroup}>
              <div className={classes.metricRow}>
                <span className={classes.metricLabel}>Orientación</span>
                <span className={classes.metricValue}>{self.components.head}</span>
              </div>
              <MetricBar value={self.components.head} color="#027AC5" />
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
                  backgroundColor: self.capture === 'active' ? '#14B053' : '#E4E7E9',
                  color: self.capture === 'active' ? '#FFFFFF' : 'rgb(40, 42, 43)',
                }}
              />
              <Chip
                label={self.lighting === 'ok' ? 'Iluminación ok' : 'Iluminación baja'}
                size="small"
                className={classes.statusChip}
                data-testid="lighting-status"
                style={{
                  backgroundColor: self.lighting === 'ok' ? '#E4E7E9' : '#FFF8E1',
                  color: 'rgb(40, 42, 43)',
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
              <VisibilityIcon style={{ fontSize: 12, color: '#606B85', marginTop: 2 }} />
              <p className={classes.privacyText}>Análisis procesado localmente — no se almacenan datos</p>
            </div>
          </>
        ) : (
          /* Disabled state */
          <div className={classes.disabledMessage} data-testid="attention-disabled">
            <VisibilityIcon style={{ fontSize: 32, color: '#E4E7E9' }} />
            <Typography variant="body2" style={{ color: '#606B85' }}>
              Análisis de atención desactivado
            </Typography>
            <Typography variant="caption" style={{ color: '#9AA3B2' }}>
              Activa el análisis para ver tu índice de atención.
            </Typography>
          </div>
        )}
      </div>
    </aside>
  );
}
