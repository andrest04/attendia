import { createCompleteRoomHandler, RoomCompletingClient, CompleteRoomDatabase } from '../completeRoom';

const makeRes = () => {
  const res: any = { locals: { firebaseUser: { uid: 'uid-1' } } };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
};

// Builds a structural Twilio client whose rooms(name).update() resolves or rejects
// as configured, and records the name/props it was called with.
const makeClient = (update: jest.Mock) => {
  const rooms = jest.fn((_name: string) => ({ update }));
  const client: RoomCompletingClient = { video: { v1: { rooms } } };
  return { client, rooms };
};

// Fake of the minimal Firestore surface the handler uses.
const makeDb = () => {
  const get = jest.fn();
  const doc = jest.fn(() => ({ get }));
  const collection = jest.fn(() => ({ doc }));
  const db = ({ collection } as unknown) as CompleteRoomDatabase;
  return { db, collection, doc, get };
};

describe('createCompleteRoomHandler', () => {
  it('completes the room when the Firestore profile role is teacher', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const { client, rooms } = makeClient(update);
    const { db, get } = makeDb();
    get.mockResolvedValue({ exists: true, data: () => ({ role: 'teacher' }) });
    const handler = createCompleteRoomHandler(client, db);
    const res = makeRes();

    await handler({ body: { room_name: 'clase-1' } } as any, res, undefined as any);

    expect(rooms).toHaveBeenCalledWith('clase-1');
    expect(update).toHaveBeenCalledWith({ status: 'completed' });
    expect(res.json).toHaveBeenCalledWith({ completed: true });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects a student with 403 even when the body identity suffix is spoofed', async () => {
    const update = jest.fn();
    const { client, rooms } = makeClient(update);
    const { db, get } = makeDb();
    get.mockResolvedValue({ exists: true, data: () => ({ role: 'student' }) });
    const handler = createCompleteRoomHandler(client, db);
    const res = makeRes();

    await handler(
      { body: { user_identity: 'Hacker [Profesor]', room_name: 'clase-1' } } as any,
      res,
      undefined as any,
    );

    expect(rooms).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ message: 'not allowed' }) }),
    );
  });

  it('responds 400 when room_name is missing', async () => {
    const update = jest.fn();
    const { client } = makeClient(update);
    const { db, get } = makeDb();
    get.mockResolvedValue({ exists: true, data: () => ({ role: 'teacher' }) });
    const handler = createCompleteRoomHandler(client, db);
    const res = makeRes();

    await handler({ body: {} } as any, res, undefined as any);

    expect(update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('treats a 404 (already completed) as idempotent success', async () => {
    const update = jest.fn().mockRejectedValue({ status: 404 });
    const { client } = makeClient(update);
    const { db, get } = makeDb();
    get.mockResolvedValue({ exists: true, data: () => ({ role: 'teacher' }) });
    const handler = createCompleteRoomHandler(client, db);
    const res = makeRes();

    await handler({ body: { room_name: 'clase-1' } } as any, res, undefined as any);

    expect(res.json).toHaveBeenCalledWith({ completed: true });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('fails closed with 503 on any other Twilio error', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const update = jest.fn().mockRejectedValue({ status: 500 });
    const { client } = makeClient(update);
    const { db, get } = makeDb();
    get.mockResolvedValue({ exists: true, data: () => ({ role: 'teacher' }) });
    const handler = createCompleteRoomHandler(client, db);
    const res = makeRes();

    await handler({ body: { room_name: 'clase-1' } } as any, res, undefined as any);

    expect(res.status).toHaveBeenCalledWith(503);
    consoleError.mockRestore();
  });

  it('returns 401 when the auth middleware did not attach a verified user', async () => {
    const update = jest.fn();
    const { client, rooms } = makeClient(update);
    const { db } = makeDb();
    const handler = createCompleteRoomHandler(client, db);
    const res = makeRes();
    res.locals = {};

    await handler({ body: { room_name: 'clase-1' } } as any, res, undefined as any);

    expect(rooms).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
