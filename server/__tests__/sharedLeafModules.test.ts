import { decodeBase64Url, encodeBase64Url } from '../base64url';
import { effectivelyUnread, timestampMillis } from '../firestoreTime';
import { ROOM_SID_PATTERN } from '../ids';
import { createTicketSigner } from '../ticketSigner';
import { deleteQuietly, withUploadCompensation } from '../fileStorageGuards';
import { inboxGeneration, inboxUnreadCount, readInbox, readInboxItems, retractInboxItems } from '../notificationInbox';
import {
  completeRoomVia,
  fetchRoomVia,
  isParticipantConnectedVia,
  isTwilioNotFound,
  resolveCompositionMediaUrl,
  roomExistsVia,
} from '../twilioGateway';

describe('base64url', () => {
  it('round-trips arbitrary text, including characters that need escaping', () => {
    const text = '{"roomSid":"RM1","name":"Ñandú ¿qué? >>>???"}';
    const encoded = encodeBase64Url(text);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeBase64Url(encoded).toString('utf8')).toBe(text);
  });
});

describe('firestoreTime', () => {
  it('reads Dates and Firestore Timestamps, and rejects everything else', () => {
    expect(timestampMillis(new Date(5))).toBe(5);
    expect(timestampMillis({ toMillis: () => 7 })).toBe(7);
    expect(timestampMillis({ toMillis: () => NaN })).toBeNull();
    expect(timestampMillis(null)).toBeNull();
    expect(timestampMillis({})).toBeNull();
    expect(timestampMillis(12)).toBeNull();
  });

  it('treats an item as unread unless read explicitly or created before the boundary', () => {
    const created = new Date(100);
    expect(effectivelyUnread({ createdAt: created }, null)).toBe(true);
    expect(effectivelyUnread({ createdAt: created, readAt: new Date(200) }, null)).toBe(false);
    expect(effectivelyUnread({ createdAt: created }, new Date(100))).toBe(false);
    expect(effectivelyUnread({ createdAt: created }, new Date(99))).toBe(true);
  });
});

describe('ROOM_SID_PATTERN', () => {
  it('accepts RM + 32 alphanumerics only', () => {
    expect(ROOM_SID_PATTERN.test('RM00000000000000000000000000000abc')).toBe(true);
    expect(ROOM_SID_PATTERN.test('RM123')).toBe(false);
    expect(ROOM_SID_PATTERN.test('XX00000000000000000000000000000abc')).toBe(false);
    expect(ROOM_SID_PATTERN.test('RM0000000000000000000000000000abc/')).toBe(false);
  });
});

describe('createTicketSigner', () => {
  const signer = createTicketSigner('secret');

  it('verifies what it issued', () => {
    expect(signer.verify(signer.issue({ roomSid: 'RM1', uid: 'u1', exp: 1 }))).toEqual({ roomSid: 'RM1', uid: 'u1', exp: 1 });
  });

  it('rejects a tampered payload, a different secret, and malformed input', () => {
    const ticket = signer.issue({ uid: 'u1' });
    const [payload, signature] = ticket.split('.');
    const forgedPayload = encodeBase64Url(JSON.stringify({ uid: 'attacker' }));

    expect(signer.verify(`${forgedPayload}.${signature}`)).toBeUndefined();
    expect(createTicketSigner('other').verify(ticket)).toBeUndefined();
    expect(signer.verify(payload)).toBeUndefined();
    expect(signer.verify(`${payload}.`)).toBeUndefined();
    expect(signer.verify('.abc')).toBeUndefined();
    expect(signer.verify(undefined)).toBeUndefined();
    expect(signer.verify(42)).toBeUndefined();
  });
});

describe('fileStorageGuards', () => {
  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => consoleError.mockRestore());

  const context = { event: 'cleanup_failed', operation: 'op', uid: 'u1' };
  const makeStorage = (deleteImpl: jest.Mock = jest.fn().mockResolvedValue(undefined)) =>
    ({ upload: jest.fn(), download: jest.fn(), delete: deleteImpl } as any);

  it('deleteQuietly deletes the file and logs (never throws) when the delete fails', async () => {
    const storage = makeStorage(jest.fn().mockRejectedValue(new Error('appwrite down')));
    expect(() => deleteQuietly(storage, 'f1', context)).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(storage.delete).toHaveBeenCalledWith('f1');
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('"failure":"cleanup_failed"'));
  });

  it('withUploadCompensation removes an uploaded-but-uncommitted file when the work fails', async () => {
    const storage = makeStorage();
    await expect(
      withUploadCompensation(storage, context, async upload => {
        upload.track('orphan');
        throw new Error('firestore write failed');
      })
    ).rejects.toThrow('firestore write failed');
    expect(storage.delete).toHaveBeenCalledWith('orphan');
  });

  it('keeps the file once the document references it, even if later work fails', async () => {
    const storage = makeStorage();
    await expect(
      withUploadCompensation(storage, context, async upload => {
        upload.track('kept');
        upload.commit();
        throw new Error('later failure');
      })
    ).rejects.toThrow('later failure');
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('returns the work result untouched on success', async () => {
    const storage = makeStorage();
    await expect(withUploadCompensation(storage, context, async () => 'done')).resolves.toBe('done');
    expect(storage.delete).not.toHaveBeenCalled();
  });
});

