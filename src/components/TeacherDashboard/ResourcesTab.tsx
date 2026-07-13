import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { makeStyles, Theme } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import { useAppState } from '../../state';
import { ResourceRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { resourceKindIcon } from './dashboardHelpers';
import { ClassRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';
import ConfirmDialog from './ConfirmDialog';

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
  roomLabelInput: {
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.shape.borderRadius,
    border: '1px solid #e2ecf9',
    fontFamily: 'Inter, sans-serif',
    fontSize: '0.8125rem',
    minWidth: 160,
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
  },
  fileMeta: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
  },
  downloadButton: {
    padding: theme.spacing(0.75, 1.5),
    borderRadius: theme.shape.borderRadius,
    border: '1px solid #e2ecf9',
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.75rem',
    cursor: 'pointer',
    alignSelf: 'flex-start',
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
  const [isUploading, setIsUploading] = useState(false);
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
        if (fetched.length > 0) {
          const firstAssociated = fetched.find(resource => resource.classId);
          if (firstAssociated) setActiveClassId(current => current || firstAssociated.classId!);
        }
      })
      .catch(err => {
        if (isMountedRef.current) setErrorMessage(err.message);
      })
      .finally(() => {
        if (isMountedRef.current) setIsLoading(false);
      });
  }, [fetchResources]);

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

  const groups = groupByClass(resources);
  const activeGroup = groups.find(g => g.classId === activeClassId) || groups[0];
  const scheduledClassIds = new Set(scheduledClasses.map(classRecord => classRecord.id));

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

  const handleFileSelected: React.ChangeEventHandler<HTMLInputElement> = event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsUploading(true);
    setErrorMessage(null);
    uploadResource(file, activeClassId)
      .then(created => {
        if (!isMountedRef.current) return;
        setResources(current => [created, ...current]);
        setActiveClassId(created.classId || activeClassId);
      })
      .catch(err => {
        if (isMountedRef.current) setErrorMessage(err.message);
      })
      .finally(() => {
        if (isMountedRef.current) setIsUploading(false);
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
          <select
            className={classes.roomLabelInput}
            aria-label="Clase asociada"
            value={activeClassId}
            onChange={e => setActiveClassId(e.target.value)}
            data-testid="dashboard-resources-class-select"
          >
            <option value="">Seleccionar clase</option>
            {scheduledClasses.map(classRecord => (
              <option key={classRecord.id} value={classRecord.id}>
                {classRecord.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={classes.uploadButton}
            onClick={handleUploadClick}
            disabled={isUploading}
            data-testid="dashboard-upload-file-button"
          >
            <AddIcon style={{ fontSize: 18 }} />
            {isUploading ? 'Subiendo…' : 'Subir archivo'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={handleFileSelected}
            data-testid="dashboard-resources-file-input"
          />
        </div>
      </div>

      {isLoading && <div className={classes.statusMessage}>Cargando recursos…</div>}
      {errorMessage && <div className={clsx(classes.statusMessage, classes.errorMessage)}>{errorMessage}</div>}

      {!isLoading && groups.length > 0 && (
        <div className={classes.pillTabs}>
          {groups.map(group => (
            <button
              key={group.classId}
              type="button"
              className={clsx(classes.pill, { [classes.pillActive]: group.classId === activeGroup?.classId })}
              onClick={() => handleSelectGroup(group.classId)}
              data-testid={`dashboard-resources-pill-${group.classId}`}
            >
              {group.label}
              {!scheduledClassIds.has(group.classId) && (
                <span className={classes.pillCancelledTag} data-testid={`dashboard-resources-pill-cancelled-${group.classId}`}>
                  (clase cancelada)
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {!isLoading && groups.length === 0 && (
        <div className={classes.statusMessage}>Todavía no subiste recursos asociados a una clase programada.</div>
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
                <div className={classes.fileName}>{file.name}</div>
                <div className={classes.fileMeta}>
                  {formatSizeLabel(file.sizeBytes)} · {formatDateLabel(file.createdAtMs)}
                </div>
                <button
                  type="button"
                  className={classes.downloadButton}
                  onClick={() => handleDownload(file)}
                  data-testid="dashboard-resource-download"
                >
                  Descargar
                </button>
              </div>
            );
          })}
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
