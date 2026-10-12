import { createAppwriteBuckets, loadServerConfig, ServerConfigError } from '../serverConfig';

describe('loadServerConfig', () => {
  it('requires the recording download secret (it is the only auth on the download route)', () => {
    expect(() => loadServerConfig({})).toThrow(ServerConfigError);
    expect(() => loadServerConfig({})).toThrow(/RECORDING_DOWNLOAD_SECRET/);
  });

  it('gathers the environment once and keeps Appwrite and Gotenberg optional', () => {
    expect(loadServerConfig({ RECORDING_DOWNLOAD_SECRET: 'secret' })).toEqual({
      port: 8081,
      recordingDownloadSecret: 'secret',
      appwrite: {
        endpoint: undefined,
        projectId: undefined,
        apiKey: undefined,
        avatarsBucketId: undefined,
        resourcesBucketId: undefined,
      },
      gotenbergUrl: undefined,
    });
  });

  it('reads PORT, Appwrite and Gotenberg settings when present', () => {
    const config = loadServerConfig({
      RECORDING_DOWNLOAD_SECRET: 'secret',
      PORT: '9000',
      APPWRITE_ENDPOINT: 'https://appwrite.test/v1',
      APPWRITE_PROJECT_ID: 'project',
      APPWRITE_API_KEY: 'key',
      APPWRITE_AVATARS_BUCKET_ID: 'avatars',
      APPWRITE_RESOURCES_BUCKET_ID: 'resources',
      GOTENBERG_URL: 'http://gotenberg.test',
    });

    expect(config.port).toBe('9000');
    expect(config.gotenbergUrl).toBe('http://gotenberg.test');
    expect(config.appwrite.avatarsBucketId).toBe('avatars');
  });
});

describe('createAppwriteBuckets', () => {
  it('builds a public-read avatars bucket and a private resources bucket from shared credentials', () => {
    const createStorage = jest.fn((options: any) => ({ options } as any));

    const buckets = createAppwriteBuckets(
      {
        endpoint: 'https://appwrite.test/v1',
        projectId: 'project',
        apiKey: 'key',
        avatarsBucketId: 'avatars',
        resourcesBucketId: 'resources',
      },
      createStorage
    );

    expect(createStorage).toHaveBeenCalledTimes(2);
    expect(buckets.avatars).toEqual({
      options: {
        endpoint: 'https://appwrite.test/v1',
        projectId: 'project',
        apiKey: 'key',
        bucketId: 'avatars',
        publicRead: true,
      },
    });
    expect(buckets.resources).toEqual({
      options: {
        endpoint: 'https://appwrite.test/v1',
        projectId: 'project',
        apiKey: 'key',
        bucketId: 'resources',
        publicRead: false,
      },
    });
  });
});
