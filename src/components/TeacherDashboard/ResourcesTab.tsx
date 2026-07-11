import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { makeStyles, Theme } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import { useAppState } from '../../state';
import { ResourceRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { toClassSessionRoomName } from '../PreJoinScreens/classSessionTypes';
import { resourceKindIcon } from './dashboardHelpers';

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
  label: string;
  files: ResourceRecord[];
}

function groupByRoomLabel(resources: ResourceRecord[]): ResourceGroup[] {
  const groups: ResourceGroup[] = [];
  resources.forEach(resource => {
    const group = groups.find(g => g.label === resource.roomLabel);
    if (group) {
      group.files.push(resource);
    } else {
      groups.push({ label: resource.roomLabel, files: [resource] });
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
export default function ResourcesTab() {
  const classes = useStyles();
  const { fetchResources, uploadResource, fetchResourceDownloadUrl, deleteResource } = useAppState();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeGroupLabel, setActiveGroupLabel] = useState<string | null>(null);
  const [roomLabelInput, setRoomLabelInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!fetchResources) {
      setIsLoading(false);
      return;
    }
    fetchResources()
      .then(fetched => {
        setResources(fetched);
        if (fetched.length > 0) {
          setActiveGroupLabel(current => current ?? fetched[0].roomLabel);
          setRoomLabelInput(current => current || fetched[0].roomLabel);
        }
      })
      .catch(err => setErrorMessage(err.message))
      .finally(() => setIsLoading(false));
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

  const groups = groupByRoomLabel(resources);
  const activeGroup = groups.find(g => g.label === activeGroupLabel) || groups[0];

  const handleSelectGroup = (label: string) => {
    setActiveGroupLabel(label);
    setRoomLabelInput(label);
  };

  const handleUploadClick = () => {
    if (!roomLabelInput.trim()) {
      setErrorMessage('Indicá a qué clase pertenece el archivo antes de subirlo.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileSelected: React.ChangeEventHandler<HTMLInputElement> = event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const roomLabel = roomLabelInput.trim();
    setIsUploading(true);
    setErrorMessage(null);
    uploadResource(file, roomLabel)
      .then(created => {
        setResources(current => [created, ...current]);
        setActiveGroupLabel(roomLabel);
      })
      .catch(err => setErrorMessage(err.message))
      .finally(() => setIsUploading(false));
  };

  const handleDownload = (resource: ResourceRecord) => {
    fetchResourceDownloadUrl(resource.id)
      .then(url => window.open(url, '_blank', 'noopener'))
      .catch(err => setErrorMessage(err.message));
  };

  const handleDelete = (resource: ResourceRecord) => {
    if (!window.confirm(`¿Eliminar "${resource.name}"? Esta acción no se puede deshacer.`)) return;
    deleteResource(resource.id)
      .then(() => setResources(current => current.filter(r => r.id !== resource.id)))
      .catch(err => setErrorMessage(err.message));
  };

  return (
    <div className={classes.root} data-testid="dashboard-resources-tab">
      <div className={classes.header}>
        <div>
          <div className={classes.title}>Recursos</div>
          <div className={classes.subtitle}>Materiales, presentaciones y grabaciones</div>
        </div>
        <div className={classes.uploadControls}>
          <input
            type="text"
            className={classes.roomLabelInput}
            placeholder="Nombre de la clase"
            value={roomLabelInput}
            onChange={e => setRoomLabelInput(e.target.value)}
            data-testid="dashboard-resources-room-label-input"
          />
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
              key={group.label}
              type="button"
              className={clsx(classes.pill, { [classes.pillActive]: group.label === activeGroup?.label })}
              onClick={() => handleSelectGroup(group.label)}
              data-testid={`dashboard-resources-pill-${toClassSessionRoomName(group.label)}`}
            >
              {group.label}
            </button>
          ))}
        </div>
      )}

      {!isLoading && groups.length === 0 && (
        <div className={classes.statusMessage}>
          Todavía no subiste ningún recurso. Escribí el nombre de la clase y subí el primer archivo.
        </div>
      )}

      {!isLoading && activeGroup && (
        <div className={classes.grid} data-testid="dashboard-resources-grid">
          {activeGroup.files.map(file => {
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
          <div
            className={classes.emptyTile}
            onClick={handleUploadClick}
            data-testid="dashboard-resources-empty-upload-tile"
          >
            <AddIcon style={{ fontSize: 22 }} />
            Subir archivo
          </div>
        </div>
      )}
    </div>
  );
}
