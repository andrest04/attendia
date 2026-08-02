import {
  createReconcileNotificationsHandler,
  deriveClassNotification,
  deriveRecordingNotification,
  deriveReportNotification,
} from '../notificationReconciliation';
import { readFileSync } from 'fs';
import { canonicalNotificationId } from '../notifications';

const timestamp = (ms: number) => ({ toMillis: () => ms });

describe('pure recording notification derivation', () => {
  it.each([
    ['completed', 'recording.ready', 'ready'],
    ['failed', 'recording.failed', 'failed'],
  ])('derives a trusted manual %s outcome', (status, eventType, suffix) => {
    const statusChangedAt = timestamp(1000);
    const result = deriveRecordingNotification({
      roomSid: 'RM00000000000000000000000000000abc',
      manualRequestId: 'manual_request_1234',
      status,
      statusChangedAt,
      clientObservedAtMs: 999999,
    });

    expect(result).toEqual(expect.objectContaining({
      eventType,
      eventKey: `recording:manual_request_1234:${suffix}`,
      source: {
        kind: 'recording',
        roomSid: 'RM00000000000000000000000000000abc',
        manualRequestId: 'manual_request_1234',
      },
      eventOccurrenceAt: statusChangedAt,
      destination: { kind: 'recording', roomSid: 'RM00000000000000000000000000000abc' },
    }));
    expect(result!.eventOccurrenceAt).not.toBe(999999);
  });

  it('excludes non-manual, non-terminal, expired, and malformed outcomes', () => {
    const base = {
      roomSid: 'RM00000000000000000000000000000abc',
      manualRequestId: 'manual_request_1234',
      statusChangedAt: timestamp(1000),
    };

    expect(deriveRecordingNotification({ ...base, manualRequestId: undefined, status: 'completed' })).toBeNull();
    expect(deriveRecordingNotification({ ...base, status: 'processing' })).toBeNull();
    expect(deriveRecordingNotification({ ...base, status: 'expired' })).toBeNull();
    expect(deriveRecordingNotification({ ...base, status: 'completed', statusChangedAt: 999999 })).toBeNull();
  });

  it('keeps the immutable persisted occurrence time across repeated polling', () => {
    const persisted = timestamp(2000);
    const first = deriveRecordingNotification({
      roomSid: 'RM00000000000000000000000000000abc',
      manualRequestId: 'manual_request_1234',
      status: 'completed',
      statusChangedAt: persisted,
    });
    const repeated = deriveRecordingNotification({
      roomSid: 'RM00000000000000000000000000000abc',
      manualRequestId: 'manual_request_1234',
      status: 'completed',
      statusChangedAt: persisted,
      clientObservedAtMs: 8000,
    });

    expect(first!.eventOccurrenceAt).toBe(persisted);
    expect(repeated!.eventOccurrenceAt).toBe(persisted);
    expect(repeated!.eventKey).toBe(first!.eventKey);
  });
});

describe('pure report failure notification derivation', () => {
  it('derives one unresolved episode from its server-owned observedAt', () => {
    const observedAt = timestamp(3000);
    const result = deriveReportNotification({
      reportId: 'RM00000000000000000000000000000abc',
      failureEpisodeId: 'episode_12345678',
      status: 'unresolved',
      observedAt,
      firstFailedAtMs: 999999,
    });

    expect(result).toEqual({
      candidate: expect.objectContaining({
        eventType: 'report.save_failed',
        eventKey: 'report:RM00000000000000000000000000000abc:save-failed:episode_12345678',
        source: {
          kind: 'report',
          reportId: 'RM00000000000000000000000000000abc',
          failureEpisodeId: 'episode_12345678',
        },
        eventOccurrenceAt: observedAt,
        destination: { kind: 'report-retry', reportId: 'RM00000000000000000000000000000abc' },
      }),
    });
    expect(result.candidate!.eventOccurrenceAt).not.toBe(999999);
  });

  it('returns removal-only intent after recovery and never creates success', () => {
    expect(deriveReportNotification({
      reportId: 'RM00000000000000000000000000000abc',
      failureEpisodeId: 'episode_12345678',
      status: 'resolved',
      observedAt: timestamp(3000),
    })).toEqual({
      removeEventKey: 'report:RM00000000000000000000000000000abc:save-failed:episode_12345678',
    });
  });

  it('rejects unsupported status, malformed identity, and untrusted occurrence data', () => {
    const base = {
      reportId: 'RM00000000000000000000000000000abc',
      failureEpisodeId: 'episode_12345678',
      observedAt: timestamp(3000),
    };

    expect(deriveReportNotification({ ...base, status: 'success' })).toEqual({});
    expect(deriveReportNotification({ ...base, status: 'unresolved', failureEpisodeId: '../bad' })).toEqual({});
    expect(deriveReportNotification({ ...base, status: 'unresolved', observedAt: 3000 })).toEqual({});
  });
});

