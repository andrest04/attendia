import { checkRoomOpen } from './checkRoomOpen';

describe('checkRoomOpen', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  it('returns true when the server reports the room open', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ open: true }) }) as any;

    await expect(checkRoomOpen('clase-historia')).resolves.toBe(true);
    expect(global.fetch).toHaveBeenCalledWith('/rooms/clase-historia/open', expect.anything());
  });

  it('returns false when the server reports the room closed', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ open: false }) }) as any;

    await expect(checkRoomOpen('missing')).resolves.toBe(false);
  });

  it('encodes the room name in the URL', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ open: true }) }) as any;

    await checkRoomOpen('fisica 101');
    expect(global.fetch).toHaveBeenCalledWith('/rooms/fisica%20101/open', expect.anything());
  });

  it('returns null (inconclusive) on a non-ok response so the caller can fall back', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }) as any;

    await expect(checkRoomOpen('p')).resolves.toBeNull();
  });

  it('returns null when fetch rejects (network failure)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as any;

    await expect(checkRoomOpen('p')).resolves.toBeNull();
  });

  it('returns null when the payload does not carry a boolean open flag', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ nope: 1 }) }) as any;

    await expect(checkRoomOpen('p')).resolves.toBeNull();
  });

  it('returns null without calling fetch for an empty room name', async () => {
    global.fetch = jest.fn() as any;

    await expect(checkRoomOpen('')).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
