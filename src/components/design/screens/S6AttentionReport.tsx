import React from 'react';
import { makeStyles, createStyles } from '@material-ui/core/styles';
import { Typography } from '@material-ui/core';
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import DescriptionIcon from '@material-ui/icons/Description';
import DateRangeIcon from '@material-ui/icons/DateRange';
import ScheduleIcon from '@material-ui/icons/Schedule';
import GetAppIcon from '@material-ui/icons/GetApp';
import TrendingUpIcon from '@material-ui/icons/TrendingUp';

import USTag from '../USTag';
import { wf, GALLERY_NAV_HEIGHT } from '../wireframe';
import { mockData, attentionLevel, AttentionLevel } from '../data';

const levelLabel: Record<AttentionLevel, string> = {
  high: 'Alto',
  medium: 'Medio',
  low: 'Bajo',
};

const levelBg: Record<AttentionLevel, string> = {
  high: wf.gray700,
  medium: wf.gray500,
  low: wf.gray300,
};

const levelColor: Record<AttentionLevel, string> = {
  high: wf.white,
  medium: wf.white,
  low: wf.gray700,
};

/** Bar fill for the per-student average score, derived from the shared level ranges. */
function barColor(score: number): string {
  return levelBg[attentionLevel(score)];
}

const useStyles = makeStyles(() =>
  createStyles({
    root: {
      minHeight: `calc(100vh - ${GALLERY_NAV_HEIGHT}px)`,
      backgroundColor: wf.bg,
      overflowY: 'auto',
    },
    page: { maxWidth: 1100, margin: '0 auto', padding: '24px 32px' },

    card: {
      backgroundColor: wf.white,
      border: `1px solid ${wf.gray300}`,
      borderRadius: 8,
    },

    /* Header */
    header: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      padding: 20,
      marginBottom: 24,
    },
    headerInfo: { display: 'flex', flexDirection: 'column', gap: 8 },
    titleRow: { display: 'flex', alignItems: 'center', gap: 8 },
    title: { color: wf.ink, fontSize: 18, fontWeight: 600 },
    metaRow: { display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 },
    metaItem: { display: 'flex', alignItems: 'center', gap: 6 },
    metaLabel: { fontSize: 12, color: wf.gray500 },
    metaValue: { fontSize: 12, color: wf.gray700, fontWeight: 500 },
    epicBadge: {
      padding: '3px 8px',
      backgroundColor: wf.bg,
      borderRadius: 3,
      border: `1px solid ${wf.gray300}`,
      display: 'inline-block',
      marginTop: 4,
      alignSelf: 'flex-start',
    },
    epicText: { fontSize: 10, color: wf.gray500 },

    headerActions: { display: 'flex', alignItems: 'center', gap: 8 },
    btnOutline: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '9px 16px',
      border: `1px solid ${wf.gray500}`,
      borderRadius: 6,
      backgroundColor: wf.bg,
      fontSize: 13,
      color: wf.gray700,
      cursor: 'pointer',
    },
    btnSolid: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '9px 16px',
      border: `1px solid ${wf.gray700}`,
      borderRadius: 6,
      backgroundColor: wf.gray700,
      fontSize: 13,
      color: wf.white,
      cursor: 'pointer',
    },

    /* Summary stats */
    summaryGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 16,
      marginBottom: 24,
    },
    statCard: { padding: '16px 20px' },
    statLabel: { fontSize: 11, color: wf.gray500, margin: '0 0 6px 0' },
    statValueRow: { display: 'flex', alignItems: 'baseline', gap: 4 },
    statValue: { fontSize: 26, color: wf.ink, fontWeight: 700 },
    statSub: { fontSize: 12, color: wf.gray500 },

    /* Timeline chart */
    chartCard: { padding: 20, marginBottom: 24 },
    chartHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    chartTitleRow: { display: 'flex', alignItems: 'center', gap: 8 },
    chartTitle: { color: wf.ink, fontSize: 15, fontWeight: 600 },
    legend: { display: 'flex', alignItems: 'center', gap: 12 },
    legendItem: { display: 'flex', alignItems: 'center', gap: 4 },
    legendSwatch: { width: 16, height: 2, backgroundColor: wf.gray700 },
    legendSwatchDashed: { width: 16, height: 0, borderTop: `2px dashed ${wf.gray500}` },
    legendText: { fontSize: 10, color: wf.gray500 },
    chartBox: { height: 200 },

    /* Student table */
    tableCard: { padding: 20 },
    tableTitle: { color: wf.ink, fontSize: 15, fontWeight: 600, margin: '0 0 16px 0' },
    table: { width: '100%', borderCollapse: 'collapse' },
    headRow: { borderBottom: `2px solid ${wf.gray300}` },
    th: {
      textAlign: 'left',
      padding: '8px 12px',
      fontSize: 11,
      color: wf.gray500,
      fontWeight: 600,
      letterSpacing: '0.03em',
      textTransform: 'uppercase',
    },
    nameCell: { padding: '10px 12px', fontSize: 13, color: wf.gray700 },
    avgCell: { padding: '10px 12px' },
    avgWrap: { display: 'flex', alignItems: 'center', gap: 8 },
    barTrack: { width: 60, height: 6, backgroundColor: wf.gray300, borderRadius: 3 },
    barFill: { height: '100%', borderRadius: 3 },
    avgValue: { fontSize: 12, color: wf.gray700, fontWeight: 500 },
    rangeCell: { padding: '10px 12px', fontSize: 12, color: wf.gray500 },
    alertsCell: { padding: '10px 12px' },
    alertBadge: {
      padding: '2px 8px',
      backgroundColor: wf.gray700,
      color: wf.white,
      borderRadius: 10,
      fontSize: 11,
    },
    alertNone: { color: wf.gray500, fontSize: 12 },
    levelCell: { padding: '10px 12px' },
    levelBadge: { fontSize: 10, padding: '2px 8px', borderRadius: 2 },
  })
);

