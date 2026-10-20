import { createRoomOwnerStatusHandler } from '../roomOwnerStatus';
import { roomOwnerKey } from '../roomOwnership';

const makeRes = (uid = 'uid-1') => {
  const res: any = { locals: { firebaseUser: { uid } } };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
};

// users/{uid} profile + roomOwners/{key}; `ownerData` undefined = no owner doc.
const makeDb = (role: string, ownerData?: { uid: string }) => {
  const owners: { [id: string]: any } = ownerData ? { [roomOwnerKey('clase-1')]: ownerData } : {};
  const collection = jest.fn((name: string) => ({
    doc: (id: string) => ({
      get: async () => {
        if (name === 'users') return { exists: true, data: () => ({ role }) };
        const data = owners[id];
        return { exists: !!data, data: () => data };
      },
    }),
  }));
  return { collection } as any;
};

describe('createRoomOwnerStatusHandler', () => {
  it('reports isOwner true for the room owner', async () => {
    const res = makeRes('uid-1');
    await createRoomOwnerStatusHandler(makeDb('teacher', { uid: 'uid-1' }))(
      { params: { roomName: 'clase-1' } } as any,
      res,
      undefined as any
    );
    expect(res.json).toHaveBeenCalledWith({ isOwner: true });
  });

  it('reports isOwner false for a co-teacher (another uid owns the room)', async () => {
    const res = makeRes('uid-2');
    await createRoomOwnerStatusHandler(makeDb('teacher', { uid: 'uid-1' }))(
      { params: { roomName: 'clase-1' } } as any,
      res,
      undefined as any
    );
    expect(res.json).toHaveBeenCalledWith({ isOwner: false });
  });

  it('does not report co-teacher when the room has no owner doc yet', async () => {
    const res = makeRes('uid-2');
    await createRoomOwnerStatusHandler(makeDb('teacher'))(
      { params: { roomName: 'clase-1' } } as any,
      res,
      undefined as any
    );
    expect(res.json).toHaveBeenCalledWith({ isOwner: true });
  });

  it('refuses a non-teacher with 403', async () => {
    const res = makeRes('uid-2');
    await createRoomOwnerStatusHandler(makeDb('student', { uid: 'uid-1' }))(
      { params: { roomName: 'clase-1' } } as any,
      res,
      undefined as any
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).not.toHaveBeenCalledWith({ isOwner: true });
  });

  it('answers 401 without a verified user', async () => {
    const res: any = { locals: {} };
    res.status = jest.fn(() => res);
    res.send = jest.fn(() => res);
    await createRoomOwnerStatusHandler(makeDb('teacher'))(
      { params: { roomName: 'clase-1' } } as any,
      res,
      undefined as any
    );
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('answers 503 when Firestore fails', async () => {
    const res = makeRes();
    const db: any = {
      collection: () => ({
        doc: () => ({
          get: async () => {
            throw new Error('down');
          },
        }),
      }),
    };
    await createRoomOwnerStatusHandler(db)({ params: { roomName: 'clase-1' } } as any, res, undefined as any);
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
