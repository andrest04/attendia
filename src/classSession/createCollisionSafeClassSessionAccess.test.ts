import {
  createClassSessionAccessUnlessOpen,
  createCollisionSafeClassSessionAccess,
} from './createCollisionSafeClassSessionAccess';
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

describe('createClassSessionAccessUnlessOpen', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  const draft = { ...createDefaultClassSessionDraft('Andres Torres'), sessionName: 'Clase de algebra' };
  const mockOpen = (open: boolean) =>
    (global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ open }) }) as any);

  it('creates the access with the clean slug when the room is free', async () => {
    mockOpen(false);

    const result = await createClassSessionAccessUnlessOpen(draft, 'https://example.org');

    expect(result).toEqual({
      status: 'created',
      access: {
        roomName: 'clase-de-algebra',
        joinCode: 'clase-de-algebra',
        joinLink: 'https://example.org/room/clase-de-algebra',
      },
    });
  });

  it('reports the room as already open instead of inventing a suffixed one', async () => {
    mockOpen(true);

    const result = await createClassSessionAccessUnlessOpen(draft, 'https://example.org');

    expect(result).toEqual({ status: 'open', roomName: 'clase-de-algebra' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('treats an inconclusive probe (non-ok response) as free, like the quick-start path', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }) as any;

    const result = await createClassSessionAccessUnlessOpen(draft, 'https://example.org');

    expect(result.status).toBe('created');
  });

  it('treats an inconclusive probe (rejected fetch) as free', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as any;

    const result = await createClassSessionAccessUnlessOpen(draft, 'https://example.org');

    expect(result.status).toBe('created');
  });
});
