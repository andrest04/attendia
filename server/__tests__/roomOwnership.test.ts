import {
  claimRoomOwnership,
  createRecordingRulesGuard,
  createRoomClaimer,
  createRoomSessionBinder,
  FRESH_CLAIM_WINDOW_MS,
  ROOM_CLAIM_CLOCK_SKEW_MS,
  isRoomOwner,
  isRoomSessionOwner,
  ROOM_OWNER_CLAIMS_SUBCOLLECTION,
  roomOwnerKey,
  RoomClaimDatabase,
} from '../roomOwnership';
import { timestampMillis } from '../firestoreTime';

// Fake of the Firestore surface the claim uses: roomOwners/{key} read and written
// inside one transaction, plus auto-id docs of its claims history subcollection.
// `owners` is the backing store, keyed by document id ("key/claims/auto-N" for history).
const makeClaimDb = (owners: { [key: string]: any } = {}) => {
  const docIds: string[] = [];
  let autoId = 0;
  const docRef = (id: string): any => ({
    id,
    get: () => Promise.resolve({ exists: id in owners, data: () => owners[id] }),
    collection: (sub: string) => ({ doc: () => docRef(`${id}/${sub}/auto-${++autoId}`) }),
  });
  const collection = jest.fn((_name: string) => ({
    doc: jest.fn((id: string) => {
      docIds.push(id);
      return docRef(id);
    }),
  }));
  const transactionSet = jest.fn((ref: any, data: any) => {
    owners[ref.id] = data;
  });
  const runTransaction = jest.fn(async (fn: any) => fn({ get: (ref: any) => ref.get(), set: transactionSet }));
  const db = ({ collection, runTransaction } as unknown) as RoomClaimDatabase;
  return { db, collection, runTransaction, transactionSet, owners, docIds };
};

const timestamp = () => 'server-timestamp';
const claimHistory = (owners: { [key: string]: any }, roomName: string) =>
  Object.keys(owners)
    .filter(id => id.startsWith(`${roomOwnerKey(roomName)}/${ROOM_OWNER_CLAIMS_SUBCOLLECTION}/`))
    .map(id => owners[id]);

describe('roomOwnerKey', () => {
  it('encodes the room name into a Firestore-safe document id', () => {
    expect(roomOwnerKey('matematicas-2a')).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(roomOwnerKey('a/b/..')).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(roomOwnerKey('a')).not.toEqual(roomOwnerKey('b'));
  });
});

