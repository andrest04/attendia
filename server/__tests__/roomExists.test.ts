import { createRoomExists } from '../roomExists';

const makeClient = (fetchImpl: () => Promise<unknown>, rooms = jest.fn(() => ({ fetch: fetchImpl }))) =>
  ({ video: { rooms } } as any);

describe('createRoomExists', () => {
  it('returns true when the room can be fetched (in-progress room exists)', async () => {
    const roomExists = createRoomExists(makeClient(() => Promise.resolve({ sid: 'RM1', status: 'in-progress' })));
    await expect(roomExists('p')).resolves.toBe(true);
  });

  it('returns false when Twilio responds 404 (no in-progress room with that unique name)', async () => {
    const notFound: any = new Error('not found');
    notFound.status = 404;
    const roomExists = createRoomExists(makeClient(() => Promise.reject(notFound)));
    await expect(roomExists('missing')).resolves.toBe(false);
  });

  it('rethrows non-404 errors so the guard can fail closed (503)', async () => {
    const serverError: any = new Error('twilio 500');
    serverError.status = 500;
    const roomExists = createRoomExists(makeClient(() => Promise.reject(serverError)));
    await expect(roomExists('p')).rejects.toThrow('twilio 500');
  });

  it('rethrows errors with no status (e.g. network failure)', async () => {
    const roomExists = createRoomExists(makeClient(() => Promise.reject(new Error('ECONNRESET'))));
    await expect(roomExists('p')).rejects.toThrow('ECONNRESET');
  });

  it('looks up the room by its unique name', async () => {
    const rooms = jest.fn(() => ({ fetch: () => Promise.resolve({}) }));
    const roomExists = createRoomExists(makeClient(() => Promise.resolve({}), rooms));
    await roomExists('clase-historia');
    expect(rooms).toHaveBeenCalledWith('clase-historia');
  });
});
