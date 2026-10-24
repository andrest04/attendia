import React from 'react';
import clsx from 'clsx';
import { makeStyles, Theme } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import CloseIcon from '@material-ui/icons/Close';
import InsertDriveFileIcon from '@material-ui/icons/InsertDriveFile';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import { ResourceRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { resourceKindIcon } from './dashboardHelpers';
import { ClassRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';
import ConfirmDialog from './ConfirmDialog';
import { RESOURCE_FILE_ACCEPT } from './resourceUploadValidation';
import useTeacherResources from './useTeacherResources';
import { dateLocale } from '../../i18n/locale';
import { t } from '../../i18n/translate';

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
  pillDateTag: {
    marginLeft: theme.spacing(0.75),
    color: theme.palette.text.hint,
    fontWeight: 400,
  },
  bulkDeleteRow: {
    marginBottom: theme.spacing(2.5),
  },
  bulkDeleteButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.75, 1.5),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.error.main}`,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.error.main,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.8125rem',
    cursor: 'pointer',
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
  return new Date(ms).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });
}

/** "Recursos" tab: real per-class file lists, backed by useAppState (Firestore + Storage). */
interface Props {
  classes: ClassRecord[];
  /** Scheduled classes whose grace period elapsed without being started (see
   * findExpiredClasses) — "vencida" pills get the same bulk-delete affordance as
   * cancelled ones, since a class that never started never will either. */
  expiredClassIds?: Set<string>;
  /** Firebase-mode only: hard-deletes a vencida/completed class's doc (mirrors
   * TeacherDashboard's own cancelClass). A "cancelada" pill has no doc left to
   * delete — only expired/completed ones need this, since they're the only
   * pills that can be empty of files and still stick around forever otherwise. */
  onDeleteClass?: (classId: string) => Promise<void>;
}

export default function ResourcesTab({ classes: scheduledClasses, expiredClassIds, onDeleteClass }: Props) {
  const classes = useStyles();
  const {
    isAvailable,
    fileInputRef,
    isLoading,
    errorMessage,
    activeClassId,
    activeGroup,
    activeOption,
    pillOptions,
    uploadingFiles,
    activeUploadCount,
    canCleanupActive,
    deleteDialog,
    isDeletingResource,
    bulkDeleteDialog,
    isBulkDeleting,
    bulkDeleteError,
    handleSelectGroup,
    handleUploadClick,
    removeUploadEntry,
    handleFileSelected,
    handleDownload,
    handleView,
    handleDelete,
    confirmDelete,
    handleBulkDeleteClick,
    confirmBulkDelete,
  } = useTeacherResources({ scheduledClasses, expiredClassIds, onDeleteClass });

  if (!isAvailable) {
    return (
      <div className={classes.root} data-testid="dashboard-resources-tab">
        <div className={classes.title}>{t('Recursos')}</div>
        <div className={classes.statusMessage}>
          {t('Los recursos reales solo están disponibles con el modo de autenticación Firebase.')}
        </div>
      </div>
    );
  }

  return (
    <div className={classes.root} data-testid="dashboard-resources-tab">
      <div className={classes.header}>
        <div>
          <div className={classes.title}>{t('Recursos')}</div>
          <div className={classes.subtitle}>{t('Materiales asociados a clases programadas')}</div>
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
            {activeUploadCount > 0 ? t('Subiendo… ({{count}})', { count: activeUploadCount }) : t('Subir archivo')}
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

      {isLoading && <div className={classes.statusMessage}>{t('Cargando recursos…')}</div>}
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
              {!option.cancelled && option.scheduledAtMs !== null && (
                <span className={classes.pillDateTag} data-testid={`dashboard-resources-pill-date-${option.classId}`}>
                  · {formatDateLabel(option.scheduledAtMs)}
                </span>
              )}
              {option.cancelled && (
                <span
                  className={classes.pillCancelledTag}
                  data-testid={`dashboard-resources-pill-cancelled-${option.classId}`}
                >
                  {t('(clase cancelada)')}
                </span>
              )}
              {!option.cancelled && option.expired && (
                <span
                  className={classes.pillCancelledTag}
                  data-testid={`dashboard-resources-pill-expired-${option.classId}`}
                >
                  {t('(clase vencida)')}
                </span>
              )}
              {!option.cancelled && !option.expired && option.completed && (
                <span
                  className={classes.pillCancelledTag}
                  data-testid={`dashboard-resources-pill-completed-${option.classId}`}
                >
                  {t('(clase finalizada)')}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {!isLoading && pillOptions.length === 0 && (
        <div className={classes.statusMessage}>{t('Todavía no tienes clases programadas para asociar recursos.')}</div>
      )}

      {!isLoading && canCleanupActive && (
        <div className={classes.bulkDeleteRow}>
          <button
            type="button"
            className={classes.bulkDeleteButton}
            onClick={handleBulkDeleteClick}
            data-testid="dashboard-resources-bulk-delete-button"
          >
            <DeleteIcon style={{ fontSize: 16 }} />
            {activeOption!.cancelled
              ? activeGroup!.files.length === 1
                ? t('Eliminar el recurso de esta clase')
                : t('Eliminar los {{count}} recursos de esta clase', { count: activeGroup!.files.length })
              : t('Eliminar clase')}
          </button>
        </div>
      )}
      {bulkDeleteError && (
        <div
          className={clsx(classes.statusMessage, classes.errorMessage)}
          data-testid="dashboard-resources-bulk-delete-error"
        >
          {bulkDeleteError}
        </div>
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
                    aria-label={t('Eliminar recurso')}
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
                      {t('Ver')}
                    </button>
                  )}
                  <button
                    type="button"
                    className={classes.downloadButton}
                    onClick={() => handleDownload(file)}
                    data-testid="dashboard-resource-download"
                  >
                    {t('Descargar')}
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
                  aria-label={t('Descartar')}
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
                  <div className={classes.progressLabel}>
                    {t('Subiendo…')} {upload.progress}%
                  </div>
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
            {t('Subir archivo')}
          </button>
        </div>
      )}
      <ConfirmDialog
        open={deleteDialog.isOpen}
        title={t('Eliminar recurso')}
        message={t('¿Eliminar "{{name}}"? Esta acción no se puede deshacer.', {
          name: deleteDialog.target?.name || '',
        })}
        confirmLabel={t('Eliminar')}
        cancelLabel={t('Volver')}
        isConfirming={isDeletingResource}
        onConfirm={confirmDelete}
        onCancel={deleteDialog.close}
      />
      <ConfirmDialog
        open={bulkDeleteDialog.isOpen}
        title={activeOption?.cancelled ? t('Eliminar recursos de la clase') : t('Eliminar clase')}
        message={
          activeOption?.cancelled
            ? activeGroup?.files.length === 1
              ? t('¿Eliminar el archivo de "{{name}}"? Esta acción no se puede deshacer.', {
                  name: activeOption.label,
                })
              : t('¿Eliminar los {{count}} archivos de "{{name}}"? Esta acción no se puede deshacer.', {
                  count: activeGroup?.files.length || 0,
                  name: activeOption.label,
                })
            : !activeGroup || activeGroup.files.length === 0
            ? t('¿Eliminar la clase "{{name}}"? Esta acción no se puede deshacer.', { name: activeOption?.label || '' })
            : activeGroup.files.length === 1
            ? t('¿Eliminar la clase "{{name}}" y su recurso? Esta acción no se puede deshacer.', {
                name: activeOption?.label || '',
              })
            : t('¿Eliminar la clase "{{name}}" y sus {{count}} recursos? Esta acción no se puede deshacer.', {
                name: activeOption?.label || '',
                count: activeGroup.files.length,
              })
        }
        confirmLabel={t('Eliminar todo')}
        cancelLabel={t('Volver')}
        isConfirming={isBulkDeleting}
        onConfirm={confirmBulkDelete}
        onCancel={bulkDeleteDialog.close}
      />
    </div>
  );
}
