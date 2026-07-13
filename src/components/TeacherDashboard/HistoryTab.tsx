import React, { useCallback, useEffect, useState } from 'react';
import { Button, CircularProgress } from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import SearchIcon from '@material-ui/icons/Search';
import BarChartIcon from '@material-ui/icons/BarChart';
import GetAppIcon from '@material-ui/icons/GetApp';
import { RecordingArtifact, RecordingArtifactStatus, StoredAttentionReport } from '../AttentionProvider/reportTypes';
import { attentionLevelColor, attentionLevelFromPercent } from './dashboardHelpers';
import { storedReportDate } from '../AttentionReport/storedReportViewData';

// How often a pending (enqueued/processing) recording's status is re-checked. Twilio
// compositions are not instantaneous — this is a UX poll, not a webhook.
const RECORDING_POLL_INTERVAL_MS = 5000;

const PENDING_RECORDING_STATUSES: RecordingArtifactStatus[] = ['enqueued', 'processing'];

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
  recordingCell: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, whiteSpace: 'normal' },
  recordingButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5, 1.25),
    borderRadius: theme.shape.borderRadius,
    border: '1px solid #e2ecf9',
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.75rem',
    cursor: 'pointer',
    '&:disabled': { cursor: 'default', opacity: 0.6 },
  },
  recordingHint: { fontSize: '0.6875rem', color: theme.palette.text.secondary },
  recordingError: { fontSize: '0.6875rem', color: theme.palette.error.main },
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
  // Teacher-requested Twilio recording (Composition) artifacts — server-proxied end
  // to end (see server/recordings.ts). Undefined only outside firebase mode.
  onRequestRecording?: (roomSid: string) => Promise<RecordingArtifact>;
  onCheckRecordingStatus?: (roomSid: string) => Promise<RecordingArtifact>;
  onGetRecordingDownloadUrl?: (roomSid: string) => Promise<string>;
}

