import React, { useEffect } from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import Snackbar from '@material-ui/core/Snackbar';
import DescriptionIcon from '@material-ui/icons/Description';
import GetAppIcon from '@material-ui/icons/GetApp';
import EventIcon from '@material-ui/icons/Event';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import CloseIcon from '@material-ui/icons/Close';
import { LineChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

import { useAttention } from '../../AttentionProvider';
import { AttentionLevel } from '../../AttentionProvider/types';
import { levelColor, levelLabel } from '../../AttentionProvider/attentionLabels';
import { exportAttentionReport, ExportFormat } from '../ProfessorRoomShell/exportAttentionReport';

const MOCK_DISCLOSURE = 'Datos simulados — pipeline CV pendiente';

/** Background color per level chip on the "Nivel" column. */
const levelChipBg: Record<AttentionLevel, string> = {
  high: '#d1fae5',
  medium: '#fef3c7',
  low: '#fee2e2',
};

/** Text color per level chip on the "Nivel" column. */
const levelChipFg: Record<AttentionLevel, string> = {
  high: '#065f46',
  medium: '#92400e',
  low: '#991b1b',
};

/** Value color for each KPI card. */
const KPI_COLORS = {
  group: '#1d6eed',
  students: '#059669',
  alerts: '#ef4444',
  threshold: '#ffb800',
};

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    position: 'absolute',
    inset: 0,
    zIndex: theme.zIndex.modal,
    backgroundColor: '#f0f5ff',
    overflowY: 'auto',
  },
  page: {
    maxWidth: 1020,
    margin: '0 auto',
    padding: theme.spacing(4, 3, 8),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
    [theme.breakpoints.down('xs')]: {
      padding: theme.spacing(2, 2, 6),
    },
  },
  // ── Header card ──────────────────────────────────────────────────────────
  headerCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2ecf9',
    borderRadius: 20,
    boxShadow: '0px 2px 12px 0px rgba(29,110,237,0.08), 0px 1px 3px 0px rgba(0,0,0,0.04)',
    padding: theme.spacing(3, 4),
  },
  headerTop: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#ebf3ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerIcon: {
    fontSize: 20,
    color: '#1d6eed',
  },
  titleText: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 800,
    fontSize: '1.375rem',
    lineHeight: '27.5px',
    color: '#1d2f6f',
  },
  sessionLine: {
    fontSize: '0.8125rem',
    lineHeight: '19.5px',
    color: '#64748b',
    marginBottom: theme.spacing(1.5),
    '& strong': {
      color: '#1d2f6f',
      fontWeight: 700,
    },
  },
  chipsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    alignItems: 'center',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f5ff',
    border: '1px solid #e2ecf9',
    borderRadius: 20,
    padding: '7px 15px',
    fontSize: '0.75rem',
    color: '#64748b',
    lineHeight: '18px',
  },
  chipIcon: {
    fontSize: 13,
    color: '#94a3b8',
  },
  mockTag: {
    display: 'inline-block',
    fontSize: '0.6875rem',
    fontStyle: 'italic',
    color: theme.palette.text.secondary,
    padding: '2px 10px',
    borderRadius: 3,
    border: `1px dashed ${theme.palette.text.secondary}`,
  },
  // ── KPI grid ─────────────────────────────────────────────────────────────
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
    [theme.breakpoints.down('xs')]: {
      gridTemplateColumns: '1fr',
    },
  },
  kpiCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2ecf9',
    borderRadius: 18,
    boxShadow: '0px 2px 12px 0px rgba(29,110,237,0.08), 0px 1px 3px 0px rgba(0,0,0,0.04)',
    padding: '23px 25px',
    overflow: 'hidden',
  },
  kpiLabel: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.6875rem',
    lineHeight: '16.5px',
    letterSpacing: '0.77px',
    textTransform: 'uppercase',
    color: '#94a3b8',
    marginBottom: 10,
  },
  kpiValueRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
  },
  kpiValue: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 800,
    fontSize: '2rem',
    lineHeight: '48px',
  },
  kpiSub: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    lineHeight: '18px',
  },
  // ── Chart card ───────────────────────────────────────────────────────────
  chartCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2ecf9',
    borderRadius: 20,
    boxShadow: '0px 2px 12px 0px rgba(29,110,237,0.08), 0px 1px 3px 0px rgba(0,0,0,0.04)',
    padding: '29px 33px',
  },
  chartHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(2),
    [theme.breakpoints.down('xs')]: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: theme.spacing(1),
    },
  },
  chartTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '1rem',
    lineHeight: '21.6px',
    color: '#1d2f6f',
  },
  chartLegend: {
    display: 'flex',
    gap: theme.spacing(2),
    alignItems: 'center',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  legendLineSolid: {
    width: 20,
    height: 2.5,
    backgroundColor: '#1d6eed',
    borderRadius: 2,
    flexShrink: 0,
  },
  legendLineDashed: {
    width: 20,
    height: 0,
    borderTop: '2px dashed #ffb800',
    flexShrink: 0,
  },
  legendLabel: {
    fontSize: '0.6875rem',
    color: '#64748b',
    lineHeight: '16.5px',
  },
  chartBox: {
    height: 240,
    marginTop: theme.spacing(3),
  },
  // ── Table card ───────────────────────────────────────────────────────────
  tableCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2ecf9',
    borderRadius: 20,
    boxShadow: '0px 2px 12px 0px rgba(29,110,237,0.08), 0px 1px 3px 0px rgba(0,0,0,0.04)',
    padding: '29px 33px',
  },
  tableTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '1rem',
    lineHeight: '21.6px',
    color: '#1d2f6f',
    marginBottom: theme.spacing(3),
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  headRow: {
    borderBottom: '2px solid #e2ecf9',
  },
  th: {
    textAlign: 'left',
    padding: '0 14px 10px 14px',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '0.625rem',
    lineHeight: '15px',
    letterSpacing: '0.7px',
    textTransform: 'uppercase',
    color: '#94a3b8',
  },
  row: {
    borderBottom: '1px solid #f0f5ff',
    '&:last-child': {
      borderBottom: 'none',
    },
  },
  nameCell: {
    padding: '14px 14px',
  },
  nameCellInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#ebf3ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '0.6875rem',
    color: '#1d6eed',
    lineHeight: '16.5px',
  },
  nameText: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '0.8125rem',
    color: '#1d2f6f',
    fontWeight: 500,
    lineHeight: '19.5px',
  },
  indexCell: {
    padding: '14px 14px',
  },
  indexWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  barTrack: {
    width: 60,
    height: 6,
    backgroundColor: '#e2ecf9',
    borderRadius: 3,
    overflow: 'hidden',
    flexShrink: 0,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  indexValue: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 800,
    fontSize: '0.8125rem',
    color: '#1d2f6f',
    lineHeight: '19.5px',
    minWidth: 28,
  },
  scoreCell: {
    padding: '14px 14px',
    fontFamily: 'Inter, sans-serif',
    fontSize: '0.8125rem',
    color: '#64748b',
    lineHeight: '19.5px',
  },
  alertsCell: {
    padding: '14px 14px',
    textAlign: 'left',
  },
  alertsBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: '50%',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  alertsNone: {
    color: '#94a3b8',
    fontSize: '0.8125rem',
  },
  levelCell: {
    padding: '14px 14px',
  },
  levelBadge: {
    display: 'inline-block',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '0.6875rem',
    lineHeight: '16.5px',
    padding: '4px 12px',
    borderRadius: 20,
  },
  // ── Action rows ──────────────────────────────────────────────────────────
  downloadRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing(1.5),
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  downloadBtn: {
    borderRadius: 10,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.875rem',
    padding: '8px 20px',
    textTransform: 'none',
  },
  // Close button in the header (top-right X)
  closeBtn: {
    position: 'absolute',
    top: theme.spacing(2),
    right: theme.spacing(2),
  },
  // "Volver a la sesión" outlined button that replaces the old "Nueva sesión"
  returnBtn: {
    borderRadius: 10,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.875rem',
    padding: '8px 20px',
    textTransform: 'none',
  },
}));

