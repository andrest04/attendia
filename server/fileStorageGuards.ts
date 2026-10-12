import { FileStorage } from './fileStorage';
import { logOperationalFailure } from './operationalEvents';

/**
 * Decorators over the FileStorage port for the two recurring failure policies:
 * "best-effort delete" and "undo the upload if the metadata write fails afterwards".
 */
export interface StorageFailureContext {
  event: string;
  operation: string;
  uid: string;
}

/**
 * Fire-and-forget delete: a storage failure must never fail the request that triggered
 * it, but it still has to surface as an operational event.
 */
export function deleteQuietly(storage: FileStorage, fileId: string, failure: StorageFailureContext): void {
  storage.delete(fileId).catch(error => logOperationalFailure({ ...failure, error }));
}

export interface UploadTracker {
  /** Registers a freshly uploaded file that is not yet referenced by any document. */
  track(fileId: string): void;
  /** The document now references the file; nothing needs undoing any more. */
  commit(): void;
}

/**
 * Runs `work`; if it throws while a tracked upload is still uncommitted, the orphaned
 * file is deleted (quietly) before the original error is rethrown to the caller.
 */
export async function withUploadCompensation<T>(
  storage: FileStorage,
  cleanupFailure: StorageFailureContext,
  work: (tracker: UploadTracker) => Promise<T>
): Promise<T> {
  let pendingFileId: string | undefined;
  try {
    return await work({
      track: fileId => {
        pendingFileId = fileId;
      },
      commit: () => {
        pendingFileId = undefined;
      },
    });
  } catch (error) {
    if (pendingFileId) deleteQuietly(storage, pendingFileId, cleanupFailure);
    throw error;
  }
}
