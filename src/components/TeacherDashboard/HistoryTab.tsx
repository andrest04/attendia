import React, { useState } from 'react';
import { Button, CircularProgress } from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import SearchIcon from '@material-ui/icons/Search';
import BarChartIcon from '@material-ui/icons/BarChart';
import { StoredAttentionReport } from '../AttentionProvider/reportTypes';
import { attentionLevelColor, attentionLevelFromPercent } from './dashboardHelpers';
import { storedReportDate } from '../AttentionReport/storedReportViewData';

const useStyles = makeStyles((theme: Theme) => ({
  root: { padding: theme.spacing(4), [theme.breakpoints.down('sm')]: { padding: theme.spacing(2) } },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(3),
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
  },
  title: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '1.125rem',
    color: theme.palette.text.primary,
  },
  subtitle: { fontSize: '0.8125rem', color: theme.palette.text.secondary, marginTop: 2 },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.shape.borderRadius,
    border: '1px solid #e2ecf9',
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.secondary,
    fontSize: '0.8125rem',
    minWidth: 220,
  },
  searchInput: { border: 0, outline: 0, width: '100%', font: 'inherit', color: 'inherit', background: 'transparent' },
  tableWrap: {
    backgroundColor: theme.palette.background.paper,
    border: '1px solid #e2ecf9',
    borderRadius: theme.shape.borderRadius,
    overflowX: 'auto',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    padding: theme.spacing(1.5, 2),
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: theme.palette.text.secondary,
    borderBottom: '1px solid #e2ecf9',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: theme.spacing(1.5, 2),
    fontSize: '0.8125rem',
    color: theme.palette.text.primary,
    borderBottom: '1px solid #e2ecf9',
    whiteSpace: 'nowrap',
  },
  attentionCell: { display: 'flex', alignItems: 'center', gap: theme.spacing(1) },
  attentionBarTrack: { width: 60, height: 6, borderRadius: 3, backgroundColor: '#f0f5ff', overflow: 'hidden' },
  attentionBarFill: { height: '100%', borderRadius: 3 },
  reportButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.75, 1.5),
    borderRadius: theme.shape.borderRadius,
    border: '1px solid #e2ecf9',
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  noRecording: { color: theme.palette.text.secondary },
  state: { padding: theme.spacing(5, 3), textAlign: 'center', color: theme.palette.text.secondary },
  mockTag: {
    display: 'inline-block',
    marginLeft: theme.spacing(1),
    fontSize: '0.6875rem',
    fontStyle: 'italic',
    color: theme.palette.text.secondary,
  },
}));

interface Props {
  reports: StoredAttentionReport[] | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenReport: (report: StoredAttentionReport) => void;
}

function formatDate(report: StoredAttentionReport): string {
  const date = storedReportDate(report);
  return isNaN(date.getTime())
    ? 'Fecha no disponible'
    : date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDuration(report: StoredAttentionReport): string {
  if (!Number.isFinite(report.durationMs) || report.durationMs < 0) return 'No disponible';
  const totalMinutes = Math.floor(report.durationMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
}

/** Persisted classroom reports, with no inferred recording URL or availability. */
export default function HistoryTab({ reports, isLoading, error, onRetry, onOpenReport }: Props) {
  const classes = useStyles();
  const [query, setQuery] = useState('');
  const filteredReports = (reports || []).filter(report =>
    report.roomName.toLocaleLowerCase().includes(query.toLocaleLowerCase())
  );

  return (
    <div className={classes.root} data-testid="dashboard-history-tab">
      <div className={classes.header}>
        <div>
          <div className={classes.title}>Historial de clases</div>
          <div className={classes.subtitle}>Reportes guardados al finalizar cada sesión</div>
        </div>
        <label className={classes.searchBox} data-testid="dashboard-history-search">
          <SearchIcon style={{ fontSize: 16 }} />
          <input
            className={classes.searchInput}
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Buscar clase..."
            aria-label="Buscar clase"
          />
        </label>
      </div>

      <div className={classes.tableWrap}>
        {isLoading ? (
          <div className={classes.state} data-testid="dashboard-history-loading">
            <CircularProgress size={24} /> <div>Cargando el historial...</div>
          </div>
        ) : error ? (
          <div className={classes.state} data-testid="dashboard-history-error">
            {error}
            <div>
              <Button onClick={onRetry} data-testid="dashboard-history-retry">
                Reintentar
              </Button>
            </div>
          </div>
        ) : !reports || reports.length === 0 ? (
          <div className={classes.state} data-testid="dashboard-history-empty">
            Todavía no hay reportes guardados.
          </div>
        ) : filteredReports.length === 0 ? (
          <div className={classes.state} data-testid="dashboard-history-no-results">
            No encontramos clases con esa búsqueda.
          </div>
        ) : (
          <table className={classes.table}>
            <thead>
              <tr>
                <th className={classes.th}>CLASE</th>
                <th className={classes.th}>FECHA</th>
                <th className={classes.th}>DURACIÓN</th>
                <th className={classes.th}>ALUMNOS</th>
                <th className={classes.th}>ATENCIÓN</th>
                <th className={classes.th}>GRABACIÓN</th>
                <th className={classes.th} />
              </tr>
            </thead>
            <tbody>
              {filteredReports.map(report => {
                const attentionPercent = report.groupAverage;
                const level = attentionLevelFromPercent(attentionPercent);
                return (
                  <tr key={report.roomSid} data-testid={`dashboard-history-row-${report.roomSid}`}>
                    <td className={classes.td}>
                      {report.roomName}
                      {report.source === 'mock' && <span className={classes.mockTag}>Datos simulados</span>}
                    </td>
                    <td className={classes.td}>{formatDate(report)}</td>
                    <td className={classes.td}>{formatDuration(report)}</td>
                    <td className={classes.td}>{report.studentCount}</td>
                    <td className={classes.td}>
                      <div className={classes.attentionCell}>
                        <div className={classes.attentionBarTrack}>
                          <div
                            className={classes.attentionBarFill}
                            style={{ width: `${attentionPercent}%`, backgroundColor: attentionLevelColor[level] }}
                            data-testid={`dashboard-history-attention-bar-${report.roomSid}`}
                            data-level={level}
                          />
                        </div>
                        {attentionPercent}%
                      </div>
                    </td>
                    <td className={classes.td}>
                      <span className={classes.noRecording}>
                        {report.recordingWasActiveAtEnd ? 'Activa al cierre (archivo no disponible)' : 'No disponible'}
                      </span>
                    </td>
                    <td className={classes.td}>
                      <button
                        type="button"
                        className={classes.reportButton}
                        onClick={() => onOpenReport(report)}
                        data-testid="dashboard-history-report"
                      >
                        <BarChartIcon style={{ fontSize: 14 }} />
                        Reporte
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
