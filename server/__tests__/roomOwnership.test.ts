import {
  claimRoomOwnership,
  createRecordingRulesGuard,
  createRoomClaimer,
  createRoomSessionBinder,
  isRoomOwner,
  isRoomSessionOwner,
  roomOwnerKey,
  RoomClaimDatabase,
} from '../roomOwnership';

// Fake of the Firestore surface the claim uses: roomOwners/{key} read and written
// inside one transaction. `owners` is the backing store, keyed by document id.
const makeClaimDb = (owners: { [key: string]: any } = {}) => {
  const docIds: string[] = [];
  const collection = jest.fn((_name: string) => ({
    doc: jest.fn((id: string) => {
      docIds.push(id);
      return { id, get: () => Promise.resolve({ exists: id in owners, data: () => owners[id] }) };
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
    expect(transactionSet).toHaveBeenCalledTimes(1);
    expect(owners[roomOwnerKey('clase-1')]).toEqual({ uid: 'uid-1', roomName: 'clase-1', claimedAt: 'server-timestamp' });
    expect(roomExists).not.toHaveBeenCalled();
  });

  it('re-claims a room the same uid already owns without asking Twilio', async () => {
    const { db, owners } = makeClaimDb({ [roomOwnerKey('clase-1')]: { uid: 'uid-1', roomName: 'clase-1' } });
    const roomExists = jest.fn();

    expect(await claimRoomOwnership(db, 'clase-1', 'uid-1', { roomExists, timestamp })).toBe(true);
    expect(owners[roomOwnerKey('clase-1')].claimedAt).toBe('server-timestamp');
    expect(roomExists).not.toHaveBeenCalled();
  });

  it('refuses while another uid owns the room and it is currently open', async () => {
    const { db, transactionSet, owners } = makeClaimDb({ [roomOwnerKey('clase-1')]: { uid: 'other', roomName: 'clase-1' } });
    const roomExists = jest.fn().mockResolvedValue(true);

    expect(await claimRoomOwnership(db, 'clase-1', 'uid-1', { roomExists, timestamp })).toBe(false);
    expect(roomExists).toHaveBeenCalledWith('clase-1');
    expect(transactionSet).not.toHaveBeenCalled();
    expect(owners[roomOwnerKey('clase-1')].uid).toBe('other');
  });

  it('takes over a room another uid owned once that class is closed', async () => {
    const { db, owners } = makeClaimDb({ [roomOwnerKey('clase-1')]: { uid: 'other', roomName: 'clase-1' } });
    const roomExists = jest.fn().mockResolvedValue(false);

    expect(await claimRoomOwnership(db, 'clase-1', 'uid-1', { roomExists, timestamp })).toBe(true);
    expect(owners[roomOwnerKey('clase-1')].uid).toBe('uid-1');
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

// Path-keyed Firestore fake ("collection/id" -> data) for the read/create helpers.
const makeStoreDb = (store: { [path: string]: any } = {}) => {
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
      };
    },
  }));
  return { db: { collection } as any, store, create, collection };
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

  it('binds a new session once Twilio confirms the unique name and the uid owns the room', async () => {
    const { db, store } = makeStoreDb({ [ownerPath('clase-1')]: { uid: 'uid-1', roomName: 'clase-1' } });
    const fetchRoom = jest.fn().mockResolvedValue({ sid: SID, uniqueName: 'clase-1' });

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
    const fetchRoom = jest.fn().mockResolvedValue({ sid: SID, uniqueName: 'clase-1' });
    expect(await createRoomSessionBinder(db, fetchRoom, timestamp)(claim)).toBe('not-room-owner');
    expect(create).not.toHaveBeenCalled();
  });

  it('resolves a create race by re-reading the winner', async () => {
    const store: { [path: string]: any } = { [ownerPath('clase-1')]: { uid: 'uid-1' } };
    const { db, create } = makeStoreDb(store);
    const fetchRoom = jest.fn(async () => {
      // Another request binds the session between our read and our create().
      store[`roomSessions/${SID}`] = { uid: 'other', roomName: 'clase-1' };
      return { sid: SID, uniqueName: 'clase-1' };
    });

    expect(await createRoomSessionBinder(db, fetchRoom, timestamp)(claim)).toBe('foreign-session');
    expect(create).toHaveBeenCalledTimes(1);
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
