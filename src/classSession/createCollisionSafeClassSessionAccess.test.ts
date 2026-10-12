import { createCollisionSafeClassSessionAccess } from './createCollisionSafeClassSessionAccess';
import { createDefaultClassSessionDraft } from './classSessionTypes';

describe('createCollisionSafeClassSessionAccess', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  const draft = { ...createDefaultClassSessionDraft('Andres Torres'), sessionName: 'Clase de algebra' };

  it('returns the clean base slug unchanged when the room is not open', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ open: false }) }) as any;

    const access = await createCollisionSafeClassSessionAccess(draft, 'https://example.org');

    expect(access.roomName).toBe('clase-de-algebra');
    expect(access.joinCode).toBe('clase-de-algebra');
    expect(access.joinLink).toBe('https://example.org/room/clase-de-algebra');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('appends a random suffix when the base slug collides once, then resolves', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ open: true }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ open: false }) }) as any;

    const access = await createCollisionSafeClassSessionAccess(draft, 'https://example.org');

    expect(access.roomName).toMatch(/^clase-de-algebra-[a-z0-9]+$/);
    expect(access.joinCode).toBe(access.roomName);
    expect(access.joinLink).toBe(`https://example.org/room/${access.roomName}`);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('gives up after MAX_DISAMBIGUATION_ATTEMPTS when every candidate collides', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ open: true }) }) as any;

    const access = await createCollisionSafeClassSessionAccess(draft, 'https://example.org');

    expect(access.roomName).toMatch(/^clase-de-algebra-[a-z0-9]+$/);
    expect(global.fetch).toHaveBeenCalledTimes(5);
  });

  it('treats an inconclusive probe (non-ok response) as safe and keeps the base slug', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }) as any;

    const access = await createCollisionSafeClassSessionAccess(draft, 'https://example.org');

    expect(access.roomName).toBe('clase-de-algebra');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('treats an inconclusive probe (rejected fetch) as safe and keeps the base slug', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as any;

    const access = await createCollisionSafeClassSessionAccess(draft, 'https://example.org');

    expect(access.roomName).toBe('clase-de-algebra');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
