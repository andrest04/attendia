import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import CloseIcon from '@material-ui/icons/Close';

import StandalonePage, { PageMessageCard, PageNavButton, PageTitle } from '../StandalonePage/StandalonePage';
import useAsyncResource from '../../hooks/useAsyncResource/useAsyncResource';
import { useAppState } from '../../state';
import { ResourceRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { t } from '../../i18n/translate';

/*
 * Standalone document viewer, opened in a NEW TAB from the "Ver" button on the
 * Recursos tab (see ResourcesTab.tsx handleView) — a real, bookmarkable/refreshable
 * URL instead of a raw blob: URL, same rationale as ReportPage. PDF and video render
 * as fetched; presentations/Word go through the server's on-the-fly PDF conversion
 * (GET /resources/:id/preview — see server/resources.ts) since browsers can't render
 * those formats natively. The route is protected (PrivateRoute): the server scopes
 * both the resource lookup and the file bytes to the verified Firebase uid.
 */

const useStyles = makeStyles(() => ({
  body: {
    flex: 1,
    minHeight: 0,
  },
  frame: {
    display: 'block',
    width: '100%',
    height: '100%',
    border: 'none',
  },
  video: {
    display: 'block',
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
}));

function needsConvertedPreview(kind: ResourceRecord['kind']): boolean {
  return kind === 'presentation' || kind === 'word';
}

const FAILURE_MESSAGE = 'No pudimos cargar el recurso.';

export default function ResourceViewerPage() {
  const classes = useStyles();
  const { resourceId } = useParams<{ resourceId: string }>();
  const { fetchResources, fetchResourceDownloadUrl, fetchResourcePreviewUrl } = useAppState();
  const isAvailable = Boolean(fetchResources && fetchResourceDownloadUrl && fetchResourcePreviewUrl);

  // Stage 1: find the resource, so its name shows in the bar while the file is still loading.
  const loadResource = useMemo(
    () =>
      isAvailable
        ? () =>
            fetchResources!().then(resources => {
              const found = resources.find(r => r.id === resourceId);
              if (!found) throw new Error('El recurso solicitado no existe.');
              return found;
            })
        : null,
    [isAvailable, fetchResources, resourceId]
  );
  const failureMessage = t(FAILURE_MESSAGE);
  const { data: resource, error: resourceError } = useAsyncResource(loadResource, { failureMessage });

  // Stage 2: fetch the file as a blob and expose it as an object URL, released with the page.
  const loadFile = useMemo(
    () =>
      resource && isAvailable
        ? () =>
            (needsConvertedPreview(resource.kind)
              ? fetchResourcePreviewUrl!(resource.id)
              : fetchResourceDownloadUrl!(resource.id)
            ).then(blob => URL.createObjectURL(blob))
        : null,
    [resource, isAvailable, fetchResourcePreviewUrl, fetchResourceDownloadUrl]
  );
  const { data: objectUrl, error: fileError } = useAsyncResource(loadFile, {
    failureMessage,
    dispose: url => URL.revokeObjectURL(url),
  });

  const error = isAvailable ? resourceError || fileError : t('No pudimos validar tu acceso a este recurso.');

  return (
    <StandalonePage
      testId="resource-viewer-page"
      fill
      navStart={<PageTitle tone="strong">{resource?.name || 'Vista previa'}</PageTitle>}
      navEnd={
        <PageNavButton
          onClick={() => window.close()}
          icon={<CloseIcon style={{ fontSize: 16 }} />}
          testId="resource-viewer-page-close"
        >
          Cerrar
        </PageNavButton>
      }
    >
      <div className={classes.body}>
        {objectUrl && resource ? (
          resource.kind === 'video' ? (
            <video className={classes.video} src={objectUrl} controls autoPlay data-testid="resource-viewer-video" />
          ) : (
            <iframe
              className={classes.frame}
              src={objectUrl}
              title={resource.name}
              data-testid="resource-viewer-frame"
            />
          )
        ) : (
          <PageMessageCard testId="resource-viewer-empty">{error || 'Cargando el documento...'}</PageMessageCard>
        )}
      </div>
    </StandalonePage>
  );
}
