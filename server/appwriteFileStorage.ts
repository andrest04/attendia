import { Client, ID, Permission, Role, Storage } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { FileStorage, StoredFile, UploadedFilePayload } from './fileStorage';

/*
 * The ONLY file in this codebase allowed to import node-appwrite. Everything else
 * (userProfiles.ts, resources.ts, index.ts) programs against the storage-agnostic
 * FileStorage port in fileStorage.ts, so swapping storage backends — or faking one in
 * tests — never touches handler code.
 *
 * Two buckets are wired up in index.ts from this one factory: the avatars bucket
 * (publicRead: true — uploads get Permission.read(Role.any()) and the returned url is
 * a direct Appwrite "view" URL usable straight in an <img src>) and the resources
 * bucket (publicRead: false — no bucket permissions are granted, so `url` is always ''
 * and the only way to read a file back is server-side via download()).
 */

export interface AppwriteFileStorageOptions {
  endpoint: string;
  projectId: string;
  apiKey: string;
  bucketId: string;
  publicRead: boolean;
}

export function createAppwriteFileStorage(options: AppwriteFileStorageOptions): FileStorage {
  const client = new Client()
    .setEndpoint(options.endpoint)
    .setProject(options.projectId)
    .setKey(options.apiKey);
  const storage = new Storage(client);

  return {
    async upload({ buffer, fileName }: UploadedFilePayload): Promise<StoredFile> {
      const fileId = ID.unique();
      const permissions = options.publicRead ? [Permission.read(Role.any())] : undefined;

      await storage.createFile({
        bucketId: options.bucketId,
        fileId,
        file: InputFile.fromBuffer(buffer, fileName),
        permissions,
      });

      const url = options.publicRead
        ? `${options.endpoint}/storage/buckets/${options.bucketId}/files/${fileId}/view?project=${options.projectId}`
        : '';

      return { fileId, url };
    },

    async download(fileId: string): Promise<Buffer> {
      const result = await storage.getFileDownload({ bucketId: options.bucketId, fileId });
      return Buffer.from(result);
    },

    async delete(fileId: string): Promise<void> {
      await storage.deleteFile({ bucketId: options.bucketId, fileId });
    },
  };
}
