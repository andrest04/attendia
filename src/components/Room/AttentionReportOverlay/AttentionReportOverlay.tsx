import React from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import Snackbar from '@material-ui/core/Snackbar';
import DescriptionIcon from '@material-ui/icons/Description';
import GetAppIcon from '@material-ui/icons/GetApp';
import CloseIcon from '@material-ui/icons/Close';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { useAttention } from '../../AttentionProvider';
import { AttentionLevel } from '../../AttentionProvider/types';
import { levelColor, levelLabel } from '../../AttentionProvider/attentionLabels';
import { exportAttentionReport, ExportFormat } from '../ProfessorRoomShell/exportAttentionReport';

const MOCK_DISCLOSURE = 'Datos simulados — pipeline CV pendiente';

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    position: 'absolute',
    inset: 0,
    zIndex: theme.zIndex.modal,
    backgroundColor: theme.palette.background.default,
    overflowY: 'auto',
  },
  page: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: theme.spacing(3, 4),
    [theme.breakpoints.down('xs')]: {
      padding: theme.spacing(2),
    },
  },
  card: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    backgroundColor: theme.palette.background.paper,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    padding: theme.spacing(2.5),
    marginBottom: theme.spacing(3),
    [theme.breakpoints.down('xs')]: {
      flexDirection: 'column',
    },
  },
  headerInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  headerIcon: {
    fontSize: 22,
    color: theme.palette.text.primary,
  },
  title: {
    fontWeight: 600,
    letterSpacing: '-0.02em',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  metaLabel: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
  },
  metaValue: {
    fontSize: '0.75rem',
    color: theme.palette.text.primary,
    fontWeight: 500,
  },
  mockTag: {
    display: 'inline-block',
    alignSelf: 'flex-start',
    fontSize: '0.7rem',
    fontStyle: 'italic',
    color: theme.palette.text.secondary,
    padding: '2px 8px',
    borderRadius: 3,
    border: `1px dashed ${theme.palette.text.secondary}`,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
    [theme.breakpoints.down('xs')]: {
      gridTemplateColumns: '1fr',
    },
  },
  statCard: {
    padding: theme.spacing(2, 2.5),
  },
  statLabel: {
    fontSize: '0.7rem',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(0.75),
  },
  statValueRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(0.5),
  },
  statValue: {
    fontSize: '1.6rem',
    fontWeight: 700,
    color: theme.palette.text.primary,
  },
  statSub: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
  },
  chartCard: {
    padding: theme.spacing(2.5),
    marginBottom: theme.spacing(3),
  },
  chartHead: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  chartTitle: {
    fontWeight: 600,
    fontSize: '0.95rem',
  },
  chartBox: {
    height: 220,
  },
  tableCard: {
    padding: theme.spacing(2.5),
  },
  tableTitle: {
    fontWeight: 600,
    fontSize: '0.95rem',
    marginBottom: theme.spacing(2),
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  headRow: {
    borderBottom: `2px solid ${theme.palette.divider}`,
  },
  th: {
    textAlign: 'left',
    padding: theme.spacing(1, 1.5),
    fontSize: '0.7rem',
    color: theme.palette.text.secondary,
    fontWeight: 600,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
  },
  row: {
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  nameCell: {
    padding: theme.spacing(1.25, 1.5),
    fontSize: '0.8rem',
    color: theme.palette.text.primary,
  },
  avgCell: {
    padding: theme.spacing(1.25, 1.5),
  },
  avgWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  barTrack: {
    width: 60,
    height: 6,
    backgroundColor: theme.palette.action.hover,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  avgValue: {
    fontSize: '0.75rem',
    color: theme.palette.text.primary,
    fontWeight: 500,
  },
  alertsCell: {
    padding: theme.spacing(1.25, 1.5),
  },
  alertBadge: {
    padding: '2px 8px',
    backgroundColor: theme.palette.text.primary,
    color: theme.palette.background.paper,
    borderRadius: 10,
    fontSize: '0.7rem',
  },
  alertNone: {
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
  },
  levelCell: {
    padding: theme.spacing(1.25, 1.5),
  },
  levelBadge: {
    fontSize: '0.65rem',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 3,
    color: '#FFFFFF',
  },
}));