describe('pure class notification derivation', () => {
  const scheduledAt = timestamp(1_000_000);
  const source = { classId: 'class_occurrence_1', status: 'scheduled', scheduledAt };

  it('uses exact trusted T-15 and T+15 occurrence times with late-wake precedence', () => {
    expect(deriveClassNotification(source, 99_999)).toEqual({});
    expect(deriveClassNotification(source, 100_000)).toEqual({
      candidate: expect.objectContaining({
        eventType: 'class.upcoming', eventKey: 'class:class_occurrence_1:upcoming',
        eventOccurrenceAt: new Date(100_000),
      }),
    });
    expect(deriveClassNotification(source, 1_899_999).candidate!.eventType).toBe('class.upcoming');
    expect(deriveClassNotification(source, 1_900_000)).toEqual({
      removeEventKey: 'class:class_occurrence_1:upcoming',
      candidate: expect.objectContaining({
        eventType: 'class.not_started', eventKey: 'class:class_occurrence_1:not-started',
        eventOccurrenceAt: new Date(1_900_000),
      }),
    });
  });

  it('excludes malformed, started, completed, and tombstoned occurrences', () => {
    expect(deriveClassNotification({ ...source, scheduledAt: 1_000_000 }, 1_900_000)).toEqual({});
    expect(deriveClassNotification({ ...source, status: 'started' }, 1_900_000)).toEqual({});
    expect(deriveClassNotification({ ...source, status: 'completed' }, 1_900_000)).toEqual({});
    expect(deriveClassNotification({ ...source, tombstoned: true }, 1_900_000)).toEqual({
      removeEventKey: 'class:class_occurrence_1:upcoming',
    });
  });

  it('names the class in the upcoming and not-started copy when a title is present, and falls back without one', () => {
    const named = deriveClassNotification({ ...source, title: 'Álgebra II' }, 100_000);
    expect(named.candidate).toEqual(expect.objectContaining({
      title: 'Clase próxima: Álgebra II',
      message: 'Tu clase "Álgebra II" comienza en 15 minutos.',
    }));

    const namedMissed = deriveClassNotification({ ...source, title: '  Álgebra II  ' }, 1_900_000);
    expect(namedMissed.candidate).toEqual(expect.objectContaining({
      title: 'Clase no iniciada: Álgebra II',
      message: 'Tu clase "Álgebra II" programada todavía no fue iniciada.',
    }));

    expect(deriveClassNotification(source, 100_000).candidate).toEqual(expect.objectContaining({
      title: 'Clase próxima',
      message: 'Tu clase comienza en 15 minutos.',
    }));
  });
});

