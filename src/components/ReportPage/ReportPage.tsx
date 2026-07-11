import React, { useCallback, useEffect, useState } from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import CloseIcon from '@material-ui/icons/Close';

import AttendiaLogo from '../Brand/AttendiaLogo';
import AttentionReportView, { AttentionReportViewData } from '../AttentionReport/AttentionReportView';
import { storedReportToViewData } from '../AttentionReport/storedReportViewData';
import { useAppState } from '../../state';
import { useParams } from 'react-router-dom';

/*
 * Standalone "Reporte de Atención" page, opened in a NEW TAB from the in-room
 * dashboard history. It loads only the authenticated teacher's persisted report;
 * the route is protected and the server scopes reads to the verified Firebase uid.
 */

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    backgroundColor: '#f0f5ff',
    minHeight: '100vh',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(2, 3),
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2ecf9',
  },
  navDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e2ecf9',
  },
  closeButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    padding: '6px 10px',
    borderRadius: 8,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.8125rem',
    color: '#1d6eed',
    marginLeft: 'auto',
    '&:hover': {
      backgroundColor: '#ebf3ff',
    },
  },
  emptyCard: {
    maxWidth: 520,
    margin: '15vh auto 0',
    backgroundColor: '#ffffff',
    border: '1px solid #e2ecf9',
    borderRadius: 20,
    boxShadow: '0px 2px 12px 0px rgba(29,110,237,0.08), 0px 1px 3px 0px rgba(0,0,0,0.04)',
    padding: theme.spacing(6, 4),
    textAlign: 'center',
  },
  emptyText: {
    fontSize: '0.9375rem',
    color: '#64748b',
    lineHeight: 1.6,
  },
}));

export default function ReportPage() {
  const classes = useStyles();
  const { roomSid } = useParams<{ roomSid: string }>();
  const { fetchAttentionReport } = useAppState();
  const [data, setData] = useState<AttentionReportViewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!fetchAttentionReport) {
      setError('No pudimos validar tu acceso al reporte.');
      return;
    }
    setError(null);
    fetchAttentionReport(roomSid)
      .then(report => setData(storedReportToViewData(report)))
      .catch(err => {
        console.error('ReportPage: could not fetch the report', { roomSid, error: err });
        setError(err.message || 'No pudimos consultar el reporte.');
      });
  }, [fetchAttentionReport, roomSid]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className={classes.root} data-testid="report-page">
      <nav className={classes.nav}>
        <AttendiaLogo variant="full" size={28} />
        <div className={classes.navDivider} />
        <Typography variant="body2" style={{ color: '#64748b' }}>
          Reporte de Atención
        </Typography>
        <button
          type="button"
          className={classes.closeButton}
          onClick={() => window.close()}
          data-testid="report-page-close"
        >
          <CloseIcon style={{ fontSize: 16 }} />
          Cerrar
        </button>
      </nav>

      {data ? (
        <AttentionReportView data={data} />
      ) : (
        <div className={classes.emptyCard} data-testid="report-page-empty">
          <Typography className={classes.emptyText}>{error || 'Cargando el reporte...'}</Typography>
        </div>
      )}
    </div>
  );
}