/** Bar fill color for a per-student index, using the shared level color map. */
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
 * In-room full-area attention report overlay (graduates wireframe S6 to the real
 * MUI theme). Mounted INSIDE the room so the live Twilio call is never torn down
 * and the real `useAttention()` context stays available; a separate route would
 * unmount VideoProvider and drop the call. Reads metrics from `useAttention()`;
 * the PDF/Excel download buttons live here (moved out of the toolbar flyout).
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

  const summaryCards: Array<{ label: string; value: number; sub: string }> = [
    { label: 'Índice promedio del grupo', value: groupAttention, sub: '/ 100' },
    { label: 'Estudiantes monitoreados', value: participants.length, sub: 'estudiantes' },
    { label: 'Alertas de proctoring', value: proctoringAlerts.length, sub: 'eventos' },
    { label: 'Umbral mínimo', value: attentionThreshold, sub: '/ 100' },
  ];

  return (
    <div
      className={classes.root}
      role="dialog"
      aria-modal="true"
      aria-label="Reporte de Atención"
      data-testid="attention-report-overlay"
    >
      <div className={classes.page}>
        {/* Header */}
        <div className={`${classes.card} ${classes.header}`}>
          <div className={classes.headerInfo}>
            <div className={classes.titleRow}>
              <DescriptionIcon className={classes.headerIcon} />
              <Typography variant="h6" className={classes.title}>
                Reporte de Atención
              </Typography>
            </div>
            <div className={classes.metaRow}>
              <div className={classes.metaItem}>
                <span className={classes.metaLabel}>Sesión:</span>
                <span className={classes.metaValue}>{sessionName}</span>
              </div>
              <div className={classes.metaItem}>
                <span className={classes.metaValue}>
                  {studentCount} {studentCount === 1 ? 'estudiante' : 'estudiantes'}
                </span>
              </div>
            </div>
            {source === 'mock' && <span className={classes.mockTag}>{MOCK_DISCLOSURE}</span>}
          </div>

          <div className={classes.headerActions}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<GetAppIcon />}
              onClick={() => handleExport('pdf')}
              data-testid="attention-report-download-pdf"
            >
              Descargar PDF
            </Button>
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<GetAppIcon />}
              onClick={() => handleExport('xlsx')}
              data-testid="attention-report-download-excel"
            >
              Descargar Excel
            </Button>
            <Button
              variant="text"
              size="small"
              startIcon={<CloseIcon />}
              onClick={onClose}
              data-testid="attention-report-close"
            >
              Cerrar
            </Button>
          </div>
        </div>

        {/* Summary stats */}
        <div className={classes.summaryGrid} data-testid="attention-report-summary">
          {summaryCards.map(stat => (
            <div key={stat.label} className={`${classes.card} ${classes.statCard}`}>
              <p className={classes.statLabel}>{stat.label}</p>
              <div className={classes.statValueRow}>
                <span className={classes.statValue}>{stat.value}</span>
                <span className={classes.statSub}>{stat.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Timeline chart */}
        <div className={`${classes.card} ${classes.chartCard}`} data-testid="attention-report-timeline">
          <div className={classes.chartHead}>
            <TrendingUpIcon style={{ fontSize: 18 }} />
            <Typography className={classes.chartTitle}>Evolución de atención grupal</Typography>
          </div>
          <div className={classes.chartBox}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="attentionReportFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#027AC5" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#027AC5" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#606B85' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#606B85' }} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <ReferenceLine y={attentionThreshold} stroke="#E6A817" strokeWidth={1} strokeDasharray="5 5" />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#027AC5"
                  strokeWidth={2}
                  fill="url(#attentionReportFill)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Per-student table */}
        <div className={`${classes.card} ${classes.tableCard}`} data-testid="attention-report-table">
          <Typography className={classes.tableTitle}>Detalle por estudiante</Typography>
          <table className={classes.table}>
            <thead>
              <tr className={classes.headRow}>
                {['Nombre', 'Índice prom.', 'Múltiples rostros', 'Nivel'].map(h => (
                  <th key={h} className={classes.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {participants.map(participant => {
                const level = attentionLevel(participant.index);
                return (
                  <tr key={participant.identity} className={classes.row}>
                    <td className={classes.nameCell}>{participant.identity}</td>
                    <td className={classes.avgCell}>
                      <div className={classes.avgWrap}>
                        <div className={classes.barTrack}>
                          <div
                            className={classes.barFill}
                            style={{ width: `${participant.index}%`, backgroundColor: barColor(level) }}
                          />
                        </div>
                        <span className={classes.avgValue}>{participant.index}</span>
                      </div>
                    </td>
                    <td className={classes.alertsCell}>
                      {participant.multiface ? (
                        <span className={classes.alertBadge}>Sí</span>
                      ) : (
                        <span className={classes.alertNone}>—</span>
                      )}
                    </td>
                    <td className={classes.levelCell}>
                      <span className={classes.levelBadge} style={{ backgroundColor: levelColor[level] }}>
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
