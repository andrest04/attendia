import {
  createIdentityReservationGuard,
  identityReservationKey,
  IdentityReservationDatabase,
  reserveIdentity,
  ROOM_IDENTITIES_COLLECTION,
} from '../identityReservation';

// Firestore fake routed by collection name: "collection/id" -> data, read and written in
// one transaction.
const makeDb = (store: { [path: string]: any } = {}) => {
  const collection = jest.fn((name: string) => ({
    doc: (id: string) => {
      const path = `${name}/${id}`;
      return { path, get: () => Promise.resolve({ exists: path in store, data: () => store[path] }) };
    },
  }));
  const transactionSet = jest.fn((ref: any, data: any) => {
    store[ref.path] = data;
  });
  const runTransaction = jest.fn(async (fn: any) => fn({ get: (ref: any) => ref.get(), set: transactionSet }));
  const db = ({ collection, runTransaction } as unknown) as IdentityReservationDatabase;
  return { db, store, collection, transactionSet, runTransaction };
};

const timestamp = () => 'server-timestamp';
const reservationPath = (roomName: string, identity: string) =>
  `${ROOM_IDENTITIES_COLLECTION}/${identityReservationKey(roomName, identity)}`;

describe('identityReservationKey', () => {
  it('is a Firestore-safe, unambiguous document id', () => {
    const key = identityReservationKey('clase-1', 'Ana Pérez [Profesor]');
    expect(key).toMatch(/^[A-Za-z0-9_.-]+$/);
    expect(key).not.toMatch(/^__.*__$/);
    expect(identityReservationKey('a/b', '..')).toMatch(/^[A-Za-z0-9_.-]+$/);
    expect(identityReservationKey('ab', 'c')).not.toEqual(identityReservationKey('a', 'bc'));
  });
});

describe('reserveIdentity', () => {
  const request = { roomName: 'clase-1', identity: 'Ana', uid: 'uid-1' };

  it('reserves a free identity for the uid without asking Twilio', async () => {
    const { db, store } = makeDb();
    const isConnected = jest.fn();

    expect(await reserveIdentity(db, request, { isConnected, timestamp })).toBe(true);
    expect(store[reservationPath('clase-1', 'Ana')]).toEqual({
      uid: 'uid-1',
      roomName: 'clase-1',
      identity: 'Ana',
      reservedAt: 'server-timestamp',
    });
    expect(isConnected).not.toHaveBeenCalled();
  });

  it('refreshes the reservation of the same uid without asking Twilio', async () => {
    const { db, store } = makeDb({ [reservationPath('clase-1', 'Ana')]: { uid: 'uid-1', reservedAt: 'old' } });
    const isConnected = jest.fn();

    expect(await reserveIdentity(db, request, { isConnected, timestamp })).toBe(true);
    expect(store[reservationPath('clase-1', 'Ana')].reservedAt).toBe('server-timestamp');
    expect(isConnected).not.toHaveBeenCalled();
  });

  it('refuses while another uid holding the identity is connected in the room', async () => {
    const { db, store, transactionSet } = makeDb({ [reservationPath('clase-1', 'Ana')]: { uid: 'other' } });
    const isConnected = jest.fn().mockResolvedValue(true);

    expect(await reserveIdentity(db, request, { isConnected, timestamp })).toBe(false);
    expect(isConnected).toHaveBeenCalledWith('clase-1', 'Ana');
    expect(transactionSet).not.toHaveBeenCalled();
    expect(store[reservationPath('clase-1', 'Ana')].uid).toBe('other');
  });

  it('takes the identity over once the other uid is no longer connected', async () => {
    const { db, store } = makeDb({ [reservationPath('clase-1', 'Ana')]: { uid: 'other' } });

    expect(await reserveIdentity(db, request, { isConnected: jest.fn().mockResolvedValue(false), timestamp })).toBe(true);
    expect(store[reservationPath('clase-1', 'Ana')].uid).toBe('uid-1');
  });

  it('propagates a Twilio lookup failure so the caller fails closed', async () => {
    const { db } = makeDb({ [reservationPath('clase-1', 'Ana')]: { uid: 'other' } });

    await expect(
      reserveIdentity(db, request, { isConnected: jest.fn().mockRejectedValue(new Error('twilio down')), timestamp })
    ).rejects.toThrow('twilio down');
  });
});

describe('createIdentityReservationGuard', () => {
  const makeRes = (uid: string | null = 'uid-1') => {
    const res: any = { locals: uid ? { firebaseUser: { uid } } : {} };
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
  };
  const tokenRequest = (body: any = { room_name: 'clase-1', user_identity: '  Ana  ' }) => ({ body } as any);

  it('reserves the trimmed identity and passes through', async () => {
    const { db, store } = makeDb();
    const next = jest.fn();
    const res = makeRes();

    await createIdentityReservationGuard(db, jest.fn(), timestamp)(tokenRequest(), res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
    expect(store[reservationPath('clase-1', 'Ana')].uid).toBe('uid-1');
  });

  it('answers 409 with a Spanish explanation when the identity is connected under another uid', async () => {
    const { db } = makeDb({ [reservationPath('clase-1', 'Ana')]: { uid: 'other' } });
    const next = jest.fn();
    const res = makeRes();

    await createIdentityReservationGuard(db, jest.fn().mockResolvedValue(true), timestamp)(tokenRequest(), res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'identity in use', explanation: expect.stringMatching(/nombre.*en uso/i) },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('fails closed with 503 when the lookup fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { db } = makeDb({ [reservationPath('clase-1', 'Ana')]: { uid: 'other' } });
    const next = jest.fn();
    const res = makeRes();

    await createIdentityReservationGuard(db, jest.fn().mockRejectedValue(new Error('twilio down')), timestamp)(
      tokenRequest(),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('answers 401 without a verified user', async () => {
    const { db } = makeDb();
    const next = jest.fn();
    const res = makeRes(null);

    await createIdentityReservationGuard(db, jest.fn(), timestamp)(tokenRequest(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('leaves requests without a room name or identity to the token function', async () => {
    const { db, runTransaction } = makeDb();
    const next = jest.fn();

    await createIdentityReservationGuard(db, jest.fn(), timestamp)(tokenRequest({ user_identity: 'Ana' }), makeRes(), next);
    await createIdentityReservationGuard(db, jest.fn(), timestamp)(
      tokenRequest({ room_name: 'clase-1', user_identity: '   ' }),
      makeRes(),
      next
    );

    expect(next).toHaveBeenCalledTimes(2);
    expect(runTransaction).not.toHaveBeenCalled();
  });
});
