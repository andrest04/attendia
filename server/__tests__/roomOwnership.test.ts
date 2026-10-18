import { claimRoomOwnership, createRoomClaimer, roomOwnerKey, RoomClaimDatabase } from '../roomOwnership';

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
