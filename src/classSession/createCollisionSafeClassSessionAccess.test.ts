import { createClassSessionAccessUnlessOpen } from './createCollisionSafeClassSessionAccess';
import { createDefaultClassSessionDraft } from './classSessionTypes';

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
