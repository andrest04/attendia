import React from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import SearchIcon from '@material-ui/icons/Search';
import BarChartIcon from '@material-ui/icons/BarChart';
import GetAppIcon from '@material-ui/icons/GetApp';
import { HistoryRow } from './types';
import { attentionLevelColor, attentionLevelFromPercent } from './dashboardHelpers';

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    padding: theme.spacing(4),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2),
    },
  },
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
  subtitle: {
    fontSize: '0.8125rem',
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
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
  tableWrap: {
    backgroundColor: theme.palette.background.paper,
    border: '1px solid #e2ecf9',
    borderRadius: theme.shape.borderRadius,
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
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
  attentionCell: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  attentionBarTrack: {
    width: 60,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f0f5ff',
    overflow: 'hidden',
  },
  attentionBarFill: {
    height: '100%',
    borderRadius: 3,
  },
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
  downloadIcon: {
    marginLeft: theme.spacing(1),
    color: theme.palette.text.secondary,
    cursor: 'pointer',
  },
  noRecording: {
    color: theme.palette.text.secondary,
  },
}));

interface Props {
  rows: HistoryRow[];
}

/** "Historial" tab: a read-only table of past sessions. Every action here is a stub. */
export default function HistoryTab({ rows }: Props) {
  const classes = useStyles();

  return (
    <div className={classes.root} data-testid="dashboard-history-tab">
      <div className={classes.header}>
        <div>
          <div className={classes.title}>Historial de clases</div>
          <div className={classes.subtitle}>Sesiones grabadas · últimos 30 días</div>
        </div>
        <div className={classes.searchBox} data-testid="dashboard-history-search">
          <SearchIcon style={{ fontSize: 16 }} />
          Buscar clase...
        </div>
      </div>

      <div className={classes.tableWrap}>
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
            {rows.map(row => {
              const level = attentionLevelFromPercent(row.attentionPercent);
              return (
                <tr key={row.id} data-testid={`dashboard-history-row-${row.id}`}>
                  <td className={classes.td}>{row.className}</td>
                  <td className={classes.td}>{row.date}</td>
                  <td className={classes.td}>{row.duration}</td>
                  <td className={classes.td}>{row.studentCount}</td>
                  <td className={classes.td}>
                    <div className={classes.attentionCell} data-testid="dashboard-history-attention">
                      <div className={classes.attentionBarTrack}>
                        <div
                          className={classes.attentionBarFill}
                          style={{
                            width: `${row.attentionPercent}%`,
                            backgroundColor: attentionLevelColor[level],
                          }}
                          data-testid={`dashboard-history-attention-bar-${row.id}`}
                          data-level={level}
                        />
                      </div>
                      {row.attentionPercent}%
                    </div>
                  </td>
                  <td className={classes.td}>
                    {row.recordingStatus === 'lista' ? 'Lista' : <span className={classes.noRecording}>—</span>}
                  </td>
                  <td className={classes.td}>
                    <button type="button" className={classes.reportButton} data-testid="dashboard-history-report">
                      <BarChartIcon style={{ fontSize: 14 }} />
                      Reporte
                    </button>
                    {row.hasDownload && (
                      <GetAppIcon
                        className={classes.downloadIcon}
                        style={{ fontSize: 18 }}
                        data-testid="dashboard-history-download"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