/** Generate initials from an identity string for the avatar. */
function initials(identity: string): string {
  const parts = identity.trim().split(/[\s_-]+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Bar/value color for a per-student index, using the shared level color map. */
function barColor(level: AttentionLevel): string {
  return levelColor[level];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Human-facing session/room name shown in the header. */
  sessionName: string;
  /** Connected students (excludes the professor) — mirrors the status bar count. */
  studentCount: number;
  /** Lets the parent surface its own error UI when a download fails. */
  onExportError?: () => void;
}

/**
 * In-room full-area attention report overlay (attendia redesign of wireframe S6).
 * Mounted INSIDE the room so the live Twilio call is never torn down and the real
 * `useAttention()` context stays available; a separate route would unmount
 * VideoProvider and drop the call. Reads metrics from `useAttention()`; the
 * PDF/Excel download buttons live here (moved out of the toolbar flyout).
 */
export default function AttentionReportOverlay({ isOpen, onClose, sessionName, studentCount, onExportError }: Props) {
  const classes = useStyles();
  const {
    source,
    groupAttention,
    attentionThreshold,
    timeline,
    participants,
    proctoringAlerts,
    attentionLevel,
  } = useAttention();

  const [hasExportError, setHasExportError] = React.useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleExport = (format: ExportFormat) => {
    exportAttentionReport(
      format,
      {
        source,
        groupAttention,
        attentionThreshold,
        timeline,
        participants,
        proctoringAlerts,
      },
      { sessionName }
    ).catch(() => {
      setHasExportError(true);
      onExportError?.();
    });
  };

  // Build a lookup from identity -> alert count for the table.
  const alertCountByIdentity: Record<string, number> = {};
  proctoringAlerts.forEach(alert => {
    alertCountByIdentity[alert.identity] = (alertCountByIdentity[alert.identity] || 0) + 1;
  });

  // KPI cards config — uses real data from useAttention().
  // "% tiempo supervisado" is not in mock data; show attentionThreshold as a
  // placeholder until the CV pipeline provides it (same value as before).
  const kpiCards = [
    {
      label: 'Atención promedio grupal',
      value: `${groupAttention}`,
      sub: '/ 100',
      color: KPI_COLORS.group,
    },
    {
      label: 'Estudiantes monitoreados',
      value: `${participants.length}`,
      sub: 'participantes',
      color: KPI_COLORS.students,
    },
    {
      label: 'Alertas de proctoring',
      value: `${proctoringAlerts.length}`,
      sub: 'eventos detectados',
      color: KPI_COLORS.alerts,
    },
    {
      label: 'Umbral superado',
      value: `${attentionThreshold}%`,
      sub: 'del tiempo total',
      color: KPI_COLORS.threshold,
    },
  ];

  return (
    <div
      className={classes.root}
      role="dialog"
      aria-modal="true"
      aria-label="Reporte de Atención"
      data-testid="attention-report-overlay"
    >
      {/* X close button — top-right corner, always reachable */}
      <IconButton
        className={classes.closeBtn}
        aria-label="Cerrar reporte"
        onClick={onClose}
        data-testid="attention-report-close-x"
      >
        <CloseIcon />
      </IconButton>

      <div className={classes.page}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className={classes.headerCard}>
          <div className={classes.headerTop}>
            <div className={classes.iconWrap}>
              <DescriptionIcon className={classes.headerIcon} />
            </div>
            <Typography className={classes.titleText}>Reporte de Atención</Typography>
          </div>

          <p className={classes.sessionLine}>
            {'Sesión: '}
            <strong>{sessionName}</strong>
            {' — '}
            {studentCount} {studentCount === 1 ? 'estudiante' : 'estudiantes'}
          </p>

          <div className={classes.chipsRow}>
            <span className={classes.chip}>
              <EventIcon className={classes.chipIcon} />
              {new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <span className={classes.chip}>
              <AccessTimeIcon className={classes.chipIcon} />
              {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {source === 'mock' && <span className={classes.mockTag}>{MOCK_DISCLOSURE}</span>}
          </div>
        </div>

        {/* ── KPI cards ──────────────────────────────────────────────── */}
        <div className={classes.kpiGrid} data-testid="attention-report-summary">
          {kpiCards.map(card => (
            <div key={card.label} className={classes.kpiCard}>
              <p className={classes.kpiLabel}>{card.label}</p>
              <div className={classes.kpiValueRow}>
                <span className={classes.kpiValue} style={{ color: card.color }}>
                  {card.value}
                </span>
                <span className={classes.kpiSub}>{card.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Timeline chart ─────────────────────────────────────────── */}
        <div className={classes.chartCard} data-testid="attention-report-timeline">
          <div className={classes.chartHead}>
            <Typography className={classes.chartTitle}>Evolución de atención grupal</Typography>
            <div className={classes.chartLegend}>
              <div className={classes.legendItem}>
                <div className={classes.legendLineSolid} />
                <span className={classes.legendLabel}>Atención grupo</span>
              </div>
              <div className={classes.legendItem}>
                <div className={classes.legendLineDashed} />
                <span className={classes.legendLabel}>Umbral mínimo ({attentionThreshold}%)</span>
              </div>
            </div>
          </div>
          <div className={classes.chartBox}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid stroke="#e2ecf9" strokeDasharray="0" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Poppins, sans-serif' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'Poppins, sans-serif' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 11,
                    borderRadius: 8,
                    border: '1px solid #e2ecf9',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}
                />
                <ReferenceLine y={attentionThreshold} stroke="#ffb800" strokeWidth={2} strokeDasharray="5 5" />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#1d6eed"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: '#1d6eed' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Download buttons row ────────────────────────────────────── */}
        <div className={classes.downloadRow}>
          <Button
            variant="outlined"
            className={classes.returnBtn}
            onClick={onClose}
            data-testid="attention-report-close"
          >
            Volver a la sesión
          </Button>
          <Button
            variant="outlined"
            color="primary"
            className={classes.downloadBtn}
            startIcon={<GetAppIcon />}
            onClick={() => handleExport('pdf')}
            data-testid="attention-report-download-pdf"
          >
            Descargar PDF
          </Button>
          <Button
            variant="contained"
            color="primary"
            className={classes.downloadBtn}
            startIcon={<GetAppIcon />}
            onClick={() => handleExport('csv')}
            data-testid="attention-report-download-csv"
          >
            Descargar CSV
          </Button>
        </div>

        {/* ── Per-student table ──────────────────────────────────────── */}
        <div className={classes.tableCard} data-testid="attention-report-table">
          <Typography className={classes.tableTitle}>Detalle por estudiante</Typography>
          <table className={classes.table}>
            <thead>
              <tr className={classes.headRow}>
                {['Nombre del Estudiante', 'Índice Prom.', 'Mínimo', 'Máximo', 'Alertas Proctoring', 'Nivel'].map(h => (
                  <th key={h} className={classes.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {participants.map(participant => {
                const level = attentionLevel(participant.index);
                const alertCount = alertCountByIdentity[participant.identity] || 0;
                return (
                  <tr key={participant.identity} className={classes.row}>
                    {/* Name with avatar */}
                    <td className={classes.nameCell}>
                      <div className={classes.nameCellInner}>
                        <div className={classes.avatar}>{initials(participant.identity)}</div>
                        <span className={classes.nameText}>{participant.identity}</span>
                      </div>
                    </td>

                    {/* Index bar + value */}
                    <td className={classes.indexCell}>
                      <div className={classes.indexWrap}>
                        <div className={classes.barTrack}>
                          <div
                            className={classes.barFill}
                            style={{ width: `${participant.index}%`, backgroundColor: barColor(level) }}
                          />
                        </div>
                        <span className={classes.indexValue}>{participant.index}</span>
                      </div>
                    </td>

                    {/* Min score — not available in mock data; show dash */}
                    <td className={classes.scoreCell}>—</td>

                    {/* Max score — not available in mock data; show dash */}
                    <td className={classes.scoreCell}>—</td>

                    {/* Proctoring alerts count */}
                    <td className={classes.alertsCell}>
                      {alertCount > 0 ? (
                        <span className={classes.alertsBadge}>{alertCount}</span>
                      ) : (
                        <span className={classes.alertsNone}>—</span>
                      )}
                    </td>

                    {/* Level chip */}
                    <td className={classes.levelCell}>
                      <span
                        className={classes.levelBadge}
                        style={{ backgroundColor: levelChipBg[level], color: levelChipFg[level] }}
                      >
                        {levelLabel[level]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Snackbar
        open={hasExportError}
        autoHideDuration={6000}
        onClose={() => setHasExportError(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message="No se pudo generar el reporte"
      />
    </div>
  );
}