describe('notificationInbox facade', () => {
  // Minimal in-memory Firestore-ish tree: refs are path strings with chained collection().doc().
  const makeRef = (path: string): any => ({
    path,
    collection: (name: string) => ({ doc: (id: string) => makeRef(`${path}/${name}/${id}`) }),
  });
  const makeTransaction = (docs: { [path: string]: any }) => {
    const tx: any = {
      get: jest.fn(async (ref: any) => ({ exists: ref.path in docs, data: () => docs[ref.path] })),
      update: jest.fn(),
      delete: jest.fn(),
    };
    return tx;
  };

  it('normalizes malformed counters', () => {
    expect(inboxGeneration({ currentGeneration: 3 })).toBe(3);
    expect(inboxGeneration({ currentGeneration: 'x' })).toBe(0);
    expect(inboxGeneration({})).toBe(0);
    expect(inboxUnreadCount({ unreadCount: 4 })).toBe(4);
    expect(inboxUnreadCount({ unreadCount: 1.5 })).toBe(0);
  });

  it('reads the state and locates items in the CURRENT generation', async () => {
    const user = makeRef('users/u1');
    const tx = makeTransaction({ 'users/u1/notificationState/inbox': { currentGeneration: 2, unreadCount: 3 } });

    const inbox = await readInbox(tx, user);

    expect(inbox.generation).toBe(2);
    expect(inbox.state.unreadCount).toBe(3);
    expect(inbox.itemRef('n1').path).toBe('users/u1/notificationGenerations/2/items/n1');
  });

  it('defaults to generation 0 when the state document does not exist', async () => {
    const inbox = await readInbox(makeTransaction({}), makeRef('users/u1'));
    expect(inbox.generation).toBe(0);
    expect(inbox.stateSnapshot.exists).toBe(false);
  });

  it('retracts existing items and lowers the unread counter by the unread ones only', async () => {
    const itemPath = (id: string) => `users/u1/notificationGenerations/0/items/${id}`;
    const tx = makeTransaction({
      'users/u1/notificationState/inbox': { currentGeneration: 0, unreadCount: 2, readBefore: new Date(100) },
      [itemPath('unread')]: { createdAt: new Date(500) },
      [itemPath('already-read')]: { createdAt: new Date(50) }, // created before readBefore → read
    });
    const inbox = await readInbox(tx, makeRef('users/u1'));
    const items = await readInboxItems(tx, inbox, ['unread', 'already-read', 'missing']);

    const removed = retractInboxItems(tx, inbox, items);

    expect(removed).toBe(2);
    expect(tx.delete).toHaveBeenCalledTimes(2);
    expect(tx.update).toHaveBeenCalledWith(inbox.stateRef, { unreadCount: 1 });
  });

  it('never drives the counter below zero and skips the write when nothing was unread', async () => {
    const tx = makeTransaction({
      'users/u1/notificationState/inbox': { currentGeneration: 0, unreadCount: 0 },
      'users/u1/notificationGenerations/0/items/a': { createdAt: new Date(5) },
    });
    const inbox = await readInbox(tx, makeRef('users/u1'));
    retractInboxItems(tx, inbox, await readInboxItems(tx, inbox, ['a']));
    expect(tx.update).toHaveBeenCalledWith(inbox.stateRef, { unreadCount: 0 });

    const tx2 = makeTransaction({
      'users/u1/notificationState/inbox': { currentGeneration: 0, unreadCount: 5, readBefore: new Date(100) },
      'users/u1/notificationGenerations/0/items/a': { createdAt: new Date(5) },
    });
    const inbox2 = await readInbox(tx2, makeRef('users/u1'));
    retractInboxItems(tx2, inbox2, await readInboxItems(tx2, inbox2, ['a']));
    expect(tx2.delete).toHaveBeenCalledTimes(1);
    expect(tx2.update).not.toHaveBeenCalled();
  });
});

