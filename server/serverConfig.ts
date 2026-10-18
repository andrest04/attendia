import type { AppwriteFileStorageOptions } from './appwriteFileStorage';
import type { FileStorage } from './fileStorage';

/*
 * Composition-root helpers for server/index.ts: every environment variable the server
 * reads is gathered and validated here ONCE at boot, instead of being sprinkled through
 * the route-registration code.
 *
 * Only what the server cannot run without is fatal. Appwrite and Gotenberg stay optional
 * on purpose (a dev machine without them still serves everything else; the affected
 * request fails on its own — see gotenbergDocumentConverter.ts).
 */
export interface AppwriteConfig {
  endpoint?: string;
  projectId?: string;
  apiKey?: string;
  avatarsBucketId?: string;
  resourcesBucketId?: string;
}

export interface ServerConfig {
  port: string | number;
  /** Signs the recording download tickets; the ticket is the only auth on that route. */
  recordingDownloadSecret: string;
  appwrite: AppwriteConfig;
  gotenbergUrl?: string;
  /**
   * How many reverse-proxy hops Express may trust for `req.ip` (X-Forwarded-For), from
   * TRUST_PROXY_HOPS. Unset = trust none (Express default). Set it to 1 behind the Azure
   * Container Apps ingress so the per-IP rate limit keys on the real client.
   */
  trustProxyHops?: number;
}

export class ServerConfigError extends Error {}

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  if (!env.RECORDING_DOWNLOAD_SECRET) {
    throw new ServerConfigError(
      'Missing required environment variable RECORDING_DOWNLOAD_SECRET: it signs the recording download tickets issued by /reports/:roomSid/recording/download-url and verified by /reports/:roomSid/recording/download (window.open cannot send an Authorization header, so this ticket is the only auth for that route).'
    );
  }

  return {
    port: env.PORT ?? 8081,
    recordingDownloadSecret: env.RECORDING_DOWNLOAD_SECRET,
    appwrite: {
      endpoint: env.APPWRITE_ENDPOINT,
      projectId: env.APPWRITE_PROJECT_ID,
      apiKey: env.APPWRITE_API_KEY,
      avatarsBucketId: env.APPWRITE_AVATARS_BUCKET_ID,
      resourcesBucketId: env.APPWRITE_RESOURCES_BUCKET_ID,
    },
    gotenbergUrl: env.GOTENBERG_URL,
    trustProxyHops: parseTrustProxyHops(env.TRUST_PROXY_HOPS),
  };
}

function parseTrustProxyHops(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!/^[0-9]$/.test(value)) {
    throw new ServerConfigError(
      `Invalid TRUST_PROXY_HOPS "${value}": expected the number of reverse-proxy hops in front of the server (0-9, usually 1 behind the Azure ingress), or leave it unset to trust none.`
    );
  }
  return Number(value);
}

/**
 * The two Appwrite buckets: avatars (public-read, so the returned view URL can be used
 * straight in an <img src>) and resources (private — content only leaves through the
 * authenticated server download route). They share endpoint/project/key and differ only
 * in bucket and read permission. The storage factory is injected so this module never
 * loads the Appwrite SDK itself. Missing values pass through unchanged, exactly as
 * before: the failure surfaces on first use, not at boot.
 */
export function createAppwriteBuckets(
  appwrite: AppwriteConfig,
  createStorage: (options: AppwriteFileStorageOptions) => FileStorage
): { avatars: FileStorage; resources: FileStorage } {
  const shared = {
    endpoint: appwrite.endpoint!,
    projectId: appwrite.projectId!,
    apiKey: appwrite.apiKey!,
  };
  return {
    avatars: createStorage({ ...shared, bucketId: appwrite.avatarsBucketId!, publicRead: true }),
    resources: createStorage({ ...shared, bucketId: appwrite.resourcesBucketId!, publicRead: false }),
  };
}
