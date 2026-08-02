import {
  createRequestRecordingHandler,
  createGetRecordingStatusHandler,
  createIssueRecordingDownloadTicketHandler,
  createDownloadRecordingHandler,
  refreshManualRecordingRequest,
  RecordingsDatabase,
  RecordingsClient,
} from '../recordings';

const makeRes = () => {
  const res: any = { locals: { firebaseUser: { uid: 'uid-1', email: 'ana@example.com' } } };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.redirect = jest.fn(() => res);
  return res;
};

// Fake of the minimal Firestore surface used here (users/{uid} profile doc + its
// "reports" subcollection with doc().get()/.update()) — same shape as
// attentionReports.test.ts's makeDb, minus the transaction (not needed here).
const makeDb = () => {
  const userGet = jest.fn();
  const reportGet = jest.fn();
  const reportUpdate = jest.fn(() => Promise.resolve());
  const requestGet = jest.fn();
  const requestCreate = jest.fn(() => Promise.resolve());
  const requestUpdate = jest.fn(() => Promise.resolve());
  const requestDoc = jest.fn(() => ({ get: requestGet, create: requestCreate, update: requestUpdate }));
  const recordingRequestsCollection = { doc: requestDoc };
  const reportCollection = jest.fn(() => recordingRequestsCollection);
  const reportDoc = jest.fn(() => ({ get: reportGet, update: reportUpdate, collection: reportCollection }));
  const reportsCollection = jest.fn(() => ({ doc: reportDoc }));
  const userDoc = jest.fn(() => ({ get: userGet, collection: reportsCollection }));
  const collection = jest.fn(() => ({ doc: userDoc }));
  const runTransaction = jest.fn(async (fn: any) => fn({
    get: (ref: any) => ref.get(),
    update: (ref: any, data: any) => ref.update(data),
  }));
  const db = ({ collection, runTransaction } as unknown) as RecordingsDatabase;
  return {
    db, collection, userDoc, userGet, reportsCollection, reportDoc, reportGet, reportUpdate, runTransaction,
    reportCollection, requestDoc, requestGet, requestCreate, requestUpdate,
  };
};

// Builds a structural Twilio client whose video.v1.compositions.create()/(sid).fetch()
// and raw request() resolve/reject as configured, recording what they were called with.
const makeClient = () => {
  const create = jest.fn();
  const fetch = jest.fn();
  const compositionsFn: any = jest.fn((_sid: string) => ({ fetch }));
  compositionsFn.create = create;
  const request = jest.fn();
  const client = ({ video: { v1: { compositions: compositionsFn } }, request } as unknown) as RecordingsClient;
  return { client, create, fetch, compositionsFn, request };
};

const teacherProfile = { role: 'teacher' };
const studentProfile = { role: 'student' };
const VALID_ROOM_SID = 'RM00000000000000000000000000000abc';
const SECRET = 'test-recording-secret';
const MANUAL_REQUEST_ID = 'manual_request_1234';
const SERVER_TIMESTAMP = { __serverTimestamp: true };
const request = (manualRequestId: unknown = MANUAL_REQUEST_ID) => ({
  params: { roomSid: VALID_ROOM_SID },
  body: { manualRequestId },
} as any);

