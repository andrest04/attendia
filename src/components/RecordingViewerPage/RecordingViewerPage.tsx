import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import CloseIcon from '@material-ui/icons/Close';
import GetAppIcon from '@material-ui/icons/GetApp';

import StandalonePage, { PageMessageCard, PageNavButton, PageNote, PageTitle } from '../StandalonePage/StandalonePage';
import useAsyncResource from '../../hooks/useAsyncResource/useAsyncResource';
import { useAppState } from '../../state';
import { t } from '../../i18n/translate';

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

const useStyles = makeStyles(() => ({
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
}));

export default function RecordingViewerPage() {
  const classes = useStyles();
  const { roomSid } = useParams<{ roomSid: string }>();
  const { fetchRecordingDownloadUrl } = useAppState();

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const load = useMemo(() => (fetchRecordingDownloadUrl ? () => fetchRecordingDownloadUrl(roomSid) : null), [
    roomSid,
    fetchRecordingDownloadUrl,
  ]);
  const { data: videoUrl, error: loadError } = useAsyncResource(load, {
    failureMessage: t('No pudimos cargar la grabación.'),
  });
  const error = fetchRecordingDownloadUrl ? loadError : t('No pudimos validar tu acceso a esta grabación.');

  const handleDownload = () => {
    if (!fetchRecordingDownloadUrl) return;
    setIsDownloading(true);
    setDownloadError(null);
    fetchRecordingDownloadUrl(roomSid)
      .then(ticketUrl => window.open(ticketUrl, '_blank', 'noopener'))
      .catch(err => setDownloadError(err.message || t('No pudimos descargar la grabación.')))
      .finally(() => setIsDownloading(false));
  };

  return (
    <StandalonePage
      testId="recording-viewer-page"
      fill
      navStart={<PageTitle tone="strong">{t('Grabación de la clase')}</PageTitle>}
      navEnd={
        <>
          {videoUrl && (
            <PageNavButton
              variant="outlined"
              onClick={handleDownload}
              disabled={isDownloading}
              icon={<GetAppIcon style={{ fontSize: 16 }} />}
              testId="recording-viewer-page-download"
            >
              {t('Descargar')}
            </PageNavButton>
          )}
          <PageNavButton
            onClick={() => window.close()}
            icon={<CloseIcon style={{ fontSize: 16 }} />}
            testId="recording-viewer-page-close"
          >
            {t('Cerrar')}
          </PageNavButton>
        </>
      }
    >
      <div className={classes.body}>
        {videoUrl ? (
          <video className={classes.video} src={videoUrl} controls autoPlay data-testid="recording-viewer-video" />
        ) : (
          <PageMessageCard testId="recording-viewer-empty">{error || t('Cargando la grabación...')}</PageMessageCard>
        )}
        {downloadError && <PageNote testId="recording-viewer-page-download-error">{downloadError}</PageNote>}
      </div>
    </StandalonePage>
  );
}
