import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { makeStyles, Theme } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import CloseIcon from '@material-ui/icons/Close';
import InsertDriveFileIcon from '@material-ui/icons/InsertDriveFile';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import { useAppState } from '../../state';
import { ResourceRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { dashboardTabPath, resourceKindIcon } from './dashboardHelpers';
import { ClassRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';
import ConfirmDialog from './ConfirmDialog';
import { MAX_FILES_PER_UPLOAD, RESOURCE_FILE_ACCEPT, validateResourceFile } from './resourceUploadValidation';

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
  uploadControls: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  uploadButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1, 2),
    borderRadius: theme.shape.borderRadius,
    border: 'none',
    cursor: 'pointer',
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.8125rem',
    flexShrink: 0,
    '&:disabled': {
      opacity: 0.6,
      cursor: 'default',
    },
  },
  pillTabs: {
    display: 'flex',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(3),
    flexWrap: 'wrap',
  },
  pill: {
    padding: theme.spacing(0.75, 2),
    borderRadius: 20,
    border: '1px solid #e2ecf9',
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.secondary,
    fontFamily: 'Inter, sans-serif',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  pillActive: {
    backgroundColor: '#1d2f6f',
    borderColor: '#1d2f6f',
    color: '#ffffff',
  },
  pillCancelledTag: {
    marginLeft: theme.spacing(0.75),
    color: theme.palette.text.hint,
    fontWeight: 400,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: theme.spacing(2.5),
  },
  fileCard: {
    backgroundColor: theme.palette.background.paper,
    border: '1px solid #e2ecf9',
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  fileCardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  fileIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ebf3ff',
    color: theme.palette.primary.main,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kebab: {
    color: theme.palette.text.secondary,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    display: 'flex',
  },
  fileName: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.875rem',
    color: theme.palette.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  fileMeta: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
  },
  fileActions: {
    display: 'flex',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  },
  downloadButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
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
  viewButton: {
    borderColor: theme.palette.primary.main,
    color: theme.palette.primary.main,
  },
  emptyTile: {
    border: '2px dashed #cbd5e1',
    borderRadius: theme.shape.borderRadius,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(3),
    color: theme.palette.text.secondary,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.8125rem',
    cursor: 'pointer',
    minHeight: 140,
  },
  uploadingCard: {
    backgroundColor: '#f1f4f9',
    border: '1px solid #e2ecf9',
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    position: 'relative',
  },
  uploadingCardError: {
    backgroundColor: '#fdf1f1',
    border: `1px solid ${theme.palette.error.main}`,
  },
  uploadingIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    color: theme.palette.text.secondary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingIconWrapError: {
    backgroundColor: '#fbdede',
    color: theme.palette.error.main,
  },
  dismissUploadButton: {
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(1),
    color: theme.palette.text.secondary,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    display: 'flex',
  },
  uploadErrorText: {
    fontSize: '0.75rem',
    color: theme.palette.error.main,
  },
  uploadingName: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.875rem',
    color: theme.palette.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#dbe4f3',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: theme.palette.primary.main,
    transition: 'width 150ms ease-out',
  },
  progressLabel: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
  },
  statusMessage: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '0.8125rem',
    color: theme.palette.text.secondary,
    padding: theme.spacing(2, 0),
  },
  errorMessage: {
    color: theme.palette.error.main,
  },
}));

interface ResourceGroup {
  classId: string;
  label: string;
  files: ResourceRecord[];
}

function groupByClass(resources: ResourceRecord[]): ResourceGroup[] {
  const groups: ResourceGroup[] = [];
  resources.forEach(resource => {
    if (!resource.classId || !resource.classTitle) return;
    const group = groups.find(g => g.classId === resource.classId);
    if (group) {
      group.files.push(resource);
    } else {
      groups.push({ classId: resource.classId, label: resource.classTitle, files: [resource] });
    }
  });
  return groups;
}