describe('createRequestRecordingHandler', () => {
  afterEach(jest.clearAllMocks);

  it('requires a bounded, format-validated manualRequestId', async () => {
    const { db, userGet, reportGet, requestCreate } = makeDb();
    const { client, create } = makeClient();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportGet.mockResolvedValue({ data: () => ({ recordingWasActiveAtEnd: true }) });

    for (const manualRequestId of [null, '', 'spaces are invalid', 'x'.repeat(129)]) {
      const res = makeRes();
      await createRequestRecordingHandler(db, client, () => SERVER_TIMESTAMP)(request(manualRequestId), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    }
    expect(requestCreate).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('claims one durable request document and replays it without another Twilio create', async () => {
    const { db, userGet, reportGet, requestGet, requestCreate, requestUpdate, requestDoc } = makeDb();
    const { client, create } = makeClient();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportGet.mockResolvedValue({ data: () => ({ recordingWasActiveAtEnd: true }) });
    requestGet
      .mockResolvedValueOnce({ exists: false, data: () => undefined })
      .mockResolvedValueOnce({ exists: true, data: () => ({ manualRequestId: MANUAL_REQUEST_ID, status: 'enqueued', compositionSid: 'CJone' }) });
    create.mockResolvedValue({ sid: 'CJone', status: 'enqueued', dateCreated: new Date('2026-07-01T00:00:00.000Z') });

    await createRequestRecordingHandler(db, client, () => SERVER_TIMESTAMP)(request(), makeRes(), jest.fn());
    const replayRes = makeRes();
    await createRequestRecordingHandler(db, client, () => SERVER_TIMESTAMP)(request(), replayRes, jest.fn());

    expect(requestDoc).toHaveBeenCalledWith(MANUAL_REQUEST_ID);
    expect(requestCreate).toHaveBeenCalledWith(expect.objectContaining({ manualRequestId: MANUAL_REQUEST_ID, status: 'requesting' }));
    expect(requestUpdate).toHaveBeenCalledWith(expect.objectContaining({ compositionSid: 'CJone', status: 'enqueued' }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(replayRes.json).toHaveBeenCalledWith(expect.objectContaining({
      request: expect.objectContaining({ manualRequestId: MANUAL_REQUEST_ID, status: 'enqueued' }),
    }));
  });

  it('surfaces a claimed request without a provider SID as operationally ambiguous and never recreates it', async () => {
    const { db, userGet, reportGet, requestGet } = makeDb();
    const { client, create } = makeClient();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportGet.mockResolvedValue({ data: () => ({ recordingWasActiveAtEnd: true }) });
    requestGet.mockResolvedValue({ exists: true, data: () => ({ manualRequestId: MANUAL_REQUEST_ID, status: 'requesting' }) });
    const res = makeRes();

    await createRequestRecordingHandler(db, client, () => SERVER_TIMESTAMP)(request(), res, jest.fn());

    expect(create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      request: expect.objectContaining({ manualRequestId: MANUAL_REQUEST_ID, status: 'requesting', ambiguous: true }),
    });
  });

  it('returns 401 without a verified user', async () => {
    const { db } = makeDb();
    const { client } = makeClient();
    const res = makeRes();
    res.locals = {};

    await createRequestRecordingHandler(db, client, () => SERVER_TIMESTAMP)(request(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 400 for a malformed roomSid', async () => {
    const { db } = makeDb();
    const { client } = makeClient();
    const res = makeRes();

    await createRequestRecordingHandler(db, client, () => SERVER_TIMESTAMP)({ params: { roomSid: 'not-a-sid' }, body: { manualRequestId: MANUAL_REQUEST_ID } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 403 for a student', async () => {
    const { db, userGet, reportGet } = makeDb();
    const { client } = makeClient();
    userGet.mockResolvedValue({ exists: true, data: () => studentProfile });
    const res = makeRes();

    await createRequestRecordingHandler(db, client, () => SERVER_TIMESTAMP)(request(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(reportGet).not.toHaveBeenCalled();
  });

  it('returns 404 when the report does not exist', async () => {
    const { db, userGet, reportGet } = makeDb();
    const { client } = makeClient();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportGet.mockResolvedValue({ data: () => undefined });
    const res = makeRes();

    await createRequestRecordingHandler(db, client, () => SERVER_TIMESTAMP)(request(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 when the recording was not active at the end of the class', async () => {
    const { db, userGet, reportGet } = makeDb();
    const { client, create } = makeClient();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportGet.mockResolvedValue({ data: () => ({ recordingWasActiveAtEnd: false }) });
    const res = makeRes();

    await createRequestRecordingHandler(db, client, () => SERVER_TIMESTAMP)(request(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a composition, persists it, and returns 200 when none was requested yet', async () => {
    const { db, userGet, reportGet, reportUpdate } = makeDb();
    const { client, create } = makeClient();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportGet.mockResolvedValue({ data: () => ({ recordingWasActiveAtEnd: true }) });
    create.mockResolvedValue({ sid: 'CJxxx', status: 'enqueued', dateCreated: new Date('2026-07-01T00:00:00.000Z') });
    const res = makeRes();

    await createRequestRecordingHandler(db, client, () => SERVER_TIMESTAMP)(request(), res, jest.fn());

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ roomSid: VALID_ROOM_SID, audioSources: ['*'] })
    );
    const expectedRecording = {
      manualRequestId: MANUAL_REQUEST_ID,
      compositionSid: 'CJxxx',
      status: 'enqueued',
      mediaExpiresAt: new Date('2026-07-01T00:00:00.000Z').getTime() + 7 * 24 * 60 * 60 * 1000,
    };
    expect(reportUpdate).toHaveBeenCalledWith({ recording: expectedRecording });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ recording: expectedRecording, request: expectedRecording });
  });

  it('does not create a new composition when one is already enqueued/processing/completed', async () => {
    const { db, userGet, reportGet, reportUpdate, requestGet } = makeDb();
    const { client, create } = makeClient();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    const existingRecording = { manualRequestId: MANUAL_REQUEST_ID, compositionSid: 'CJold', status: 'processing' };
    reportGet.mockResolvedValue({ data: () => ({ recordingWasActiveAtEnd: true, recording: existingRecording }) });
    requestGet.mockResolvedValue({ exists: true, data: () => existingRecording });
    const res = makeRes();

    await createRequestRecordingHandler(db, client, () => SERVER_TIMESTAMP)(request(), res, jest.fn());

    expect(create).not.toHaveBeenCalled();
    expect(reportUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ recording: existingRecording, request: existingRecording });
  });

  it('allows re-requesting a composition after a previous failure', async () => {
    const { db, userGet, reportGet, reportUpdate } = makeDb();
    const { client, create } = makeClient();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportGet.mockResolvedValue({
      data: () => ({ recordingWasActiveAtEnd: true, recording: { compositionSid: 'CJold', status: 'failed' } }),
    });
    create.mockResolvedValue({ sid: 'CJnew', status: 'enqueued', dateCreated: new Date() });
    const res = makeRes();

    await createRequestRecordingHandler(db, client, () => SERVER_TIMESTAMP)(request(), res, jest.fn());

    expect(create).toHaveBeenCalled();
    expect(reportUpdate).toHaveBeenCalledWith(expect.objectContaining({ recording: expect.objectContaining({ compositionSid: 'CJnew' }) }));
  });

  it('does not recreate after provider acceptance when persisting the provider SID crashes', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db, userGet, reportGet, requestGet, requestUpdate } = makeDb();
    const { client, create } = makeClient();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportGet.mockResolvedValue({ data: () => ({ recordingWasActiveAtEnd: true }) });
    requestGet
      .mockResolvedValueOnce({ exists: false, data: () => undefined })
      .mockResolvedValueOnce({ exists: true, data: () => ({ manualRequestId: MANUAL_REQUEST_ID, status: 'requesting' }) });
    create.mockResolvedValue({ sid: 'CJaccepted', status: 'enqueued', dateCreated: new Date() });
    requestUpdate.mockRejectedValueOnce(new Error('crash after provider acceptance'));

    await createRequestRecordingHandler(db, client, () => SERVER_TIMESTAMP)(request(), makeRes(), jest.fn());
    const replayRes = makeRes();
    await createRequestRecordingHandler(db, client, () => SERVER_TIMESTAMP)(request(), replayRes, jest.fn());

    expect(create).toHaveBeenCalledTimes(1);
    expect(replayRes.status).toHaveBeenCalledWith(409);
    expect(replayRes.json).toHaveBeenCalledWith({ request: expect.objectContaining({ ambiguous: true }) });
    consoleError.mockRestore();
  });

  it('keeps later manual request IDs independent from earlier outcomes', async () => {
    const { db, userGet, reportGet, requestGet, requestDoc } = makeDb();
    const { client, create } = makeClient();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportGet.mockResolvedValue({ data: () => ({ recordingWasActiveAtEnd: true }) });
    requestGet.mockResolvedValue({ exists: false, data: () => undefined });
    create
      .mockResolvedValueOnce({ sid: 'CJfailed-retry', status: 'failed', dateCreated: new Date() })
      .mockResolvedValueOnce({ sid: 'CJlater', status: 'enqueued', dateCreated: new Date() });

    await createRequestRecordingHandler(db, client, () => SERVER_TIMESTAMP)(request('manual_request_first'), makeRes(), jest.fn());
    await createRequestRecordingHandler(db, client, () => SERVER_TIMESTAMP)(request('manual_request_later'), makeRes(), jest.fn());

    expect(requestDoc.mock.calls.map(call => call[0])).toEqual(['manual_request_first', 'manual_request_later']);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('returns an ambiguous claim when the Twilio create response is uncertain', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db, userGet, reportGet } = makeDb();
    const { client, create } = makeClient();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportGet.mockResolvedValue({ data: () => ({ recordingWasActiveAtEnd: true }) });
    create.mockRejectedValue(new Error('twilio down'));
    const res = makeRes();

    await createRequestRecordingHandler(db, client, () => SERVER_TIMESTAMP)(request(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      request: expect.objectContaining({ manualRequestId: MANUAL_REQUEST_ID, status: 'requesting', ambiguous: true }),
    });
    consoleError.mockRestore();
  });
});

describe('refreshManualRecordingRequest', () => {
  afterEach(jest.clearAllMocks);

  it('persists an authoritative terminal provider transition on the durable request', async () => {
    const { db, requestGet, requestUpdate } = makeDb();
    const { client, fetch, compositionsFn } = makeClient();
    requestGet
      .mockResolvedValueOnce({ exists: true, data: () => ({
        manualRequestId: MANUAL_REQUEST_ID, compositionSid: 'CJterminal', status: 'processing',
      }) })
      .mockResolvedValueOnce({ exists: true, data: () => ({
        manualRequestId: MANUAL_REQUEST_ID, compositionSid: 'CJterminal', status: 'processing',
      }) });
    const changedAt = new Date('2026-07-03T12:00:00.000Z');
    fetch.mockResolvedValue({ sid: 'CJterminal', status: 'completed', dateCreated: new Date(), dateUpdated: changedAt });

    const result = await refreshManualRecordingRequest(
      db, client, () => SERVER_TIMESTAMP, 'uid-1', VALID_ROOM_SID, MANUAL_REQUEST_ID
    );

    expect(compositionsFn).toHaveBeenCalledWith('CJterminal');
    expect(requestUpdate).toHaveBeenCalledWith(expect.objectContaining({
      manualRequestId: MANUAL_REQUEST_ID, status: 'completed', statusChangedAt: changedAt,
    }));
    expect(result).toEqual(expect.objectContaining({ status: 'completed', statusChangedAt: changedAt }));
  });

  it('does not poll confirmed terminal or provider-ambiguous requests without a composition SID', async () => {
    const terminal = {
      manualRequestId: MANUAL_REQUEST_ID, compositionSid: 'CJterminal', status: 'failed', statusChangedAt: SERVER_TIMESTAMP,
    };
    const terminalDb = makeDb();
    const terminalClient = makeClient();
    terminalDb.requestGet.mockResolvedValue({ exists: true, data: () => terminal });
    expect(await refreshManualRecordingRequest(
      terminalDb.db, terminalClient.client, () => SERVER_TIMESTAMP, 'uid-1', VALID_ROOM_SID, MANUAL_REQUEST_ID
    )).toBe(terminal);
    expect(terminalClient.fetch).not.toHaveBeenCalled();

    const ambiguousDb = makeDb();
    const ambiguousClient = makeClient();
    ambiguousDb.requestGet.mockResolvedValue({ exists: true, data: () => ({
      manualRequestId: MANUAL_REQUEST_ID, status: 'requesting', ambiguous: true,
    }) });
    await refreshManualRecordingRequest(
      ambiguousDb.db, ambiguousClient.client, () => SERVER_TIMESTAMP, 'uid-1', VALID_ROOM_SID, MANUAL_REQUEST_ID
    );
    expect(ambiguousClient.fetch).not.toHaveBeenCalled();
    expect(ambiguousDb.requestUpdate).not.toHaveBeenCalled();
  });
});

describe('createGetRecordingStatusHandler', () => {
  afterEach(jest.clearAllMocks);

  it('returns not_requested when no composition has been requested', async () => {
    const { db, userGet, reportGet } = makeDb();
    const { client, fetch } = makeClient();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportGet.mockResolvedValue({ data: () => ({ recordingWasActiveAtEnd: true }) });
    const res = makeRes();

    await createGetRecordingStatusHandler(db, client, () => SERVER_TIMESTAMP)({ params: { roomSid: VALID_ROOM_SID } } as any, res, jest.fn());

    expect(fetch).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ recording: { status: 'not_requested' } });
  });

  it('refreshes the composition, maps deleted to expired, and persists the result', async () => {
    const { db, userGet, reportGet, reportUpdate, reportDoc } = makeDb();
    const { client, fetch, compositionsFn } = makeClient();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportGet.mockResolvedValue({
      data: () => ({ recordingWasActiveAtEnd: true, recording: { compositionSid: 'CJxxx', status: 'processing' } }),
    });
    fetch.mockResolvedValue({ sid: 'CJxxx', status: 'deleted', dateCreated: new Date('2026-06-01T00:00:00.000Z') });
    const res = makeRes();

    await createGetRecordingStatusHandler(db, client, () => SERVER_TIMESTAMP)({ params: { roomSid: VALID_ROOM_SID } } as any, res, jest.fn());

    expect(compositionsFn).toHaveBeenCalledWith('CJxxx');
    expect(reportDoc).toHaveBeenCalledWith(VALID_ROOM_SID);
    const expected = {
      compositionSid: 'CJxxx',
      status: 'expired',
      mediaExpiresAt: new Date('2026-06-01T00:00:00.000Z').getTime() + 7 * 24 * 60 * 60 * 1000,
    };
    expect(reportUpdate).toHaveBeenCalledWith({ recording: expected });
    expect(res.json).toHaveBeenCalledWith({ recording: expected });
  });

  it.each([
    ['completed', new Date('2026-07-03T12:00:00.000Z'), new Date('2026-07-03T12:00:00.000Z')],
    ['failed', undefined, SERVER_TIMESTAMP],
    ['deleted', new Date('2026-07-04T12:00:00.000Z'), new Date('2026-07-04T12:00:00.000Z')],
  ])('persists a write-once terminal timestamp for provider status %s', async (providerStatus, dateUpdated, expectedTimestamp) => {
    const { db, userGet, reportGet, requestGet, requestUpdate } = makeDb();
    const { client, fetch } = makeClient();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportGet.mockResolvedValue({ data: () => ({ recording: {
      manualRequestId: MANUAL_REQUEST_ID, compositionSid: 'CJterminal', status: 'processing',
    } }) });
    requestGet.mockResolvedValue({ exists: true, data: () => ({
      manualRequestId: MANUAL_REQUEST_ID, compositionSid: 'CJterminal', status: 'processing',
    }) });
    fetch.mockResolvedValue({ sid: 'CJterminal', status: providerStatus, dateCreated: new Date(), dateUpdated });

    await createGetRecordingStatusHandler(db, client, () => SERVER_TIMESTAMP)(
      { params: { roomSid: VALID_ROOM_SID } } as any, makeRes(), jest.fn()
    );

    expect(requestUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: providerStatus === 'deleted' ? 'expired' : providerStatus,
      statusChangedAt: expectedTimestamp,
    }));
  });

  it('does not poll or move a persisted terminal timestamp', async () => {
    const stableTimestamp = new Date('2026-07-03T12:00:00.000Z');
    const terminalRequest = {
      manualRequestId: MANUAL_REQUEST_ID, compositionSid: 'CJterminal', status: 'completed', statusChangedAt: stableTimestamp,
    };
    const { db, userGet, reportGet, requestGet, requestUpdate } = makeDb();
    const { client, fetch } = makeClient();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportGet.mockResolvedValue({ data: () => ({ recording: terminalRequest }) });
    requestGet.mockResolvedValue({ exists: true, data: () => terminalRequest });
    const res = makeRes();

    await createGetRecordingStatusHandler(db, client, () => SERVER_TIMESTAMP)(
      { params: { roomSid: VALID_ROOM_SID } } as any, res, jest.fn()
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(requestUpdate).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ recording: terminalRequest });
  });

  it('returns 403 for a student', async () => {
    const { db, userGet, reportGet } = makeDb();
    const { client } = makeClient();
    userGet.mockResolvedValue({ exists: true, data: () => studentProfile });
    const res = makeRes();

    await createGetRecordingStatusHandler(db, client, () => SERVER_TIMESTAMP)({ params: { roomSid: VALID_ROOM_SID } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(reportGet).not.toHaveBeenCalled();
  });

  it('returns 503 when Twilio fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db, userGet, reportGet } = makeDb();
    const { client, fetch } = makeClient();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportGet.mockResolvedValue({ data: () => ({ recording: { compositionSid: 'CJxxx', status: 'processing' } }) });
    fetch.mockRejectedValue(new Error('twilio down'));
    const res = makeRes();

    await createGetRecordingStatusHandler(db, client, () => SERVER_TIMESTAMP)({ params: { roomSid: VALID_ROOM_SID } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    consoleError.mockRestore();
  });
});

describe('createIssueRecordingDownloadTicketHandler', () => {
  afterEach(jest.clearAllMocks);

  it('returns 503 when the secret is not configured', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db } = makeDb();
    const res = makeRes();

    await createIssueRecordingDownloadTicketHandler(db, undefined)(
      { params: { roomSid: VALID_ROOM_SID } } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(503);
    consoleError.mockRestore();
  });

  it('returns 400 when the recording is not completed yet', async () => {
    const { db, userGet, reportGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportGet.mockResolvedValue({ data: () => ({ recording: { status: 'processing' } }) });
    const res = makeRes();

    await createIssueRecordingDownloadTicketHandler(db, SECRET)(
      { params: { roomSid: VALID_ROOM_SID } } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('issues a downloadUrl carrying a ticket for a completed recording', async () => {
    const { db, userGet, reportGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportGet.mockResolvedValue({ data: () => ({ recording: { status: 'completed', compositionSid: 'CJxxx' } }) });
    const res = makeRes();

    await createIssueRecordingDownloadTicketHandler(db, SECRET)(
      { params: { roomSid: VALID_ROOM_SID } } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const jsonArg = res.json.mock.calls[0][0];
    expect(jsonArg.downloadUrl).toMatch(
      new RegExp(`^/reports/${VALID_ROOM_SID}/recording/download\\?ticket=`)
    );
  });

  it('returns 403 for a student', async () => {
    const { db, userGet, reportGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => studentProfile });
    const res = makeRes();

    await createIssueRecordingDownloadTicketHandler(db, SECRET)(
      { params: { roomSid: VALID_ROOM_SID } } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(reportGet).not.toHaveBeenCalled();
  });
});

describe('createDownloadRecordingHandler', () => {
  afterEach(jest.clearAllMocks);

  // Extracts the ticket query value from a downloadUrl string produced by the
  // issuance handler above, for round-trip verification tests.
  function extractTicket(downloadUrl: string): string {
    return decodeURIComponent(downloadUrl.split('ticket=')[1]);
  }

  async function issueTicket(db: RecordingsDatabase, roomSid = VALID_ROOM_SID): Promise<string> {
    const res = makeRes();
    await createIssueRecordingDownloadTicketHandler(db, SECRET)({ params: { roomSid } } as any, res, jest.fn());
    const { downloadUrl } = res.json.mock.calls[0][0];
    return extractTicket(downloadUrl);
  }

  it('returns 400 for a malformed roomSid', async () => {
    const { db } = makeDb();
    const { client } = makeClient();
    const res = makeRes();

    await createDownloadRecordingHandler(db, client, SECRET)(
      { params: { roomSid: 'nope' }, query: {} } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 503 when the secret is not configured', async () => {
    const { db } = makeDb();
    const { client } = makeClient();
    const res = makeRes();

    await createDownloadRecordingHandler(db, client, undefined)(
      { params: { roomSid: VALID_ROOM_SID }, query: { ticket: 'whatever' } } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('rejects a missing or tampered ticket with 401', async () => {
    const { db } = makeDb();
    const { client } = makeClient();
    const res = makeRes();

    await createDownloadRecordingHandler(db, client, SECRET)(
      { params: { roomSid: VALID_ROOM_SID }, query: { ticket: 'garbage.notavalidsignature' } } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('redirects to the Twilio-signed media URL for a valid ticket (JSON body form)', async () => {
    const { db, userGet, reportGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportGet.mockResolvedValue({ data: () => ({ recording: { status: 'completed', compositionSid: 'CJxxx' } }) });
    const ticket = await issueTicket(db);

    const { client, request } = makeClient();
    request.mockResolvedValue({ statusCode: 200, body: { redirect_to: 'https://media.twilio.com/signed' }, headers: {} });
    const res = makeRes();

    await createDownloadRecordingHandler(db, client, SECRET)(
      { params: { roomSid: VALID_ROOM_SID }, query: { ticket } } as any,
      res,
      jest.fn()
    );

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'get',
        uri: expect.stringContaining('/Compositions/CJxxx/Media'),
        allowRedirects: false,
      })
    );
    expect(res.redirect).toHaveBeenCalledWith(302, 'https://media.twilio.com/signed');
  });

  it('falls back to the Location header when Twilio replies with a redirect instead of JSON', async () => {
    const { db, userGet, reportGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportGet.mockResolvedValue({ data: () => ({ recording: { status: 'completed', compositionSid: 'CJxxx' } }) });
    const ticket = await issueTicket(db);

    const { client, request } = makeClient();
    request.mockResolvedValue({ statusCode: 302, body: {}, headers: { location: 'https://media.twilio.com/redirected' } });
    const res = makeRes();

    await createDownloadRecordingHandler(db, client, SECRET)(
      { params: { roomSid: VALID_ROOM_SID }, query: { ticket } } as any,
      res,
      jest.fn()
    );

    expect(res.redirect).toHaveBeenCalledWith(302, 'https://media.twilio.com/redirected');
  });

  it('returns 404 when the recording is no longer completed by the time the ticket is used', async () => {
    const { db, userGet, reportGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportGet.mockResolvedValueOnce({ data: () => ({ recording: { status: 'completed', compositionSid: 'CJxxx' } }) });
    const ticket = await issueTicket(db);
    reportGet.mockResolvedValue({ data: () => ({ recording: { status: 'expired', compositionSid: 'CJxxx' } }) });

    const { client, request } = makeClient();
    const res = makeRes();

    await createDownloadRecordingHandler(db, client, SECRET)(
      { params: { roomSid: VALID_ROOM_SID }, query: { ticket } } as any,
      res,
      jest.fn()
    );

    expect(request).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 503 when Twilio has no media location to redirect to', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { db, userGet, reportGet } = makeDb();
    userGet.mockResolvedValue({ exists: true, data: () => teacherProfile });
    reportGet.mockResolvedValue({ data: () => ({ recording: { status: 'completed', compositionSid: 'CJxxx' } }) });
    const ticket = await issueTicket(db);

    const { client, request } = makeClient();
    request.mockResolvedValue({ statusCode: 200, body: {}, headers: {} });
    const res = makeRes();

    await createDownloadRecordingHandler(db, client, SECRET)(
      { params: { roomSid: VALID_ROOM_SID }, query: { ticket } } as any,
      res,
      jest.fn()
    );

    expect(res.status).toHaveBeenCalledWith(503);
    consoleError.mockRestore();
  });
});
