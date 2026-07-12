/*
 * Storage-agnostic port used by userProfiles.ts (avatars) and resources.ts (class
 * materials). No file outside appwriteFileStorage.ts may import an Appwrite SDK —
 * everything else programs against this interface so the storage backend can be
 * swapped (or faked in tests) without touching handler code.
 */

export interface UploadedFilePayload {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}

export interface StoredFile {
  fileId: string;
  // '' when the bucket is private (no public URL exists) — see appwriteFileStorage.ts.
  url: string;
}

export interface FileStorage {
  upload(file: UploadedFilePayload): Promise<StoredFile>;
  download(fileId: string): Promise<Buffer>;
  delete(fileId: string): Promise<void>;
}