/** S6 — Post-session attention report: summary KPIs, group attention over time, per-student breakdown, export. Design mock. */
export default function S6AttentionReport() {
  const classes = useStyles();
  const { attentionReport, attentionTimeline } = mockData;

  return (
    <div className={classes.root}>
      <div className={classes.page}>
        {/* Header */}
        <div className={`${classes.card} ${classes.header}`}>
          <div className={classes.headerInfo}>
            <div className={classes.titleRow}>
              <DescriptionIcon style={{ fontSize: 20, color: wf.gray700 }} />
              <Typography className={classes.title}>Reporte de Atención</Typography>
            </div>
            <div className={classes.metaRow}>
              <div className={classes.metaItem}>
                <span className={classes.metaLabel}>Sesión:</span>
                <span className={classes.metaValue}>{attentionReport.sessionName}</span>
              </div>
              <div className={classes.metaItem}>
                <DateRangeIcon style={{ fontSize: 12, color: wf.gray500 }} />
                <span className={classes.metaLabel}>{attentionReport.date}</span>
              </div>
              <div className={classes.metaItem}>
                <ScheduleIcon style={{ fontSize: 12, color: wf.gray500 }} />
                <span className={classes.metaLabel}>{attentionReport.timeRange}</span>
              </div>
            </div>
            <div className={classes.epicBadge}>
              <span className={classes.epicText}>{attentionReport.epic}</span>
            </div>
          </div>

          <div className={classes.headerActions}>
            <button type="button" className={classes.btnOutline}>
              <GetAppIcon style={{ fontSize: 14 }} />
              Descargar PDF
            </button>
            <button type="button" className={classes.btnSolid}>
              <GetAppIcon style={{ fontSize: 14 }} />
              Descargar CSV
            </button>
            <USTag ids={['US27']} />
          </div>
        </div>

        {/* Summary stats */}
        <div className={classes.summaryGrid}>
          {attentionReport.summary.map(stat => (
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
        <div className={`${classes.card} ${classes.chartCard}`}>
          <div className={classes.chartHead}>
            <div className={classes.chartTitleRow}>
              <TrendingUpIcon style={{ fontSize: 16, color: wf.gray700 }} />
              <Typography className={classes.chartTitle}>Evolución de atención grupal</Typography>
            </div>
            <div className={classes.legend}>
              <div className={classes.legendItem}>
                <div className={classes.legendSwatch} />
                <span className={classes.legendText}>Atención grupo</span>
              </div>
              <div className={classes.legendItem}>
                <div className={classes.legendSwatchDashed} />
                <span className={classes.legendText}>Umbral mínimo ({attentionReport.threshold}%)</span>
              </div>
            </div>
          </div>
          <div className={classes.chartBox}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attentionTimeline} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="s6AttentionFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={wf.gray500} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={wf.gray500} stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 9, fill: wf.gray500 }}
                  axisLine={{ stroke: wf.gray300 }}
                  tickLine={false}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: wf.gray500 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 10, backgroundColor: wf.white, border: `1px solid ${wf.gray300}` }}
                />
                <ReferenceLine
                  y={attentionReport.threshold}
                  stroke={wf.gray500}
                  strokeWidth={1}
                  strokeDasharray="5 5"
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={wf.gray700}
                  strokeWidth={1.5}
                  fill="url(#s6AttentionFill)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <USTag ids={['US26']} />
        </div>

        {/* Student table */}
        <div className={`${classes.card} ${classes.tableCard}`}>
          <Typography className={classes.tableTitle}>Detalle por estudiante</Typography>
          <table className={classes.table}>
            <thead>
              <tr className={classes.headRow}>
                {['Nombre del estudiante', 'Índice prom.', 'Mínimo', 'Máximo', 'Alertas proctoring', 'Nivel'].map(h => (
                  <th key={h} className={classes.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attentionReport.students.map((s, idx) => {
                const level = attentionLevel(s.avg);
                return (
                  <tr
                    key={s.id}
                    style={{
                      borderBottom: `1px solid ${wf.bg}`,
                      backgroundColor: idx % 2 === 0 ? wf.white : '#FAFAFA',
                    }}
                  >
                    <td className={classes.nameCell}>{s.name}</td>
                    <td className={classes.avgCell}>
                      <div className={classes.avgWrap}>
                        <div className={classes.barTrack}>
                          <div
                            className={classes.barFill}
                            style={{ width: `${s.avg}%`, backgroundColor: barColor(s.avg) }}
                          />
                        </div>
                        <span className={classes.avgValue}>{s.avg}</span>
                      </div>
                    </td>
                    <td className={classes.rangeCell}>{s.min}</td>
                    <td className={classes.rangeCell}>{s.max}</td>
                    <td className={classes.alertsCell}>
                      {s.alerts > 0 ? (
                        <span className={classes.alertBadge}>{s.alerts}</span>
                      ) : (
                        <span className={classes.alertNone}>—</span>
                      )}
                    </td>
                    <td className={classes.levelCell}>
                      <span
                        className={classes.levelBadge}
                        style={{ backgroundColor: levelBg[level], color: levelColor[level] }}
                      >
                        {levelLabel[level]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <USTag ids={['US26', 'US27']} />
        </div>
      </div>
    </div>
  );
}