describe('POST /notifications/reconcile transaction', () => {
  it('wires only the authenticated POST reconcile route', () => {
    const source = readFileSync(require.resolve('../index'), 'utf8').replace(/\r\n/g, '\n');
    expect(source).toContain("app.post(\n  '/notifications/reconcile',\n  authMiddleware,");
  });

  it('declares the bounded upcoming-sweep query index', () => {
    const indexes = readFileSync(require.resolve('../../firestore.indexes.json'), 'utf8')
      .replace(/\s/g, '');
    expect(indexes).toContain([
      '{"collectionGroup":"items","queryScope":"COLLECTION","fields":[',
      '{"fieldPath":"eventType","order":"ASCENDING"},',
      '{"fieldPath":"notificationId","order":"ASCENDING"}',
      ']}',
    ].join(''));
  });

  const makeRes = () => {
    const res: any = { locals: { firebaseUser: { uid: 'teacher-1' } } };
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    res.send = jest.fn(() => res);
    return res;
  };

  const makeDb = () => {
    const values = new Map<string, any>();
    const operations: string[] = [];
    const snapshot = (path: string) => ({
      exists: values.has(path), id: path.split('/').pop(), ref: ref(path), data: () => values.get(path),
    });
    const ref = (path: string): any => ({
      path, id: path.split('/').pop(), get: async () => snapshot(path),
      collection: (name: string) => collection(`${path}/${name}`),
    });
    const querySnapshot = (path: string, options: any) => {
      let docs = Array.from(values.keys())
        .filter(key => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/'))
        .map(snapshot);
      if (options.where) docs = docs.filter(doc => doc.data()![options.where[0]] === options.where[2]);
      if (options.orderBy) docs.sort((left, right) => String(left.data()![options.orderBy])
        .localeCompare(String(right.data()![options.orderBy])));
      if (options.startAfter !== undefined) docs = docs.filter(doc =>
        String(doc.data()![options.orderBy]) > String(options.startAfter));
      if (options.limit !== undefined) docs = docs.slice(0, options.limit);
      return { docs };
    };
    const query = (path: string, options: any = {}): any => ({
      _queryPath: path, _options: options,
      where: (field: string, operator: string, value: unknown) =>
        query(path, { ...options, where: [field, operator, value] }),
      orderBy: (field: string) => query(path, { ...options, orderBy: field }),
      startAfter: (value: unknown) => query(path, { ...options, startAfter: value }),
      limit: (value: number) => query(path, { ...options, limit: value }),
      get: async () => querySnapshot(path, options),
    });
    const collection = (path: string): any => ({
      ...query(path), doc: (id: string) => ref(`${path}/${id}`),
      get: async () => querySnapshot(path, {}),
    });
    const transaction: any = {
      get: jest.fn(async (document: any) => {
        if (document._queryPath) {
          operations.push(`read-query:${document._queryPath}`);
          return querySnapshot(document._queryPath, document._options);
        }
        operations.push(`read:${document.path}`);
        return snapshot(document.path);
      }),
      create: jest.fn((document: any, value: any) => {
        operations.push(`write:${document.path}`);
        if (values.has(document.path)) throw new Error('already exists');
        values.set(document.path, value);
      }),
      update: jest.fn((document: any, value: any) => {
        operations.push(`write:${document.path}`);
        values.set(document.path, { ...values.get(document.path), ...value });
      }),
      delete: jest.fn((document: any) => {
        operations.push(`write:${document.path}`);
        values.delete(document.path);
      }),
    };
    let tail = Promise.resolve();
    const db: any = {
      collection: (name: string) => collection(name),
      runTransaction: (work: any) => {
        const result = tail.then(() => work(transaction));
        tail = result.then(() => undefined, () => undefined);
        return result;
      },
    };
    return { db, values, operations, transaction };
  };

  const seed = (f: ReturnType<typeof makeDb>, clearBefore: number | null = null) => {
    f.values.set('users/teacher-1', { role: 'teacher' });
    f.values.set('users/teacher-1/notificationState/inbox', {
      currentGeneration: 2, unreadCount: 1, readBefore: timestamp(150),
      clearBefore: clearBefore === null ? null : timestamp(clearBefore),
    });
    f.values.set('users/teacher-1/reports/RM00000000000000000000000000000abc', {});
    f.values.set(
      'users/teacher-1/reports/RM00000000000000000000000000000abc/recordingRequests/manual_request_1234',
      {
        manualRequestId: 'manual_request_1234', status: 'completed',
        statusChangedAt: timestamp(200), clientObservedAtMs: 999999,
      }
    );
    f.values.set('users/teacher-1/reportFailureEpisodes/episode_12345678', {
      reportId: 'RM00000000000000000000000000000abc', failureEpisodeId: 'episode_12345678',
      status: 'unresolved', observedAt: timestamp(300), firstFailedAtMs: 999999,
    });
  };

  it('authorizes the trusted UID, reads every source/item before writes, and converges retries', async () => {
    const f = makeDb();
    seed(f);
    const maintenance = jest.fn(async () => undefined);
    const handler = createReconcileNotificationsHandler(f.db, () => timestamp(600), maintenance);
    const first = makeRes();
    const retry = makeRes();

    await handler({ body: { scope: 'all', uid: 'other', now: 999999 } } as any, first, jest.fn());
    const firstWrite = f.operations.findIndex(value => value.startsWith('write:'));
    expect(f.operations.slice(firstWrite + 1).some(value => value.startsWith('read:'))).toBe(false);
    expect(first.json).toHaveBeenCalledWith({ unreadCount: 3, changed: true });

    f.operations.length = 0;
    await handler({ body: { scope: 'all' } } as any, retry, jest.fn());
    expect(retry.json).toHaveBeenCalledWith({ unreadCount: 3, changed: false });
    expect(maintenance.mock.calls).toEqual([['teacher-1'], ['teacher-1']]);
    expect(f.values.has(`users/teacher-1/notificationGenerations/2/items/${canonicalNotificationId(
      'recording.ready', 'recording:manual_request_1234:ready'
    )}`)).toBe(true);
  });

  it('refreshes a pending manual request from the provider and creates its terminal notification in the same poll', async () => {
    const f = makeDb();
    seed(f);
    const requestPath = 'users/teacher-1/reports/RM00000000000000000000000000000abc/recordingRequests/manual_request_1234';
    f.values.set(requestPath, {
      manualRequestId: 'manual_request_1234', compositionSid: 'CJ00000000000000000000000000000abc', status: 'processing',
    });
    const refreshRecording = jest.fn(async (_uid, _roomSid, _manualRequestId) => {
      f.values.set(requestPath, {
        ...f.values.get(requestPath), status: 'completed', statusChangedAt: timestamp(700),
      });
    });
    const res = makeRes();

    await createReconcileNotificationsHandler(
      f.db, () => timestamp(600), async () => undefined, () => 800, refreshRecording
    )({ body: { scope: 'recordings' } } as any, res, jest.fn());

    expect(refreshRecording).toHaveBeenCalledWith(
      'teacher-1', 'RM00000000000000000000000000000abc', 'manual_request_1234'
    );
    expect(res.json).toHaveBeenCalledWith({ unreadCount: 2, changed: true });
    const readyId = canonicalNotificationId('recording.ready', 'recording:manual_request_1234:ready');
    const ready = f.values.get(`users/teacher-1/notificationGenerations/2/items/${readyId}`);
    expect(ready.eventType).toBe('recording.ready');
    expect(ready.eventOccurrenceAt.toMillis()).toBe(700);
  });

  it('isolates a failing provider refresh from the rest of reconciliation without trusting stale state, and converges overlapping retries idempotently', async () => {
    const failed = makeDb();
    seed(failed);
    const requestPath = 'users/teacher-1/reports/RM00000000000000000000000000000abc/recordingRequests/manual_request_1234';
    failed.values.set(requestPath, {
      manualRequestId: 'manual_request_1234', compositionSid: 'CJ00000000000000000000000000000abc', status: 'enqueued',
    });
    const providerFailure = jest.fn(async () => { throw new Error('provider unavailable'); });
    const failedRes = makeRes();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await createReconcileNotificationsHandler(
      failed.db, () => timestamp(600), async () => undefined, Date.now, providerFailure
    )({ body: { scope: 'recordings' } } as any, failedRes, jest.fn());

    // A single recording's provider fetch failing is isolated: the request keeps
    // its pre-refresh (still-pending) status, so reconciliation produces no
    // notification for it this pass, but the endpoint still succeeds instead of
    // failing the whole poll — the failure is logged, not propagated.
    expect(failedRes.status).toHaveBeenCalledWith(200);
    expect(failedRes.json).toHaveBeenCalledWith({ unreadCount: 1, changed: false });
    expect(Array.from(failed.values.values()).some(value => value.eventType === 'recording.ready')).toBe(false);
    expect(Array.from(failed.values.values()).some(value => value.eventType === 'recording.failed')).toBe(false);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('notification_recording_refresh_failed'));
    consoleError.mockRestore();

    const overlapping = makeDb();
    seed(overlapping);
    overlapping.values.set(requestPath, {
      manualRequestId: 'manual_request_1234', compositionSid: 'CJ00000000000000000000000000000abc', status: 'processing',
    });
    const refresh = jest.fn(async () => {
      overlapping.values.set(requestPath, {
        ...overlapping.values.get(requestPath), status: 'failed', statusChangedAt: timestamp(900),
      });
    });
    const handler = createReconcileNotificationsHandler(
      overlapping.db, () => timestamp(600), async () => undefined, Date.now, refresh
    );
    const first = makeRes();
    const second = makeRes();
    await Promise.all([
      handler({ body: { scope: 'recordings' } } as any, first, jest.fn()),
      handler({ body: { scope: 'recordings' } } as any, second, jest.fn()),
    ]);

    expect([first.json.mock.calls[0][0], second.json.mock.calls[0][0]]).toEqual(expect.arrayContaining([
      { unreadCount: 2, changed: true }, { unreadCount: 2, changed: false },
    ]));
    expect(Array.from(overlapping.values.values()).filter(value => value.eventType === 'recording.failed')).toHaveLength(1);

    const confirmedRefresh = jest.fn(async () => undefined);
    await createReconcileNotificationsHandler(
      overlapping.db, () => timestamp(600), async () => undefined, Date.now, confirmedRefresh
    )({ body: { scope: 'recordings' } } as any, makeRes(), jest.fn());
    expect(confirmedRefresh).not.toHaveBeenCalled();
  });

  it('still reconciles unrelated report sources in the same poll when one recording provider refresh fails', async () => {
    const f = makeDb();
    seed(f);
    const requestPath = 'users/teacher-1/reports/RM00000000000000000000000000000abc/recordingRequests/manual_request_1234';
    f.values.set(requestPath, {
      manualRequestId: 'manual_request_1234', compositionSid: 'CJ00000000000000000000000000000abc', status: 'enqueued',
    });
    const providerFailure = jest.fn(async () => { throw new Error('provider unavailable'); });
    const res = makeRes();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await createReconcileNotificationsHandler(
      f.db, () => timestamp(600), async () => undefined, Date.now, providerFailure
    )({ body: { scope: 'all' } } as any, res, jest.fn());

    expect(providerFailure).toHaveBeenCalled();
    // The failing recording refresh must not have prevented the unresolved report
    // failure episode (from seed()) from still being reconciled into a notification.
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ unreadCount: 2, changed: true });
    const reportId = canonicalNotificationId(
      'report.save_failed', 'report:RM00000000000000000000000000000abc:save-failed:episode_12345678'
    );
    expect(f.values.has(`users/teacher-1/notificationGenerations/2/items/${reportId}`)).toBe(true);
    expect(Array.from(f.values.values()).some(value => value.eventType === 'recording.ready')).toBe(false);
    consoleError.mockRestore();
  });

  it('creates inbox metadata on a first wake without prior notification operations', async () => {
    const f = makeDb();
    seed(f);
    f.values.delete('users/teacher-1/notificationState/inbox');
    const res = makeRes();

    await createReconcileNotificationsHandler(f.db, () => timestamp(600))(
      { body: { scope: 'all' } } as any, res, jest.fn()
    );

    expect(res.json).toHaveBeenCalledWith({ unreadCount: 2, changed: true });
    expect(f.values.get('users/teacher-1/notificationState/inbox')).toEqual(expect.objectContaining({
      currentGeneration: 0, unreadCount: 2,
    }));
  });

  it('suppresses cleared outcomes and removes recovered reports without decrementing effective-read items', async () => {
    const f = makeDb();
    seed(f, 250);
    const reportKey = 'report:RM00000000000000000000000000000abc:save-failed:episode_12345678';
    const reportId = canonicalNotificationId('report.save_failed', reportKey);
    f.values.set(`users/teacher-1/notificationGenerations/2/items/${reportId}`, {
      notificationId: reportId, ownerUid: 'teacher-1', eventType: 'report.save_failed', eventKey: reportKey,
      createdAt: timestamp(100), readAt: null,
    });
    f.values.get('users/teacher-1/reportFailureEpisodes/episode_12345678').status = 'resolved';
    const res = makeRes();

    await createReconcileNotificationsHandler(f.db, () => timestamp(600))(
      { body: { scope: 'all' } } as any, res, jest.fn()
    );

    expect(res.json).toHaveBeenCalledWith({ unreadCount: 1, changed: true });
    expect(f.values.has(`users/teacher-1/notificationGenerations/2/items/${reportId}`)).toBe(false);
    expect(Array.from(f.values.values()).some(value => value.eventType === 'recording.ready')).toBe(false);
  });

  it('atomically replaces upcoming with not-started and preserves exact effective unread count', async () => {
    const f = makeDb();
    seed(f);
    f.values.clear();
    f.values.set('users/teacher-1', { role: 'teacher' });
    f.values.set('users/teacher-1/notificationState/inbox', {
      currentGeneration: 2, unreadCount: 0, readBefore: timestamp(550), clearBefore: null,
    });
    f.values.set('users/teacher-1/classes/class_occurrence_1', {
      status: 'scheduled', scheduledAt: timestamp(1_000_000),
    });
    const upcomingKey = 'class:class_occurrence_1:upcoming';
    const upcomingId = canonicalNotificationId('class.upcoming', upcomingKey);
    f.values.set(`users/teacher-1/notificationGenerations/2/items/${upcomingId}`, {
      eventType: 'class.upcoming', eventKey: upcomingKey, createdAt: timestamp(500), readAt: null,
    });
    const res = makeRes();

    await createReconcileNotificationsHandler(f.db, () => timestamp(2_000_000), async () => undefined, () => 1_900_000)(
      { body: { scope: 'all' } } as any, res, jest.fn()
    );

    expect(res.json).toHaveBeenCalledWith({ unreadCount: 1, changed: true });
    expect(f.values.has(`users/teacher-1/notificationGenerations/2/items/${upcomingId}`)).toBe(false);
    const missedId = canonicalNotificationId('class.not_started', 'class:class_occurrence_1:not-started');
    expect(f.values.get(`users/teacher-1/notificationGenerations/2/items/${missedId}`)).toEqual(expect.objectContaining({
      eventType: 'class.not_started', eventOccurrenceAt: new Date(1_900_000), readAt: null,
    }));
    const firstWrite = f.operations.findIndex(value => value.startsWith('write:'));
    expect(f.operations.slice(firstWrite + 1).some(value => value.startsWith('read:'))).toBe(false);
  });

  it('allows a threshold after clear, suppresses one before clear, and converges retries', async () => {
    const fixture = (clearBefore: number) => {
      const f = makeDb();
      f.values.set('users/teacher-1', { role: 'teacher' });
      f.values.set('users/teacher-1/notificationState/inbox', {
        currentGeneration: 2, unreadCount: 0, readBefore: null, clearBefore: timestamp(clearBefore),
      });
      f.values.set('users/teacher-1/classes/class_occurrence_1', {
        status: 'scheduled', scheduledAt: timestamp(1_000_000),
      });
      return f;
    };
    const before = fixture(150_000);
    const handler = createReconcileNotificationsHandler(
      before.db, () => timestamp(2_000_000), async () => undefined, () => 2_500_000
    );
    const first = makeRes();
    const retry = makeRes();
    await handler({ body: { scope: 'all' } } as any, first, jest.fn());
    await handler({ body: { scope: 'all' } } as any, retry, jest.fn());
    expect(first.json).toHaveBeenCalledWith({ unreadCount: 1, changed: true });
    expect(retry.json).toHaveBeenCalledWith({ unreadCount: 1, changed: false });

    const after = fixture(1_900_000);
    const suppressed = makeRes();
    await createReconcileNotificationsHandler(
      after.db, () => timestamp(2_000_000), async () => undefined, () => 2_500_000
    )({ body: { scope: 'all' } } as any, suppressed, jest.fn());
    expect(suppressed.json).toHaveBeenCalledWith({ unreadCount: 0, changed: false });
    expect(Array.from(after.values.values()).some(value => value.eventType === 'class.not_started')).toBe(false);
  });

  it('re-reads tombstones and excludes started sources without producing missed outcomes', async () => {
    const tombstoned = makeDb();
    tombstoned.values.set('users/teacher-1', { role: 'teacher' });
    tombstoned.values.set('users/teacher-1/notificationState/inbox', {
      currentGeneration: 2, unreadCount: 1, readBefore: null, clearBefore: null,
    });
    tombstoned.values.set('users/teacher-1/classes/class_occurrence_1', {
      status: 'scheduled', scheduledAt: timestamp(1_000_000),
    });
    tombstoned.values.set('users/teacher-1/classOccurrenceTombstones/class_occurrence_1', { canceledAt: timestamp(50) });
    const upcomingKey = 'class:class_occurrence_1:upcoming';
    const upcomingId = canonicalNotificationId('class.upcoming', upcomingKey);
    tombstoned.values.set(`users/teacher-1/notificationGenerations/2/items/${upcomingId}`, {
      eventKey: upcomingKey, createdAt: timestamp(500), readAt: null,
    });
    const removed = makeRes();
    await createReconcileNotificationsHandler(
      tombstoned.db, () => timestamp(2_000_000), async () => undefined, () => 2_500_000
    )({ body: { scope: 'all' } } as any, removed, jest.fn());
    expect(removed.json).toHaveBeenCalledWith({ unreadCount: 0, changed: true });

    const started = makeDb();
    started.values.set('users/teacher-1', { role: 'teacher' });
    started.values.set('users/teacher-1/classes/class_occurrence_2', {
      status: 'started', scheduledAt: timestamp(1_000_000),
    });
    const excluded = makeRes();
    await createReconcileNotificationsHandler(
      started.db, () => timestamp(2_000_000), async () => undefined, () => 2_500_000
    )({ body: { scope: 'all' } } as any, excluded, jest.fn());
    expect(excluded.json).toHaveBeenCalledWith({ unreadCount: 0, changed: false });
    expect(Array.from(started.values.values()).some(value => value.eventType === 'class.not_started')).toBe(false);
  });

  it('sweeps missing and tombstoned reminders with exact effective-unread accounting', async () => {
    const f = makeDb();
    f.values.set('users/teacher-1', { role: 'teacher' });
    f.values.set('users/teacher-1/notificationState/inbox', {
      currentGeneration: 2, unreadCount: 2, readBefore: timestamp(150), clearBefore: null,
      classSweepAfter: null,
    });
    const itemsPath = 'users/teacher-1/notificationGenerations/2/items';
    const seedUpcoming = (id: string, classId: string, createdAt: number, readAt: any = null) =>
      f.values.set(`${itemsPath}/${id}`, {
        notificationId: id, eventType: 'class.upcoming', source: { kind: 'class', classId },
        createdAt: timestamp(createdAt), readAt,
      });
    seedUpcoming('item-01', 'missing_class', 200);
    seedUpcoming('item-02', 'canceled_class', 200);
    seedUpcoming('item-03', 'explicitly_read', 200, timestamp(250));
    seedUpcoming('item-04', 'effectively_read', 100);
    seedUpcoming('item-05', 'valid_class', 200);
    f.values.set('users/teacher-1/classes/canceled_class', {
      status: 'scheduled', scheduledAt: timestamp(1_000_000),
    });
    f.values.set('users/teacher-1/classOccurrenceTombstones/canceled_class', { canceledAt: timestamp(300) });
    f.values.set('users/teacher-1/classes/valid_class', {
      status: 'scheduled', scheduledAt: timestamp(9_000_000),
    });
    const res = makeRes();

    await createReconcileNotificationsHandler(
      f.db, () => timestamp(600), async () => undefined, () => 0
    )({ body: { scope: 'all' } } as any, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({ unreadCount: 0, changed: true });
    expect(Array.from(f.values.keys()).filter(key => key.startsWith(`${itemsPath}/`))).toEqual([
      `${itemsPath}/item-05`,
    ]);
    expect(f.values.get('users/teacher-1/notificationState/inbox').classSweepAfter).toBeNull();
    const firstWrite = f.operations.findIndex(value => value.startsWith('write:'));
    expect(f.operations.slice(firstWrite + 1).some(value => value.startsWith('read'))).toBe(false);

    const retry = makeRes();
    await createReconcileNotificationsHandler(
      f.db, () => timestamp(600), async () => undefined, () => 0
    )({ body: { scope: 'all' } } as any, retry, jest.fn());
    expect(retry.json).toHaveBeenCalledWith({ unreadCount: 0, changed: false });
  });

  it('continues bounded sweeps across devices and resets after a scale-to-zero retry', async () => {
    const f = makeDb();
    f.values.set('users/teacher-1', { role: 'teacher' });
    f.values.set('users/teacher-1/notificationState/inbox', {
      currentGeneration: 2, unreadCount: 12, readBefore: null, clearBefore: null,
      classSweepAfter: null,
    });
    const itemsPath = 'users/teacher-1/notificationGenerations/2/items';
    for (let index = 0; index < 12; index++) {
      const id = `item-${String(index).padStart(2, '0')}`;
      f.values.set(`${itemsPath}/${id}`, {
        notificationId: id, eventType: 'class.upcoming',
        source: { kind: 'class', classId: `missing_${String(index).padStart(2, '0')}` },
        createdAt: timestamp(200), readAt: null,
      });
    }
    const handler = createReconcileNotificationsHandler(f.db, () => timestamp(600));
    const first = makeRes();
    const secondDevice = makeRes();

    await handler({ body: { scope: 'all' } } as any, first, jest.fn());
    expect(first.json).toHaveBeenCalledWith({ unreadCount: 2, changed: true });
    expect(f.values.get('users/teacher-1/notificationState/inbox').classSweepAfter).toBe('item-09');
    expect(Array.from(f.values.keys()).filter(key => key.startsWith(`${itemsPath}/`))).toHaveLength(2);

    await handler({ body: { scope: 'all' } } as any, secondDevice, jest.fn());
    expect(secondDevice.json).toHaveBeenCalledWith({ unreadCount: 0, changed: true });
    expect(f.values.get('users/teacher-1/notificationState/inbox').classSweepAfter).toBeNull();
    expect(Array.from(f.values.keys()).some(key => key.startsWith(`${itemsPath}/`))).toBe(false);

    const retry = makeRes();
    await handler({ body: { scope: 'all' } } as any, retry, jest.fn());
    expect(retry.json).toHaveBeenCalledWith({ unreadCount: 0, changed: false });
  });

  it('rejects unsupported scope, malformed claims, and non-teachers before reconciliation', async () => {
    const f = makeDb();
    seed(f);
    const handler = createReconcileNotificationsHandler(f.db, () => timestamp(600));
    const unsupported = makeRes();
    await handler({ body: { scope: 'classes' } } as any, unsupported, jest.fn());
    expect(unsupported.status).toHaveBeenCalledWith(400);

    const malformed = makeRes();
    await handler({ body: { scope: 'all', pendingReportFailures: [{ reportId: 'bad' }] } } as any, malformed, jest.fn());
    expect(malformed.status).toHaveBeenCalledWith(400);
    const oversized = makeRes();
    const claim = {
      reportId: 'RM00000000000000000000000000000abc', failureEpisodeId: 'episode_12345678', firstFailedAtMs: 1,
    };
    await handler({ body: { scope: 'all', pendingReportFailures: Array(26).fill(claim) } } as any, oversized, jest.fn());
    expect(oversized.status).toHaveBeenCalledWith(400);

    f.values.set('users/teacher-1', { role: 'student' });
    const student = makeRes();
    await handler({ body: { scope: 'all' } } as any, student, jest.fn());
    expect(student.status).toHaveBeenCalledWith(403);
    expect(f.transaction.create).not.toHaveBeenCalled();
  });
});