describe('claimRoomOwnership', () => {
  it('claims an unowned room for the uid in a transaction', async () => {
    const { db, collection, transactionSet, owners } = makeClaimDb();
    const roomExists = jest.fn();

    const claimed = await claimRoomOwnership(db, 'clase-1', 'uid-1', { roomExists, timestamp });

    expect(claimed).toBe(true);
    expect(collection).toHaveBeenCalledWith('roomOwners');
    // The owner document plus one claims-history entry, in the same transaction.
    expect(transactionSet).toHaveBeenCalledTimes(2);
    expect(owners[roomOwnerKey('clase-1')]).toEqual({
      uid: 'uid-1',
      roomName: 'clase-1',
      claimedAt: 'server-timestamp',
      refreshedAt: 'server-timestamp',
      claimsHistory: true,
    });
    expect(roomExists).not.toHaveBeenCalled();
  });

  it('re-claims a room the same uid already owns without asking Twilio, keeping claimedAt', async () => {
    const firstClaim = new Date('2026-10-01T10:00:00Z');
    const { db, owners } = makeClaimDb({
      [roomOwnerKey('clase-1')]: { uid: 'uid-1', roomName: 'clase-1', claimedAt: firstClaim },
    });
    const roomExists = jest.fn();

    expect(await claimRoomOwnership(db, 'clase-1', 'uid-1', { roomExists, timestamp })).toBe(true);
    expect(owners[roomOwnerKey('clase-1')].claimedAt).toBe(firstClaim);
    expect(owners[roomOwnerKey('clase-1')].refreshedAt).toBe('server-timestamp');
    expect(roomExists).not.toHaveBeenCalled();
  });

  it('sets claimedAt on a same-uid re-claim of a legacy record that has none', async () => {
    const { db, owners } = makeClaimDb({ [roomOwnerKey('clase-1')]: { uid: 'uid-1', roomName: 'clase-1' } });

    expect(await claimRoomOwnership(db, 'clase-1', 'uid-1', { roomExists: jest.fn(), timestamp })).toBe(true);
    expect(owners[roomOwnerKey('clase-1')].claimedAt).toBe('server-timestamp');
  });

  it('treats another uid claim inside the fresh window as live even before the room exists', async () => {
    const now = Date.parse('2026-10-18T12:00:00Z');
    const { db, transactionSet } = makeClaimDb({
      [roomOwnerKey('clase-1')]: { uid: 'other', roomName: 'clase-1', claimedAt: new Date(now - FRESH_CLAIM_WINDOW_MS + 1000) },
    });
    const roomExists = jest.fn().mockResolvedValue(false);

    expect(await claimRoomOwnership(db, 'clase-1', 'uid-1', { roomExists, timestamp, now: () => now })).toBe(false);
    expect(transactionSet).not.toHaveBeenCalled();
  });

  it('uses the latest refresh of another uid claim for the fresh window', async () => {
    const now = Date.parse('2026-10-18T12:00:00Z');
    const { db } = makeClaimDb({
      [roomOwnerKey('clase-1')]: {
        uid: 'other',
        roomName: 'clase-1',
        claimedAt: new Date(now - 3600000),
        refreshedAt: new Date(now - 5000),
      },
    });

    expect(
      await claimRoomOwnership(db, 'clase-1', 'uid-1', { roomExists: jest.fn().mockResolvedValue(false), timestamp, now: () => now })
    ).toBe(false);
  });

  it('takes over another uid claim older than the fresh window once its room is closed', async () => {
    const now = Date.parse('2026-10-18T12:00:00Z');
    const { db, owners } = makeClaimDb({
      [roomOwnerKey('clase-1')]: { uid: 'other', roomName: 'clase-1', claimedAt: new Date(now - FRESH_CLAIM_WINDOW_MS - 1000) },
    });

    expect(
      await claimRoomOwnership(db, 'clase-1', 'uid-1', { roomExists: jest.fn().mockResolvedValue(false), timestamp, now: () => now })
    ).toBe(true);
    expect(owners[roomOwnerKey('clase-1')]).toEqual({
      uid: 'uid-1',
      roomName: 'clase-1',
      claimedAt: 'server-timestamp',
      refreshedAt: 'server-timestamp',
      claimsHistory: true,
    });
  });

  it('refuses while another uid owns the room and it is currently open', async () => {
    const { db, transactionSet, owners } = makeClaimDb({ [roomOwnerKey('clase-1')]: { uid: 'other', roomName: 'clase-1' } });
    const roomExists = jest.fn().mockResolvedValue(true);

    expect(await claimRoomOwnership(db, 'clase-1', 'uid-1', { roomExists, timestamp })).toBe(false);
    expect(roomExists).toHaveBeenCalledWith('clase-1');
    expect(transactionSet).not.toHaveBeenCalled();
    expect(owners[roomOwnerKey('clase-1')].uid).toBe('other');
  });

  it('takes over a room another uid owned once that class is closed, with a fresh claimedAt', async () => {
    const { db, owners } = makeClaimDb({
      [roomOwnerKey('clase-1')]: { uid: 'other', roomName: 'clase-1', claimedAt: new Date('2026-10-01T10:00:00Z') },
    });
    const roomExists = jest.fn().mockResolvedValue(false);

    expect(await claimRoomOwnership(db, 'clase-1', 'uid-1', { roomExists, timestamp })).toBe(true);
    expect(owners[roomOwnerKey('clase-1')].uid).toBe('uid-1');
    // The takeover restarts claimedAt, so the binder refuses the previous class's SID.
    expect(owners[roomOwnerKey('clase-1')].claimedAt).toBe('server-timestamp');
  });

  it('appends a claims-history entry when a new ownership period starts, not on a same-uid re-claim', async () => {
    const { db, owners } = makeClaimDb();
    const roomExists = jest.fn().mockResolvedValue(false);

    await claimRoomOwnership(db, 'clase-1', 'uid-1', { roomExists, timestamp });
    expect(claimHistory(owners, 'clase-1')).toEqual([{ uid: 'uid-1', claimedAt: 'server-timestamp' }]);

    await claimRoomOwnership(db, 'clase-1', 'uid-1', { roomExists, timestamp: () => 'later' });
    expect(claimHistory(owners, 'clase-1')).toHaveLength(1);

    // A takeover by another uid (outside the fresh window, room closed) starts a new period.
    const later = () => Date.now() + 3600 * 1000;
    await claimRoomOwnership(db, 'clase-1', 'uid-2', { roomExists, timestamp: () => 'takeover', now: later });
    expect(claimHistory(owners, 'clase-1')).toEqual([
      { uid: 'uid-1', claimedAt: 'server-timestamp' },
      { uid: 'uid-2', claimedAt: 'takeover' },
    ]);
  });

  it('backfills the period of a pre-history owner document once, on its next same-uid re-claim', async () => {
    const firstClaim = new Date('2026-10-01T10:00:00Z');
    const { db, owners } = makeClaimDb({
      [roomOwnerKey('clase-1')]: { uid: 'uid-1', roomName: 'clase-1', claimedAt: firstClaim },
    });

    await claimRoomOwnership(db, 'clase-1', 'uid-1', { roomExists: jest.fn(), timestamp });
    await claimRoomOwnership(db, 'clase-1', 'uid-1', { roomExists: jest.fn(), timestamp });

    expect(claimHistory(owners, 'clase-1')).toEqual([{ uid: 'uid-1', claimedAt: firstClaim }]);
    expect(owners[roomOwnerKey('clase-1')].claimsHistory).toBe(true);
  });

  it('writes no history entry when the claim is refused', async () => {
    const { db, owners } = makeClaimDb({ [roomOwnerKey('clase-1')]: { uid: 'other', roomName: 'clase-1' } });
    const roomExists = jest.fn().mockResolvedValue(true);

    expect(await claimRoomOwnership(db, 'clase-1', 'uid-1', { roomExists, timestamp })).toBe(false);
    expect(claimHistory(owners, 'clase-1')).toEqual([]);
  });

  it('propagates a Twilio lookup failure so the caller fails closed', async () => {
    const { db } = makeClaimDb({ [roomOwnerKey('clase-1')]: { uid: 'other', roomName: 'clase-1' } });
    const roomExists = jest.fn().mockRejectedValue(new Error('twilio down'));

    await expect(claimRoomOwnership(db, 'clase-1', 'uid-1', { roomExists, timestamp })).rejects.toThrow('twilio down');
  });

  it('createRoomClaimer binds the collaborators once', async () => {
    const { db, owners } = makeClaimDb();
    const claim = createRoomClaimer(db, { roomExists: jest.fn(), timestamp });

    expect(await claim('clase-9', 'uid-2')).toBe(true);
    expect(owners[roomOwnerKey('clase-9')].uid).toBe('uid-2');
  });
});