// PDF and video render natively; presentations and Word docs go through the server's
// on-the-fly PDF conversion (see ResourceViewerPage). Zips have no in-browser
// renderer for either format, so they stay download-only.
function isViewableKind(kind: ResourceRecord['kind']): boolean {
  return kind !== 'zip';
}

function formatSizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatDateLabel(ms: number | null): string {
  if (ms === null) return '';
  return new Date(ms).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

/** "Recursos" tab: real per-class file lists, backed by useAppState (Firestore + Storage). */
interface Props {
  classes: ClassRecord[];
}

export default function ResourcesTab({ classes: scheduledClasses }: Props) {
  const classes = useStyles();
  const { fetchResources, uploadResource, fetchResourceDownloadUrl, deleteResource } = useAppState();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeClassId, setActiveClassId] = useState<string>('');
  const [uploadingFiles, setUploadingFiles] = useState<
    { id: string; name: string; progress: number; error: string | null }[]
  >([]);
  const uploadIdRef = useRef(0);
  // Kept separate from the dialog's open flag: MUI's Dialog plays a ~225ms exit
  // transition with its content still mounted, so clearing this at the same time
  // as closing would flash "undefined" mid-animation (see ConfirmDialog usages).
  const [pendingDeleteResource, setPendingDeleteResource] = useState<ResourceRecord | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingResource, setIsDeletingResource] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!fetchResources) {
      setIsLoading(false);
      return;
    }
    fetchResources()
      .then(fetched => {
        if (!isMountedRef.current) return;
        setResources(fetched);
      })
      .catch(err => {
        if (isMountedRef.current) setErrorMessage(err.message);
      })
      .finally(() => {
        if (isMountedRef.current) setIsLoading(false);
      });
  }, [fetchResources]);

  const groups = useMemo(() => groupByClass(resources), [resources]);
  const scheduledClassIds = new Set(scheduledClasses.map(classRecord => classRecord.id));
  const pillOptions = useMemo(
    () => [
      ...scheduledClasses.map(classRecord => ({ classId: classRecord.id, label: classRecord.title, cancelled: false })),
      ...groups
        .filter(group => !scheduledClassIds.has(group.classId))
        .map(group => ({ classId: group.classId, label: group.label, cancelled: true })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scheduledClasses, groups]
  );

  // Defaults to the first scheduled class (so a teacher can upload the moment they
  // land here, no dropdown needed) and only falls back to an orphaned/cancelled
  // class's group when there are no scheduled classes at all.
  useEffect(() => {
    if (activeClassId) return;
    if (pillOptions.length > 0) setActiveClassId(pillOptions[0].classId);
  }, [activeClassId, pillOptions]);

  if (!fetchResources || !uploadResource || !fetchResourceDownloadUrl || !deleteResource) {
    return (
      <div className={classes.root} data-testid="dashboard-resources-tab">
        <div className={classes.title}>Recursos</div>
        <div className={classes.statusMessage}>
          Los recursos reales solo están disponibles con el modo de autenticación Firebase.
        </div>
      </div>
    );
  }

  const activeGroup = groups.find(g => g.classId === activeClassId);
  const activeUploadCount = uploadingFiles.filter(u => !u.error).length;

  const handleSelectGroup = (classId: string) => {
    setActiveClassId(classId);
  };

  const handleUploadClick = () => {
    if (!activeClassId) {
      setErrorMessage('Selecciona una clase programada antes de subir el archivo.');
      return;
    }
    fileInputRef.current?.click();
  };

  const removeUploadEntry = (id: string) => {
    setUploadingFiles(current => current.filter(u => u.id !== id));
  };

  const startUpload = (file: File, classId: string) => {
    const id = `upload-${uploadIdRef.current++}`;
    setUploadingFiles(current => [...current, { id, name: file.name, progress: 0, error: null }]);

    uploadResource(file, classId, percent => {
      if (!isMountedRef.current) return;
      setUploadingFiles(current => current.map(u => (u.id === id ? { ...u, progress: percent } : u)));
    })
      .then(created => {
        if (!isMountedRef.current) return;
        setResources(current => [created, ...current]);
        setActiveClassId(created.classId || classId);
        removeUploadEntry(id);
      })
      .catch(err => {
        // Left in the grid (not auto-removed) so the teacher sees which file
        // failed and why; dismissed manually via the card's close button.
        if (isMountedRef.current) {
          setUploadingFiles(current => current.map(u => (u.id === id ? { ...u, error: err.message } : u)));
        }
      });
  };

  // Each selected file uploads independently and in parallel, its own progress
  // tracked by id — one slow/failing file doesn't block or fail the others.
  const handleFileSelected: React.ChangeEventHandler<HTMLInputElement> = event => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;

    setErrorMessage(null);

    if (files.length > MAX_FILES_PER_UPLOAD) {
      setErrorMessage(`Puedes subir hasta ${MAX_FILES_PER_UPLOAD} archivos a la vez. Selecciona menos archivos e intenta de nuevo.`);
      return;
    }

    files.forEach(file => {
      const validationError = validateResourceFile(file);
      if (validationError) {
        const id = `upload-${uploadIdRef.current++}`;
        setUploadingFiles(current => [...current, { id, name: file.name, progress: 0, error: validationError }]);
        return;
      }
      startUpload(file, activeClassId);
    });
  };

  const handleDownload = (resource: ResourceRecord) => {
    fetchResourceDownloadUrl(resource.id)
      .then(blob => {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = resource.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      })
      .catch(err => {
        if (isMountedRef.current) setErrorMessage(err.message);
      });
  };

  // A real, bookmarkable/refreshable route (ResourceViewerPage) instead of a raw
  // blob: URL — that page does its own authenticated fetch (download or, for
  // presentations/Word, the converted-PDF preview) and renders it in an <iframe>/
  // <video>, which also sidesteps blob: URLs' unreliable top-level-navigation
  // rendering in some browsers.
  const handleView = (resource: ResourceRecord) => {
    window.open(`${dashboardTabPath.recursos}/${resource.id}/ver`, '_blank');
  };

  const handleDelete = (resource: ResourceRecord) => {
    setPendingDeleteResource(resource);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!pendingDeleteResource) return;
    const resource = pendingDeleteResource;
    setIsDeletingResource(true);
    deleteResource(resource.id)
      .then(() => {
        if (isMountedRef.current) setResources(current => current.filter(r => r.id !== resource.id));
      })
      .catch(err => {
        if (isMountedRef.current) setErrorMessage(err.message);
      })
      .finally(() => {
        if (isMountedRef.current) {
          setIsDeletingResource(false);
          setIsDeleteDialogOpen(false);
        }
      });
  };

  return (
    <div className={classes.root} data-testid="dashboard-resources-tab">
      <div className={classes.header}>
        <div>
          <div className={classes.title}>Recursos</div>
          <div className={classes.subtitle}>Materiales asociados a clases programadas</div>
        </div>
        <div className={classes.uploadControls}>
          <button
            type="button"
            className={classes.uploadButton}
            onClick={handleUploadClick}
            disabled={activeUploadCount > 0}
            data-testid="dashboard-upload-file-button"
          >
            <AddIcon style={{ fontSize: 18 }} />
            {activeUploadCount > 0 ? `Subiendo… (${activeUploadCount})` : 'Subir archivo'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            multiple
            accept={RESOURCE_FILE_ACCEPT}
            onChange={handleFileSelected}
            data-testid="dashboard-resources-file-input"
          />
        </div>
      </div>

      {isLoading && <div className={classes.statusMessage}>Cargando recursos…</div>}
      {errorMessage && <div className={clsx(classes.statusMessage, classes.errorMessage)}>{errorMessage}</div>}

      {!isLoading && pillOptions.length > 0 && (
        <div className={classes.pillTabs}>
          {pillOptions.map(option => (
            <button
              key={option.classId}
              type="button"
              className={clsx(classes.pill, { [classes.pillActive]: option.classId === activeClassId })}
              onClick={() => handleSelectGroup(option.classId)}
              data-testid={`dashboard-resources-pill-${option.classId}`}
            >
              {option.label}
              {option.cancelled && (
                <span className={classes.pillCancelledTag} data-testid={`dashboard-resources-pill-cancelled-${option.classId}`}>
                  (clase cancelada)
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {!isLoading && pillOptions.length === 0 && (
        <div className={classes.statusMessage}>Todavía no tenés clases programadas para asociar recursos.</div>
      )}

      {!isLoading && (
        <div className={classes.grid} data-testid="dashboard-resources-grid">
          {(activeGroup?.files || []).map(file => {
            const Icon = resourceKindIcon[file.kind];
            return (
              <div key={file.id} className={classes.fileCard} data-testid={`dashboard-resource-file-${file.id}`}>
                <div className={classes.fileCardHeader}>
                  <span className={classes.fileIconWrap}>
                    <Icon style={{ fontSize: 20 }} />
                  </span>
                  <button
                    type="button"
                    className={classes.kebab}
                    onClick={() => handleDelete(file)}
                    aria-label="Eliminar recurso"
                    data-testid="dashboard-resource-delete"
                  >
                    <DeleteIcon style={{ fontSize: 20 }} />
                  </button>
                </div>
                <div className={classes.fileName} title={file.name}>
                  {file.name}
                </div>
                <div className={classes.fileMeta}>
                  {formatSizeLabel(file.sizeBytes)} · {formatDateLabel(file.createdAtMs)}
                </div>
                <div className={classes.fileActions}>
                  {isViewableKind(file.kind) && (
                    <button
                      type="button"
                      className={clsx(classes.downloadButton, classes.viewButton)}
                      onClick={() => handleView(file)}
                      data-testid="dashboard-resource-view"
                    >
                      <OpenInNewIcon style={{ fontSize: 14 }} />
                      Ver
                    </button>
                  )}
                  <button
                    type="button"
                    className={classes.downloadButton}
                    onClick={() => handleDownload(file)}
                    data-testid="dashboard-resource-download"
                  >
                    Descargar
                  </button>
                </div>
              </div>
            );
          })}
          {uploadingFiles.map(upload => (
            <div
              key={upload.id}
              className={clsx(classes.uploadingCard, { [classes.uploadingCardError]: !!upload.error })}
              data-testid={`dashboard-resources-uploading-card-${upload.id}`}
            >
              {upload.error && (
                <button
                  type="button"
                  className={classes.dismissUploadButton}
                  onClick={() => removeUploadEntry(upload.id)}
                  aria-label="Descartar"
                  data-testid={`dashboard-resources-uploading-dismiss-${upload.id}`}
                >
                  <CloseIcon style={{ fontSize: 18 }} />
                </button>
              )}
              <span className={clsx(classes.uploadingIconWrap, { [classes.uploadingIconWrapError]: !!upload.error })}>
                {upload.error ? (
                  <ErrorOutlineIcon style={{ fontSize: 20 }} />
                ) : (
                  <InsertDriveFileIcon style={{ fontSize: 20 }} />
                )}
              </span>
              <div className={classes.uploadingName} title={upload.name}>
                {upload.name}
              </div>
              {upload.error ? (
                <div className={classes.uploadErrorText}>{upload.error}</div>
              ) : (
                <>
                  <div className={classes.progressBarTrack}>
                    <div className={classes.progressBarFill} style={{ width: `${upload.progress}%` }} />
                  </div>
                  <div className={classes.progressLabel}>Subiendo… {upload.progress}%</div>
                </>
              )}
            </div>
          ))}
          <button
            type="button"
            className={classes.emptyTile}
            onClick={handleUploadClick}
            data-testid="dashboard-resources-empty-upload-tile"
          >
            <AddIcon style={{ fontSize: 22 }} />
            Subir archivo
          </button>
        </div>
      )}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        title="Eliminar recurso"
        message={`¿Eliminar "${pendingDeleteResource?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Volver"
        isConfirming={isDeletingResource}
        onConfirm={confirmDelete}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
    </div>
  );
}
