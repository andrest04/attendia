import React from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import DescriptionIcon from '@material-ui/icons/Description';
import EventIcon from '@material-ui/icons/Event';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import { LineChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

import { AttentionLevel, AttentionTimelinePoint } from '../AttentionProvider/types';
import { levelColor, levelLabel } from '../AttentionProvider/attentionLabels';
import { attentionStatusColors } from '../../theme';

/*
 * Presentational core of the attention report so the same light-themed report body
 * can render on the /report page (new-tab snapshot of live useAttention() data) and
 * on the /history page (stored Firestore reports). It is data-via-props only: no
 * context reads, no SDK dependencies.
 */

export const MOCK_DISCLOSURE = 'Datos simulados — pipeline CV pendiente';

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
  alerts: attentionStatusColors.low,
  threshold: attentionStatusColors.medium,
};

const useStyles = makeStyles((theme: Theme) => ({
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
    display: 'flex',
    flexDirection: 'column',
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
    // Reserve two lines so labels of differing length (one- vs two-line) never
    // push their value row to a different height — all KPI values stay aligned.
    minHeight: 33,
  },
  // Pin the value row to the bottom of the card so every KPI number sits on the
  // same baseline regardless of label height.
  kpiValueWrap: {
    marginTop: 'auto',
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
    [theme.breakpoints.down('xs')]: {
      padding: '18px 16px',
    },
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
    borderTop: `2px dashed ${attentionStatusColors.medium}`,
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
    [theme.breakpoints.down('xs')]: {
      padding: '18px 16px',
    },
  },
  tableTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '1rem',
    lineHeight: '21.6px',
    color: '#1d2f6f',
    marginBottom: theme.spacing(3),
  },
  // Horizontal scroll wrapper so the 6-column table never clips on narrow viewports.
  tableScroll: {
    width: '100%',
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    minWidth: 520,
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

/**
 * Per-student row already normalized for display. AttentionReportParticipant
 * (reportTypes.ts) satisfies this structurally; the in-room overlay may pass
 * undefined min/max for participants without accumulated history (rendered "—").
 */
export interface ReportViewParticipant {
  identity: string;
  indexAvg: number;
  indexMin?: number;
  indexMax?: number;
  level: AttentionLevel;
  alertCount: number;
}

/** Normalized, source-agnostic report data — built from useAttention() or a stored report. */
export interface AttentionReportViewData {
  sessionName: string;
  studentCount: number;
  source: 'mock' | 'live';
  attentionThreshold: number;
  timeline: AttentionTimelinePoint[];
  /** False only when the session recorded no data at all — group KPIs render "—". */
  hasGroupData: boolean;
  groupAverage: number;
  percentAboveThreshold: number;
  participants: ReportViewParticipant[];
  totalAlerts: number;
  /** Snapshot date shown in the header chips (client clock for the live overlay). */
  reportDate: Date;
}

interface Props {
  data: AttentionReportViewData;
  /** Optional slot rendered between the chart and the table (e.g. the overlay's actions row). */
  actionsSlot?: React.ReactNode;
}

/**
 * Read-only attention report body (attendia redesign of wireframe S6): header,
 * KPI cards, group timeline chart, and the per-student table. Light-themed
 * (#f0f5ff surface family) so it drops into both the in-room overlay and the
 * /history page unchanged.
 */
export default function AttentionReportView({ data, actionsSlot }: Props) {
  const classes = useStyles();
  const {
    sessionName,
    studentCount,
    source,
    attentionThreshold,
    timeline,
    hasGroupData,
    groupAverage,
    percentAboveThreshold,
    participants,
    totalAlerts,
    reportDate,
  } = data;

  // KPI cards config — all values derived from real session data.
  // "Atención promedio grupal" is the time-average of the group timeline (falling
  // back to the live snapshot before any point is recorded); "Umbral superado" is
  // the real share of recorded time at/above the threshold. With no data at all,
  // show "—" instead of a placeholder 0 that reads as "the group had 0% attention".
  const kpiCards = [
    {
      label: 'Atención promedio grupal',
      value: hasGroupData ? `${groupAverage}` : '—',
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
      value: `${totalAlerts}`,
      sub: 'eventos detectados',
      color: KPI_COLORS.alerts,
    },
    {
      label: 'Umbral superado',
      value: hasGroupData ? `${percentAboveThreshold}%` : '—',
      sub: 'del tiempo total',
      color: KPI_COLORS.threshold,
    },
  ];

  return (
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
            {reportDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <span className={classes.chip}>
            <AccessTimeIcon className={classes.chipIcon} />
            {reportDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {source === 'mock' && <span className={classes.mockTag}>{MOCK_DISCLOSURE}</span>}
        </div>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────── */}
      <div className={classes.kpiGrid} data-testid="attention-report-summary">
        {kpiCards.map(card => (
          <div key={card.label} className={classes.kpiCard}>
            <p className={classes.kpiLabel}>{card.label}</p>
            <div className={classes.kpiValueWrap}>
              <div className={classes.kpiValueRow}>
                <span className={classes.kpiValue} style={{ color: card.color }}>
                  {card.value}
                </span>
                <span className={classes.kpiSub}>{card.sub}</span>
              </div>
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
                minTickGap={48}
                interval="preserveStartEnd"
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
              <ReferenceLine
                y={attentionThreshold}
                stroke={KPI_COLORS.threshold}
                strokeWidth={1.5}
                strokeDasharray="5 5"
                strokeOpacity={0.5}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#1d6eed"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: '#1d6eed' }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Optional actions slot (the overlay's "Volver a la sesión" row) ── */}
      {actionsSlot}

      {/* ── Per-student table ──────────────────────────────────────── */}
      <div className={classes.tableCard} data-testid="attention-report-table">
        <Typography className={classes.tableTitle}>Detalle por estudiante</Typography>
        <div className={classes.tableScroll}>
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
              {participants.map(participant => (
                <tr key={participant.identity} className={classes.row}>
                  {/* Name with avatar */}
                  <td className={classes.nameCell}>
                    <div className={classes.nameCellInner}>
                      <div className={classes.avatar}>{initials(participant.identity)}</div>
                      <span className={classes.nameText}>{participant.identity}</span>
                    </div>
                  </td>

                  {/* Average index bar + value */}
                  <td className={classes.indexCell}>
                    <div className={classes.indexWrap}>
                      <div className={classes.barTrack}>
                        <div
                          className={classes.barFill}
                          style={{
                            width: `${participant.indexAvg}%`,
                            backgroundColor: barColor(participant.level),
                          }}
                        />
                      </div>
                      <span className={classes.indexValue}>{participant.indexAvg}</span>
                    </div>
                  </td>

                  {/* Min score over the session */}
                  <td className={classes.scoreCell}>{participant.indexMin ?? '—'}</td>

                  {/* Max score over the session */}
                  <td className={classes.scoreCell}>{participant.indexMax ?? '—'}</td>

                  {/* Proctoring alerts count */}
                  <td className={classes.alertsCell}>
                    {participant.alertCount > 0 ? (
                      <span className={classes.alertsBadge}>{participant.alertCount}</span>
                    ) : (
                      <span className={classes.alertsNone}>—</span>
                    )}
                  </td>

                  {/* Level chip */}
                  <td className={classes.levelCell}>
                    <span
                      className={classes.levelBadge}
                      style={{
                        backgroundColor: levelChipBg[participant.level],
                        color: levelChipFg[participant.level],
                      }}
                    >
                      {levelLabel[participant.level]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
