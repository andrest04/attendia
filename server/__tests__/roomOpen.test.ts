import { createRoomOpenHandler } from '../roomOpen';
import type { RoomExistenceChecker } from '../roomExists';

const makeRes = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('createRoomOpenHandler', () => {
  let roomExists: jest.MockedFunction<RoomExistenceChecker>;

  beforeEach(() => {
    roomExists = jest.fn();
  });

  it('reports { open: true } when an in-progress room exists', async () => {
    roomExists.mockResolvedValue(true);
    const handler = createRoomOpenHandler(roomExists);
    const res = makeRes();

    await handler({ params: { roomName: 'clase-historia' } } as any, res, jest.fn());

    expect(roomExists).toHaveBeenCalledWith('clase-historia');
    expect(res.json).toHaveBeenCalledWith({ open: true });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('reports { open: false } when the room is not open (and never creates it)', async () => {
    roomExists.mockResolvedValue(false);
    const handler = createRoomOpenHandler(roomExists);
    const res = makeRes();

    await handler({ params: { roomName: 'missing' } } as any, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({ open: false });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responds 400 when roomName is missing', async () => {
    const handler = createRoomOpenHandler(roomExists);
    const res = makeRes();

    await handler({ params: {} } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(roomExists).not.toHaveBeenCalled();
  });

  it('responds 503 when the existence check fails (fails loud, never assumes closed)', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    roomExists.mockRejectedValue(new Error('twilio down'));
    const handler = createRoomOpenHandler(roomExists);
    const res = makeRes();

    await handler({ params: { roomName: 'p' } } as any, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ open: expect.anything() }));
    consoleError.mockRestore();
  });
});