// Single-field query fake over the direct children of `prefix` in a path-keyed store:
// where('claimedAt', '<=', x), orderBy('claimedAt', 'desc') and limit(n).
type QueryState = { max?: unknown; descending?: boolean; count?: number };
const makeQuery = (store: { [path: string]: any }, prefix: string, queries: any[], state: QueryState = {}): any => ({
  where: (field: string, op: string, value: unknown) => {
    queries.push({ where: [field, op, value] });
    return makeQuery(store, prefix, queries, { ...state, max: value });
  },
  orderBy: (field: string, direction: string) => {
    queries.push({ orderBy: [field, direction] });
    return makeQuery(store, prefix, queries, { ...state, descending: direction === 'desc' });
  },
  limit: (count: number) => makeQuery(store, prefix, queries, { ...state, count }),
  get: async () => {
    if (store.__queryError) throw store.__queryError;
    const millis = (value: unknown) => timestampMillis(value) ?? NaN;
    let entries = Object.keys(store)
      .filter(path => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
      .map(path => store[path]);
    if (state.max !== undefined) entries = entries.filter(entry => millis(entry.claimedAt) <= millis(state.max));
    if (state.descending) entries.sort((a, b) => millis(b.claimedAt) - millis(a.claimedAt));
    if (state.count !== undefined) entries = entries.slice(0, state.count);
    return { docs: entries.map(entry => ({ data: () => entry })) };
  },
});

// Path-keyed Firestore fake ("collection/id" -> data) for the read/create helpers; a
// document's subcollection lives at "collection/id/sub/childId".
const makeStoreDb = (store: { [path: string]: any } = {}) => {
  const queries: any[] = [];
  const create = jest.fn(async (path: string, data: any) => {
    if (path in store) throw Object.assign(new Error('already exists'), { code: 6 });
    store[path] = data;
  });
  const collection = jest.fn((name: string) => ({
    doc: (id: string) => {
      const path = `${name}/${id}`;
      return {
        get: () => Promise.resolve({ exists: path in store, data: () => store[path] }),
        create: (data: any) => create(path, data),
        collection: (sub: string) => makeQuery(store, `${path}/${sub}/`, queries),
      };
    },
  }));
  return { db: { collection } as any, store, create, collection, queries };
};

const SID = 'RM00000000000000000000000000000abc';
const ownerPath = (roomName: string) => `roomOwners/${roomOwnerKey(roomName)}`;

describe('isRoomOwner / isRoomSessionOwner', () => {
  it('isRoomOwner compares roomOwners/{key}.uid with the uid', async () => {
    const { db } = makeStoreDb({ [ownerPath('clase-1')]: { uid: 'uid-1', roomName: 'clase-1' } });
    expect(await isRoomOwner(db, 'clase-1', 'uid-1')).toBe(true);
    expect(await isRoomOwner(db, 'clase-1', 'uid-2')).toBe(false);
    expect(await isRoomOwner(db, 'clase-2', 'uid-1')).toBe(false);
  });

  it('isRoomSessionOwner compares roomSessions/{sid}.uid with the uid', async () => {
    const { db } = makeStoreDb({ [`roomSessions/${SID}`]: { uid: 'uid-1', roomName: 'clase-1' } });
    expect(await isRoomSessionOwner(db, SID, 'uid-1')).toBe(true);
    expect(await isRoomSessionOwner(db, SID, 'uid-2')).toBe(false);
    expect(await isRoomSessionOwner(db, 'RMother', 'uid-1')).toBe(false);
  });
});

describe('createRoomSessionBinder', () => {
  const claim = { roomSid: SID, roomName: 'clase-1', uid: 'uid-1' };

  it('passes a session already bound to the same uid and room without asking Twilio', async () => {
    const { db, create } = makeStoreDb({ [`roomSessions/${SID}`]: { uid: 'uid-1', roomName: 'clase-1' } });
    const fetchRoom = jest.fn();

    expect(await createRoomSessionBinder(db, fetchRoom, timestamp)(claim)).toBe('bound');
    expect(fetchRoom).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses a session bound to another uid', async () => {
    const { db } = makeStoreDb({ [`roomSessions/${SID}`]: { uid: 'other', roomName: 'clase-1' } });
    expect(await createRoomSessionBinder(db, jest.fn(), timestamp)(claim)).toBe('foreign-session');
  });

  it('refuses a bound session whose room name differs from the claim', async () => {
    const { db } = makeStoreDb({ [`roomSessions/${SID}`]: { uid: 'uid-1', roomName: 'otra' } });
    expect(await createRoomSessionBinder(db, jest.fn(), timestamp)(claim)).toBe('room-mismatch');
  });

  // The owner claimed the name before Twilio created this SID's room.
  const CLAIMED_AT = new Date('2026-10-18T10:00:00Z');
  const ROOM_CREATED = new Date('2026-10-18T10:00:01Z');
  const ownedClase1 = () => ({ [ownerPath('clase-1')]: { uid: 'uid-1', roomName: 'clase-1', claimedAt: CLAIMED_AT } });
  const roomClase1 = (dateCreated: Date = ROOM_CREATED) =>
    jest.fn().mockResolvedValue({ sid: SID, uniqueName: 'clase-1', dateCreated });

  it('binds a new session once Twilio confirms the unique name and the uid owns the room', async () => {
    const { db, store } = makeStoreDb(ownedClase1());
    const fetchRoom = roomClase1();

    expect(await createRoomSessionBinder(db, fetchRoom, timestamp)(claim)).toBe('bound');
    expect(fetchRoom).toHaveBeenCalledWith(SID);
    expect(store[`roomSessions/${SID}`]).toEqual({ uid: 'uid-1', roomName: 'clase-1', boundAt: 'server-timestamp' });
  });

  it('answers room-not-found when Twilio does not know the SID', async () => {
    const { db, create } = makeStoreDb({ [ownerPath('clase-1')]: { uid: 'uid-1' } });
    expect(await createRoomSessionBinder(db, jest.fn().mockResolvedValue(null), timestamp)(claim)).toBe('room-not-found');
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses when the unique name behind the SID is a different room', async () => {
    const { db, create } = makeStoreDb({ [ownerPath('clase-1')]: { uid: 'uid-1' } });
    const fetchRoom = jest.fn().mockResolvedValue({ sid: SID, uniqueName: 'otra-clase' });
    expect(await createRoomSessionBinder(db, fetchRoom, timestamp)(claim)).toBe('room-mismatch');
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses when the uid does not own the room', async () => {
    const { db, create } = makeStoreDb({ [ownerPath('clase-1')]: { uid: 'other' } });
    const fetchRoom = roomClase1();
    expect(await createRoomSessionBinder(db, fetchRoom, timestamp)(claim)).toBe('not-room-owner');
    expect(create).not.toHaveBeenCalled();
  });

  it('resolves a create race by re-reading the winner', async () => {
    const store: { [path: string]: any } = ownedClase1();
    const { db, create } = makeStoreDb(store);
    const fetchRoom = jest.fn(async () => {
      // Another request binds the session between our read and our create().
      store[`roomSessions/${SID}`] = { uid: 'other', roomName: 'clase-1' };
      return { sid: SID, uniqueName: 'clase-1', dateCreated: ROOM_CREATED };
    });

    expect(await createRoomSessionBinder(db, fetchRoom, timestamp)(claim)).toBe('foreign-session');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('refuses a stale SID: a new owner of the name cannot bind the previous class session', async () => {
    // Teacher A ran SID at 10:00; the class closed and uid-1 reclaimed the name at 11:00.
    const { db, create } = makeStoreDb({
      [ownerPath('clase-1')]: { uid: 'uid-1', roomName: 'clase-1', claimedAt: new Date('2026-10-18T11:00:00Z') },
    });

    expect(await createRoomSessionBinder(db, roomClase1(new Date('2026-10-18T10:00:00Z')), timestamp)(claim)).toBe(
      'stale-owner'
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('tolerates a small clock skew between the claim and the room creation', async () => {
    const { db } = makeStoreDb(ownedClase1());
    const createdJustBefore = new Date(CLAIMED_AT.getTime() - ROOM_CLAIM_CLOCK_SKEW_MS + 1);

    expect(await createRoomSessionBinder(db, roomClase1(createdJustBefore), timestamp)(claim)).toBe('bound');
  });

  it('still binds a later class of the same owner (claimedAt kept across re-claims)', async () => {
    const { db } = makeStoreDb(ownedClase1());

    expect(await createRoomSessionBinder(db, roomClase1(new Date('2026-10-25T10:00:00Z')), timestamp)(claim)).toBe('bound');
  });

  it('fails closed when the room creation time or the claim time is unknown', async () => {
    const noDate = makeStoreDb(ownedClase1());
    expect(await createRoomSessionBinder(noDate.db, jest.fn().mockResolvedValue({ sid: SID, uniqueName: 'clase-1' }), timestamp)(claim)).toBe('stale-owner');

    const noClaim = makeStoreDb({ [ownerPath('clase-1')]: { uid: 'uid-1', roomName: 'clase-1' } });
    expect(await createRoomSessionBinder(noClaim.db, roomClase1(), timestamp)(claim)).toBe('stale-owner');
    expect(noDate.create).not.toHaveBeenCalled();
    expect(noClaim.create).not.toHaveBeenCalled();
  });

  // ─── Owner at room creation (claims history) ───
  const claimPath = (roomName: string, id: string) => `${ownerPath(roomName)}/${ROOM_OWNER_CLAIMS_SUBCOLLECTION}/${id}`;
  const at = (time: string) => new Date(`2026-10-18T${time}Z`);
  const sidOf = (n: number) => `RM0000000000000000000000000000000${n}`;
  const roomCreated = (dateCreated: Date) =>
    jest.fn(async (roomSid: string) => ({ sid: roomSid, uniqueName: 'clase-1', dateCreated }));
  const bind = (db: any, fetchRoom: any, roomSid: string, uid: string) =>
    createRoomSessionBinder(db, fetchRoom, timestamp)({ roomSid, roomName: 'clase-1', uid });
  // A ran a class at 10:00, B took the name over at 11:00 (B is the current owner).
  const aThenB = () => ({
    [ownerPath('clase-1')]: { uid: 'uid-b', roomName: 'clase-1', claimedAt: at('11:00:00') },
    [claimPath('clase-1', 'c1')]: { uid: 'uid-a', claimedAt: at('10:00:00') },
    [claimPath('clase-1', 'c2')]: { uid: 'uid-b', claimedAt: at('11:00:00') },
  });

  it("binds A's queued report after B took the name over (owner at creation, not the current owner)", async () => {
    const { db, store } = makeStoreDb(aThenB());

    expect(await bind(db, roomCreated(at('10:00:01')), sidOf(1), 'uid-a')).toBe('bound');
    expect(store[`roomSessions/${sidOf(1)}`].uid).toBe('uid-a');
  });

  it("refuses B binding A's SID even though B owns the name now", async () => {
    const { db, create } = makeStoreDb(aThenB());

    expect(await bind(db, roomCreated(at('10:00:01')), sidOf(1), 'uid-b')).toBe('not-room-owner');
    expect(create).not.toHaveBeenCalled();
  });

  it('resolves both directions of an A -> B -> A handover', async () => {
    const history = () => ({
      ...aThenB(),
      [ownerPath('clase-1')]: { uid: 'uid-a', roomName: 'clase-1', claimedAt: at('12:00:00') },
      [claimPath('clase-1', 'c3')]: { uid: 'uid-a', claimedAt: at('12:00:00') },
    });
    const aClass = roomCreated(at('10:00:01'));
    const bClass = roomCreated(at('11:00:01'));
    const aAgain = roomCreated(at('12:00:01'));

    expect(await bind(makeStoreDb(history()).db, aClass, sidOf(1), 'uid-a')).toBe('bound');
    expect(await bind(makeStoreDb(history()).db, aClass, sidOf(1), 'uid-b')).toBe('not-room-owner');
    expect(await bind(makeStoreDb(history()).db, bClass, sidOf(2), 'uid-b')).toBe('bound');
    expect(await bind(makeStoreDb(history()).db, bClass, sidOf(2), 'uid-a')).toBe('not-room-owner');
    expect(await bind(makeStoreDb(history()).db, aAgain, sidOf(3), 'uid-a')).toBe('bound');
    expect(await bind(makeStoreDb(history()).db, aAgain, sidOf(3), 'uid-b')).toBe('not-room-owner');
  });

  it('applies the clock skew to the history lookup with a single-field query', async () => {
    const { db, queries } = makeStoreDb(aThenB());
    // B's claim landed a moment after Twilio created B's room: still B's class.
    const createdJustBefore = new Date(at('11:00:00').getTime() - ROOM_CLAIM_CLOCK_SKEW_MS + 1);

    expect(await bind(db, roomCreated(createdJustBefore), sidOf(2), 'uid-b')).toBe('bound');
    expect(queries).toEqual(
      expect.arrayContaining([
        { where: ['claimedAt', '<=', new Date(createdJustBefore.getTime() + ROOM_CLAIM_CLOCK_SKEW_MS)] },
        { orderBy: ['claimedAt', 'desc'] },
      ])
    );
    expect(new Set(queries.map(query => (query.where || query.orderBy)[0]))).toEqual(new Set(['claimedAt']));
  });

  it('refuses a room created before every recorded claim (its owner is unknown)', async () => {
    const { db, create } = makeStoreDb({
      [ownerPath('clase-1')]: { uid: 'uid-a', roomName: 'clase-1', claimedAt: at('11:00:00') },
      [claimPath('clase-1', 'c1')]: { uid: 'uid-a', claimedAt: at('11:00:00') },
    });

    expect(await bind(db, roomCreated(at('09:00:00')), sidOf(1), 'uid-a')).toBe('stale-owner');
    expect(create).not.toHaveBeenCalled();
  });

  it('falls back to the current-owner rule for a legacy owner document with no history', async () => {
    const legacy = () => ({ [ownerPath('clase-1')]: { uid: 'uid-a', roomName: 'clase-1', claimedAt: at('10:00:00') } });

    expect(await bind(makeStoreDb(legacy()).db, roomCreated(at('10:00:01')), sidOf(1), 'uid-a')).toBe('bound');
    expect(await bind(makeStoreDb(legacy()).db, roomCreated(at('10:00:01')), sidOf(1), 'uid-b')).toBe('not-room-owner');
    expect(await bind(makeStoreDb(legacy()).db, roomCreated(at('09:00:00')), sidOf(1), 'uid-a')).toBe('stale-owner');
  });

  it('fails closed when the claims-history lookup fails', async () => {
    const { db, store, create } = makeStoreDb(aThenB());
    store.__queryError = new Error('firestore down');

    await expect(bind(db, roomCreated(at('10:00:01')), sidOf(1), 'uid-a')).rejects.toThrow('firestore down');
    expect(create).not.toHaveBeenCalled();
  });

  it('propagates Twilio failures', async () => {
    const { db } = makeStoreDb({ [ownerPath('clase-1')]: { uid: 'uid-1' } });
    await expect(
      createRoomSessionBinder(db, jest.fn().mockRejectedValue(new Error('twilio down')), timestamp)(claim)
    ).rejects.toThrow('twilio down');
  });
});

describe('createRecordingRulesGuard', () => {
  const makeRes = (uid: string | null = 'uid-1') => {
    const res: any = { locals: uid ? { firebaseUser: { uid } } : {} };
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    res.send = jest.fn(() => res);
    return res;
  };
  const teacherStore = () => ({
    'users/uid-1': { role: 'teacher' },
    [ownerPath('clase-1')]: { uid: 'uid-1', roomName: 'clase-1' },
  });
  const request = (body: any = { room_sid: SID, rules: [] }) => ({ body } as any);
  const roomClase1 = () => jest.fn().mockResolvedValue({ sid: SID, uniqueName: 'clase-1' });

  it('lets the owning teacher through to the recording-rules function', async () => {
    const { db } = makeStoreDb(teacherStore());
    const fetchRoom = roomClase1();
    const next = jest.fn();
    const res = makeRes();

    await createRecordingRulesGuard(db, fetchRoom)(request(), res, next);

    expect(fetchRoom).toHaveBeenCalledWith(SID);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('answers 401 without a verified user', async () => {
    const { db } = makeStoreDb(teacherStore());
    const next = jest.fn();
    const res = makeRes(null);

    await createRecordingRulesGuard(db, roomClase1())(request(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('answers 400 when room_sid is missing', async () => {
    const { db } = makeStoreDb(teacherStore());
    const next = jest.fn();
    const res = makeRes();

    await createRecordingRulesGuard(db, roomClase1())(request({ rules: [] }), res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('answers 403 for a non-teacher profile', async () => {
    const { db } = makeStoreDb({ ...teacherStore(), 'users/uid-1': { role: 'student' } });
    const fetchRoom = roomClase1();
    const next = jest.fn();
    const res = makeRes();

    await createRecordingRulesGuard(db, fetchRoom)(request(), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(fetchRoom).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('answers 403 for a teacher who does not own the room behind room_sid', async () => {
    const { db } = makeStoreDb({ ...teacherStore(), [ownerPath('clase-1')]: { uid: 'other' } });
    const next = jest.fn();
    const res = makeRes();

    await createRecordingRulesGuard(db, roomClase1())(request(), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('answers 403 when Twilio does not know the room', async () => {
    const { db } = makeStoreDb(teacherStore());
    const next = jest.fn();
    const res = makeRes();

    await createRecordingRulesGuard(db, jest.fn().mockResolvedValue(null))(request(), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('fails closed with 503 when the Twilio lookup fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { db } = makeStoreDb(teacherStore());
    const next = jest.fn();
    const res = makeRes();

    await createRecordingRulesGuard(db, jest.fn().mockRejectedValue(new Error('twilio down')))(request(), res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
