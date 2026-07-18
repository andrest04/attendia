import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import CloseIcon from '@material-ui/icons/Close';
import GetAppIcon from '@material-ui/icons/GetApp';

import AttendiaLogo from '../Brand/AttendiaLogo';
import { useAppState } from '../../state';

/*
 * Standalone recording player, opened in a NEW TAB from "Ver grabación" on the
 * Historial tab (see HistoryTab.tsx RecordingCell) — a real, bookmarkable/refreshable
 * URL instead of navigating straight to the ticketed media redirect, which used to
 * make the browser treat the click as a file download instead of playback.
 *
 * The ticket URL (fetchRecordingDownloadUrl) redirects to a signed S3 URL that has no
 * CORS headers for our origin and is signed with `response-content-disposition:
 * attachment` — so it CANNOT be `fetch()`ed into a blob (opaque/CORS-blocked) the way
 * ResourceViewerPage does for Appwrite-backed resources. Instead the ticket URL is
 * handed straight to the <video> element's `src`: media-element fetches aren't subject
 * to the fetch/XHR same-origin check, and the attachment disposition only affects
 * top-level navigation/downloads, not element-level media playback. "Descargar" asks
 * for a *fresh* ticket right when clicked (the 5-minute ticket TTL may have lapsed by
 * then) and triggers the download the same way HistoryTab used to, via window.open.
 * The route is protected (PrivateRoute): the server scopes the recording lookup and
 * ticket issuance to the verified Firebase uid.
 */

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    backgroundColor: '#f0f5ff',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(2, 3),
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2ecf9',
    flexShrink: 0,
  },
  navDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e2ecf9',
  },
  title: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    color: '#0f172a',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  downloadButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    border: '1px solid #e2ecf9',
    background: 'none',
    cursor: 'pointer',
    padding: '6px 10px',
    borderRadius: 8,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.8125rem',
    color: '#0f172a',
    marginLeft: 'auto',
    flexShrink: 0,
    '&:hover': {
      backgroundColor: '#ebf3ff',
    },
    '&:disabled': { cursor: 'default', opacity: 0.6 },
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
    flexShrink: 0,
    '&:hover': {
      backgroundColor: '#ebf3ff',
    },
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  video: {
    display: 'block',
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  emptyCard: {
    maxWidth: 480,
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

export default function RecordingViewerPage() {
  const classes = useStyles();
  const { roomSid } = useParams<{ roomSid: string }>();
  const { fetchRecordingDownloadUrl } = useAppState();

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (!fetchRecordingDownloadUrl) {
      setError('No pudimos validar tu acceso a esta grabación.');
      return;
    }

    let cancelled = false;
    fetchRecordingDownloadUrl(roomSid)
      .then(ticketUrl => {
        if (!cancelled) setVideoUrl(ticketUrl);
      })
      .catch(err => {
        if (!cancelled) setError(err.message || 'No pudimos cargar la grabación.');
      });

    return () => {
      cancelled = true;
    };
  }, [roomSid, fetchRecordingDownloadUrl]);

  const handleDownload = () => {
    if (!fetchRecordingDownloadUrl) return;
    setIsDownloading(true);
    setDownloadError(null);
    fetchRecordingDownloadUrl(roomSid)
      .then(ticketUrl => window.open(ticketUrl, '_blank', 'noopener'))
      .catch(err => setDownloadError(err.message || 'No pudimos descargar la grabación.'))
      .finally(() => setIsDownloading(false));
  };

  return (
    <div className={classes.root} data-testid="recording-viewer-page">
      <nav className={classes.nav}>
        <AttendiaLogo variant="full" size={28} />
        <div className={classes.navDivider} />
        <Typography variant="body2" className={classes.title}>
          Grabación de la clase
        </Typography>
        {videoUrl && (
          <button
            type="button"
            className={classes.downloadButton}
            onClick={handleDownload}
            disabled={isDownloading}
            data-testid="recording-viewer-page-download"
          >
            <GetAppIcon style={{ fontSize: 16 }} />
            Descargar
          </button>
        )}
        <button
          type="button"
          className={classes.closeButton}
          onClick={() => window.close()}
          data-testid="recording-viewer-page-close"
        >
          <CloseIcon style={{ fontSize: 16 }} />
          Cerrar
        </button>
      </nav>

      <div className={classes.body}>
        {videoUrl ? (
          <video className={classes.video} src={videoUrl} controls autoPlay data-testid="recording-viewer-video" />
        ) : (
          <div className={classes.emptyCard} data-testid="recording-viewer-empty">
            <Typography className={classes.emptyText}>{error || 'Cargando la grabación...'}</Typography>
          </div>
        )}
        {downloadError && (
          <Typography className={classes.emptyText} data-testid="recording-viewer-page-download-error">
            {downloadError}
          </Typography>
        )}
      </div>
    </div>
  );
}
