import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import CloseIcon from '@material-ui/icons/Close';

import AttendiaLogo from '../Brand/AttendiaLogo';
import { useAppState } from '../../state';
import { ResourceRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';

/*
 * Standalone document viewer, opened in a NEW TAB from the "Ver" button on the
 * Recursos tab (see ResourcesTab.tsx handleView) — a real, bookmarkable/refreshable
 * URL instead of a raw blob: URL, same rationale as ReportPage. PDF and video render
 * as fetched; presentations/Word go through the server's on-the-fly PDF conversion
 * (GET /resources/:id/preview — see server/resources.ts) since browsers can't render
 * those formats natively. The route is protected (PrivateRoute): the server scopes
 * both the resource lookup and the file bytes to the verified Firebase uid.
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
  resourceName: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    color: '#0f172a',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
    flexShrink: 0,
    '&:hover': {
      backgroundColor: '#ebf3ff',
    },
  },
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

function needsConvertedPreview(kind: ResourceRecord['kind']): boolean {
  return kind === 'presentation' || kind === 'word';
}

export default function ResourceViewerPage() {
  const classes = useStyles();
  const { resourceId } = useParams<{ resourceId: string }>();
  const { fetchResources, fetchResourceDownloadUrl, fetchResourcePreviewUrl } = useAppState();

  const [resource, setResource] = useState<ResourceRecord | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fetchResources || !fetchResourceDownloadUrl || !fetchResourcePreviewUrl) {
      setError('No pudimos validar tu acceso a este recurso.');
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;

    fetchResources()
      .then(resources => {
        if (cancelled) return;
        const found = resources.find(r => r.id === resourceId);
        if (!found) {
          setError('El recurso solicitado no existe.');
          return;
        }
        setResource(found);

        const fetchBlob = needsConvertedPreview(found.kind)
          ? fetchResourcePreviewUrl(found.id)
          : fetchResourceDownloadUrl(found.id);

        return fetchBlob.then(blob => {
          if (cancelled) return;
          createdUrl = URL.createObjectURL(blob);
          setObjectUrl(createdUrl);
        });
      })
      .catch(err => {
        if (!cancelled) setError(err.message || 'No pudimos cargar el recurso.');
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId, fetchResources, fetchResourceDownloadUrl, fetchResourcePreviewUrl]);

  return (
    <div className={classes.root} data-testid="resource-viewer-page">
      <nav className={classes.nav}>
        <AttendiaLogo variant="full" size={28} />
        <div className={classes.navDivider} />
        <Typography variant="body2" className={classes.resourceName}>
          {resource?.name || 'Vista previa'}
        </Typography>
        <button
          type="button"
          className={classes.closeButton}
          onClick={() => window.close()}
          data-testid="resource-viewer-page-close"
        >
          <CloseIcon style={{ fontSize: 16 }} />
          Cerrar
        </button>
      </nav>

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
          <div className={classes.emptyCard} data-testid="resource-viewer-empty">
            <Typography className={classes.emptyText}>{error || 'Cargando el documento...'}</Typography>
          </div>
        )}
      </div>
    </div>
  );
}