function formatDate(report: StoredAttentionReport): string {
  const date = storedReportDate(report);
  return isNaN(date.getTime())
    ? 'Fecha no disponible'
    : date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDuration(report: StoredAttentionReport): string {
  if (!Number.isFinite(report.durationMs) || report.durationMs < 0) return 'No disponible';
  const totalSeconds = Math.floor(report.durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}min`;
  // Sub-minute sessions (e.g. a test class ended right away) used to all read
  // "0min" — show seconds instead so they're distinguishable from each other.
  if (minutes > 0) return `${minutes}min`;
  return `${seconds}s`;
}

interface RecordingCellProps {
  report: StoredAttentionReport;
  onRequestRecording?: (roomSid: string) => Promise<RecordingArtifact>;
  onCheckRecordingStatus?: (roomSid: string) => Promise<RecordingArtifact>;
  onGetRecordingDownloadUrl?: (roomSid: string) => Promise<string>;
}

/**
 * One row's "GRABACIÓN" cell — state-driven on the Twilio Composition lifecycle
 * (not_requested -> enqueued/processing -> completed/failed/expired). Owns its own
 * request/poll/download state so a slow Twilio composition on one row never
 * re-renders the whole table.
 */
function RecordingCell({
  report,
  onRequestRecording,
  onCheckRecordingStatus,
  onGetRecordingDownloadUrl,
}: RecordingCellProps) {
  const classes = useStyles();
  const roomSid = report.roomSid;
  const [recording, setRecording] = useState<RecordingArtifact | undefined>(report.recording);
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setRecording(report.recording);
  }, [report.recording]);

  const status: RecordingArtifactStatus = recording?.status ?? 'not_requested';

  // Poll while a composition is in flight; stops itself once it lands on a terminal
  // status (completed/failed/expired) or this row unmounts.
  useEffect(() => {
    if (!onCheckRecordingStatus || !PENDING_RECORDING_STATUSES.includes(status)) return;
    let cancelled = false;
    const intervalId = window.setInterval(() => {
      onCheckRecordingStatus(roomSid)
        .then(updated => {
          if (!cancelled) setRecording(updated);
        })
        .catch(err => {
          if (!cancelled) console.error('HistoryTab: could not refresh recording status', { roomSid, error: err });
        });
    }, RECORDING_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [onCheckRecordingStatus, roomSid, status]);

  const handleRequest = useCallback(() => {
    if (!onRequestRecording) return;
    setIsBusy(true);
    setActionError(null);
    onRequestRecording(roomSid)
      .then(setRecording)
      .catch(err => setActionError(err.message || 'No pudimos solicitar la grabación.'))
      .finally(() => setIsBusy(false));
  }, [onRequestRecording, roomSid]);

  const handleDownload = useCallback(() => {
    if (!onGetRecordingDownloadUrl) return;
    setIsBusy(true);
    setActionError(null);
    onGetRecordingDownloadUrl(roomSid)
      .then(downloadUrl => {
        window.open(downloadUrl, '_blank', 'noopener');
      })
      .catch(err => setActionError(err.message || 'No pudimos descargar la grabación.'))
      .finally(() => setIsBusy(false));
  }, [onGetRecordingDownloadUrl, roomSid]);

  if (!report.recordingWasActiveAtEnd) {
    return <span className={classes.noRecording}>No disponible</span>;
  }

  const expiryHint = recording?.mediaExpiresAt
    ? `Disponible hasta ${new Date(recording.mediaExpiresAt).toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'short',
      })} (7 días)`
    : null;

  return (
    <div className={classes.recordingCell}>
      {status === 'not_requested' && (
        <button
          type="button"
          className={classes.recordingButton}
          onClick={handleRequest}
          disabled={isBusy || !onRequestRecording}
          data-testid={`dashboard-history-recording-request-${roomSid}`}
        >
          {isBusy && <CircularProgress size={12} />} Solicitar grabación
        </button>
      )}
      {PENDING_RECORDING_STATUSES.includes(status) && (
        <span className={classes.noRecording} data-testid={`dashboard-history-recording-pending-${roomSid}`}>
          <CircularProgress size={12} /> Procesando...
        </span>
      )}
      {status === 'completed' && (
        <>
          <button
            type="button"
            className={classes.recordingButton}
            onClick={handleDownload}
            disabled={isBusy || !onGetRecordingDownloadUrl}
            data-testid={`dashboard-history-recording-download-${roomSid}`}
          >
            <GetAppIcon style={{ fontSize: 14 }} /> Ver grabación
          </button>
          {expiryHint && <span className={classes.recordingHint}>{expiryHint}</span>}
        </>
      )}
      {status === 'failed' && (
        <>
          <span className={classes.recordingError} data-testid={`dashboard-history-recording-failed-${roomSid}`}>
            No pudimos generar la grabación.
          </span>
          <button
            type="button"
            className={classes.recordingButton}
            onClick={handleRequest}
            disabled={isBusy || !onRequestRecording}
            data-testid={`dashboard-history-recording-retry-${roomSid}`}
          >
            Reintentar
          </button>
        </>
      )}
      {status === 'expired' && (
        <span className={classes.recordingHint} data-testid={`dashboard-history-recording-expired-${roomSid}`}>
          La grabación venció — solo está disponible por 7 días.
        </span>
      )}
      {actionError && <span className={classes.recordingError}>{actionError}</span>}
    </div>
  );
}

/** Persisted classroom reports; the "GRABACIÓN" column is a real, server-proxied Twilio Composition lifecycle (see RecordingCell). */
export default function HistoryTab({
  reports,
  isLoading,
  error,
  onRetry,
  onOpenReport,
  onRequestRecording,
  onCheckRecordingStatus,
  onGetRecordingDownloadUrl,
}: Props) {
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
                      <RecordingCell
                        report={report}
                        onRequestRecording={onRequestRecording}
                        onCheckRecordingStatus={onCheckRecordingStatus}
                        onGetRecordingDownloadUrl={onGetRecordingDownloadUrl}
                      />
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