describe('twilioGateway', () => {
  const notFound = Object.assign(new Error('not found'), { status: 404 });

  it('isTwilioNotFound only matches a 404 status', () => {
    expect(isTwilioNotFound(notFound)).toBe(true);
    expect(isTwilioNotFound({ status: 500 })).toBe(false);
    expect(isTwilioNotFound(null)).toBe(false);
    expect(isTwilioNotFound('404')).toBe(false);
  });

  const roomsClient = (rooms: any): any => ({ video: { v1: { rooms: jest.fn(() => rooms) } } });

  it('roomExistsVia maps a 404 to false and rethrows anything else', async () => {
    await expect(roomExistsVia(roomsClient({ fetch: jest.fn().mockResolvedValue({}) }), 'r')).resolves.toBe(true);
    await expect(roomExistsVia(roomsClient({ fetch: jest.fn().mockRejectedValue(notFound) }), 'r')).resolves.toBe(false);
    await expect(
      roomExistsVia(roomsClient({ fetch: jest.fn().mockRejectedValue({ status: 500 }) }), 'r')
    ).rejects.toEqual({ status: 500 });
  });

  it('fetchRoomVia returns the sid, unique name and creation time, null on 404, and rethrows anything else', async () => {
    const dateCreated = new Date('2026-10-18T10:00:00Z');
    const client = roomsClient({
      fetch: jest.fn().mockResolvedValue({ sid: 'RM1', uniqueName: 'clase-1', status: 'completed', dateCreated }),
    });
    await expect(fetchRoomVia(client, 'RM1')).resolves.toEqual({ sid: 'RM1', uniqueName: 'clase-1', dateCreated });
    expect(client.video.v1.rooms).toHaveBeenCalledWith('RM1');

    await expect(fetchRoomVia(roomsClient({ fetch: jest.fn().mockRejectedValue(notFound) }), 'RM1')).resolves.toBeNull();
    await expect(
      fetchRoomVia(roomsClient({ fetch: jest.fn().mockRejectedValue({ status: 500 }) }), 'RM1')
    ).rejects.toEqual({ status: 500 });
  });

  it('isParticipantConnectedVia is true only for a connected participant, false on 404, and rethrows anything else', async () => {
    const participantsClient = (fetch: jest.Mock): any => {
      const participants = jest.fn(() => ({ fetch }));
      return { client: { video: { v1: { rooms: jest.fn(() => ({ participants })) } } }, participants };
    };

    const connected = participantsClient(jest.fn().mockResolvedValue({ status: 'connected' }));
    await expect(isParticipantConnectedVia(connected.client, 'clase-1', 'Ana [Profesor]')).resolves.toBe(true);
    expect(connected.client.video.v1.rooms).toHaveBeenCalledWith('clase-1');
    // twilio-node interpolates the path segment verbatim, so the identity is encoded here.
    expect(connected.participants).toHaveBeenCalledWith(encodeURIComponent('Ana [Profesor]'));

    const gone = participantsClient(jest.fn().mockResolvedValue({ status: 'disconnected' }));
    await expect(isParticipantConnectedVia(gone.client, 'clase-1', 'Ana')).resolves.toBe(false);

    const missing = participantsClient(jest.fn().mockRejectedValue(notFound));
    await expect(isParticipantConnectedVia(missing.client, 'clase-1', 'Ana')).resolves.toBe(false);

    const failing = participantsClient(jest.fn().mockRejectedValue({ status: 500 }));
    await expect(isParticipantConnectedVia(failing.client, 'clase-1', 'Ana')).rejects.toEqual({ status: 500 });
  });

  it('completeRoomVia is idempotent on 404 and rethrows anything else', async () => {
    const update = jest.fn().mockResolvedValue({});
    await completeRoomVia(roomsClient({ update }), 'r');
    expect(update).toHaveBeenCalledWith({ status: 'completed' });

    await expect(completeRoomVia(roomsClient({ update: jest.fn().mockRejectedValue(notFound) }), 'r')).resolves.toBeUndefined();
    await expect(
      completeRoomVia(roomsClient({ update: jest.fn().mockRejectedValue({ status: 503 }) }), 'r')
    ).rejects.toEqual({ status: 503 });
  });

  it('resolveCompositionMediaUrl accepts a JSON redirect_to or a Location header, and fails when neither exists', async () => {
    const make = (response: any) => ({ request: jest.fn().mockResolvedValue(response) } as any);

    const jsonClient = make({ body: { redirect_to: 'https://media/json' }, headers: {} });
    await expect(resolveCompositionMediaUrl(jsonClient, 'CJ1/../x')).resolves.toBe('https://media/json');
    expect(jsonClient.request).toHaveBeenCalledWith({
      method: 'get',
      uri: 'https://video.twilio.com/v1/Compositions/CJ1%2F..%2Fx/Media?Ttl=3600',
      headers: { Accept: 'application/json' },
      allowRedirects: false,
    });

    await expect(resolveCompositionMediaUrl(make({ body: {}, headers: { location: 'https://media/302' } }), 'CJ1')).resolves.toBe(
      'https://media/302'
    );
    await expect(resolveCompositionMediaUrl(make({ body: {}, headers: {} }), 'CJ1')).rejects.toThrow(/no redirect location/);
  });
});
