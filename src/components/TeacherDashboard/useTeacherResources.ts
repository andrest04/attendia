import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '../../state';
import { ClassRecord, ResourceRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { countOf } from '../../utils/pluralize';
import useConfirmDialog from '../../hooks/useConfirmDialog/useConfirmDialog';
import { routePath } from '../../routes';
import { MAX_FILES_PER_UPLOAD, validateResourceFile } from './resourceUploadValidation';
import { t } from '../../i18n/translate';

export interface ResourceGroup {
  classId: string;
  label: string;
  files: ResourceRecord[];
}

export interface UploadingFile {
  id: string;
  name: string;
  progress: number;
  error: string | null;
}

export interface UseTeacherResourcesParams {
  scheduledClasses: ClassRecord[];
  /** Scheduled classes whose grace period elapsed without being started ("vencida" pills). */
  expiredClassIds?: Set<string>;
  /** Firebase-mode only: hard-deletes a vencida/completed class's doc. */
  onDeleteClass?: (classId: string) => Promise<void>;
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

const EMPTY_EXPIRED_IDS = new Set<string>();

/**
 * Owns the "Recursos" concern of TeacherDashboard: listing, uploading (with per-file
 * progress), downloading and deleting (single and bulk) a teacher's class files, plus the
 * derived class pills. ResourcesTab only renders what this returns.
 */
export default function useTeacherResources({
  scheduledClasses,
  expiredClassIds = EMPTY_EXPIRED_IDS,
  onDeleteClass,
}: UseTeacherResourcesParams) {
  const { fetchResources, uploadResource, fetchResourceDownloadUrl, deleteResource } = useAppState();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeClassId, setActiveClassId] = useState<string>('');
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const uploadIdRef = useRef(0);
  const deleteDialog = useConfirmDialog<ResourceRecord>();
  const [isDeletingResource, setIsDeletingResource] = useState(false);
  const bulkDeleteDialog = useConfirmDialog();
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

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
      ...scheduledClasses.map(classRecord => ({
        classId: classRecord.id,
        label: classRecord.title,
        cancelled: false,
        expired: expiredClassIds.has(classRecord.id),
        completed: classRecord.status === 'completed',
        scheduledAtMs: classRecord.scheduledAtMs,
      })),
      ...groups
        .filter(group => !scheduledClassIds.has(group.classId))
        .map(group => ({
          classId: group.classId,
          label: group.label,
          cancelled: true,
          expired: false,
          completed: false,
          scheduledAtMs: null as number | null,
        })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scheduledClasses, groups, expiredClassIds]
  );

  // Defaults to the first scheduled class (so a teacher can upload the moment they
  // land here, no dropdown needed) and only falls back to an orphaned/cancelled
  // class's group when there are no scheduled classes at all.
  useEffect(() => {
    if (activeClassId) return;
    if (pillOptions.length > 0) setActiveClassId(pillOptions[0].classId);
  }, [activeClassId, pillOptions]);

  const isAvailable = Boolean(fetchResources && uploadResource && fetchResourceDownloadUrl && deleteResource);

  const activeGroup = groups.find(g => g.classId === activeClassId);
  const activeOption = pillOptions.find(option => option.classId === activeClassId);
  const activeUploadCount = uploadingFiles.filter(u => !u.error).length;
  // A cancelled pill's class doc is already gone — cleanup there can only ever remove
  // its leftover files, so it needs at least one to be worth offering. An expired/
  // completed pill's doc still exists, so cleanup there deletes the class itself (via
  // onDeleteClass) plus any files, and is worth offering even with zero files — that
  // was the whole gap: a completed class with no resources had no way to disappear.
  // A still-upcoming/in-progress class's materials/doc stay untouched, deliberately:
  // wiping them right before or during a real session is too easy to trigger by mistake.
  const canCleanupActive = Boolean(
    activeOption &&
      (activeOption.cancelled
        ? activeGroup && activeGroup.files.length > 0
        : (activeOption.expired || activeOption.completed) && onDeleteClass)
  );

  const handleSelectGroup = (classId: string) => {
    setActiveClassId(classId);
  };

  const handleUploadClick = () => {
    if (!activeClassId) {
      setErrorMessage(t('Selecciona una clase programada antes de subir el archivo.'));
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

    uploadResource!(file, classId, percent => {
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
      setErrorMessage(
        `Puedes subir hasta ${MAX_FILES_PER_UPLOAD} archivos a la vez. Selecciona menos archivos e intenta de nuevo.`
      );
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
    fetchResourceDownloadUrl!(resource.id)
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
    window.open(routePath.resourceViewer(resource.id), '_blank');
  };

  const handleDelete = (resource: ResourceRecord) => {
    deleteDialog.open(resource);
  };

  const confirmDelete = () => {
    if (!deleteDialog.target) return;
    const resource = deleteDialog.target;
    setIsDeletingResource(true);
    deleteResource!(resource.id)
      .then(() => {
        if (isMountedRef.current) setResources(current => current.filter(r => r.id !== resource.id));
      })
      .catch(err => {
        if (isMountedRef.current) setErrorMessage(err.message);
      })
      .finally(() => {
        if (isMountedRef.current) {
          setIsDeletingResource(false);
          deleteDialog.close();
        }
      });
  };

  const handleBulkDeleteClick = () => {
    setBulkDeleteError(null);
    bulkDeleteDialog.open();
  };

  const confirmBulkDelete = () => {
    if (!activeOption) return;
    const filesToDelete = activeGroup?.files || [];
    setIsBulkDeleting(true);

    const deleteFiles =
      filesToDelete.length > 0
        ? Promise.allSettled(filesToDelete.map(file => deleteResource!(file.id).then(() => file.id)))
        : Promise.resolve<PromiseSettledResult<string>[]>([]);

    deleteFiles
      .then(results => {
        if (!isMountedRef.current) return undefined;
        const deletedIds = results
          .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
          .map(result => result.value);
        const failedCount = results.length - deletedIds.length;
        if (deletedIds.length > 0) {
          setResources(current => current.filter(r => !deletedIds.includes(r.id)));
        }
        if (failedCount > 0) {
          setBulkDeleteError(`No pudimos eliminar ${countOf(failedCount, 'recurso')}.`);
        }
        // A cancelled pill's doc is already gone — its files were the only thing left
        // to delete, so it only disappears once every one of them is actually gone; a
        // failed file leaves it (and the file) right where they were. An expired/
        // completed pill's doc is still real, so deleting it is what makes the pill
        // disappear, independent of how its (already attempted) file cleanup went.
        if (activeOption.cancelled) {
          if (deletedIds.length === results.length) setActiveClassId('');
          return undefined;
        }
        if (onDeleteClass) {
          return onDeleteClass(activeOption.classId).then(() => {
            if (isMountedRef.current) setActiveClassId('');
          });
        }
        return undefined;
      })
      .catch(err => {
        if (isMountedRef.current) setBulkDeleteError(err.message || t('No pudimos eliminar la clase.'));
      })
      .finally(() => {
        if (isMountedRef.current) {
          setIsBulkDeleting(false);
          bulkDeleteDialog.close();
        }
      });
  };

  return {
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
    startUpload,
    handleFileSelected,
    handleDownload,
    handleView,
    handleDelete,
    confirmDelete,
    handleBulkDeleteClick,
    confirmBulkDelete,
  };
}
