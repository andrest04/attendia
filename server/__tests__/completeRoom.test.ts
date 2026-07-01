import { createCompleteRoomHandler, RoomCompletingClient } from '../completeRoom';

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

// Builds a structural Twilio client whose rooms(name).update() resolves or rejects
// as configured, and records the name/props it was called with.
const makeClient = (update: jest.Mock) => {
  const rooms = jest.fn((_name: string) => ({ update }));
  const client: RoomCompletingClient = { video: { v1: { rooms } } };
  return { client, rooms };
};

describe('createCompleteRoomHandler', () => {
  it('completes the room for a teacher and reports success', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const { client, rooms } = makeClient(update);
    const handler = createCompleteRoomHandler(client);
    const res = makeRes();

    await handler({ body: { user_identity: 'Ana [Profesor]', room_name: 'clase-1' } } as any, res, undefined as any);

    expect(rooms).toHaveBeenCalledWith('clase-1');
    expect(update).toHaveBeenCalledWith({ status: 'completed' });
    expect(res.json).toHaveBeenCalledWith({ completed: true });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects a student with 403 and never touches the room', async () => {
    const update = jest.fn();
    const { client, rooms } = makeClient(update);
    const handler = createCompleteRoomHandler(client);
    const res = makeRes();

    await handler({ body: { user_identity: 'María', room_name: 'clase-1' } } as any, res, undefined as any);

    expect(rooms).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ message: 'not allowed' }) })
    );
  });

  it('responds 400 when room_name is missing', async () => {
    const update = jest.fn();
    const { client } = makeClient(update);
    const handler = createCompleteRoomHandler(client);
    const res = makeRes();

    await handler({ body: { user_identity: 'Ana [Profesor]' } } as any, res, undefined as any);

    expect(update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('treats a 404 (already completed) as idempotent success', async () => {
    const update = jest.fn().mockRejectedValue({ status: 404 });
    const { client } = makeClient(update);
    const handler = createCompleteRoomHandler(client);
    const res = makeRes();

    await handler({ body: { user_identity: 'Ana [Profesor]', room_name: 'clase-1' } } as any, res, undefined as any);

    expect(res.json).toHaveBeenCalledWith({ completed: true });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('fails closed with 503 on any other Twilio error', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const update = jest.fn().mockRejectedValue({ status: 500 });
    const { client } = makeClient(update);
    const handler = createCompleteRoomHandler(client);
    const res = makeRes();

    await handler({ body: { user_identity: 'Ana [Profesor]', room_name: 'clase-1' } } as any, res, undefined as any);

    expect(res.status).toHaveBeenCalledWith(503);
    consoleError.mockRestore();
  });
});
