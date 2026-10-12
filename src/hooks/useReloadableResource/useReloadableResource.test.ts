import { act, renderHook } from '@testing-library/react-hooks';
import useReloadableResource from './useReloadableResource';

const options = { initial: [] as string[], failureMessage: 'No pudimos cargar.', logLabel: 'test: could not load' };
const flush = () => act(async () => {});

describe('useReloadableResource', () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => errorSpy.mockRestore());

  it('does nothing without a fetcher', () => {
    const { result } = renderHook(() => useReloadableResource(undefined, options));

    expect(result.current).toMatchObject({ data: [], isLoading: false, error: null });
  });

  it('loads on mount and exposes the value', async () => {
    const fetch = jest.fn(() => Promise.resolve(['a', 'b']));
    const { result } = renderHook(() => useReloadableResource(fetch, options));
    expect(result.current.isLoading).toBe(true);

    await flush();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current).toMatchObject({ data: ['a', 'b'], isLoading: false, error: null });
  });

  it('exposes and logs a failure, keeping the initial value', async () => {
    const failure = new Error('Sin conexión.');
    const fetch = jest.fn(() => Promise.reject(failure));
    const { result } = renderHook(() => useReloadableResource(fetch, options));

    await flush();

    expect(result.current).toMatchObject({ data: [], isLoading: false, error: 'Sin conexión.' });
    expect(errorSpy).toHaveBeenCalledWith('test: could not load', failure);
  });

  it('falls back to the configured message', async () => {
    const fetch = jest.fn(() => Promise.reject(new Error('')));
    const { result } = renderHook(() => useReloadableResource(fetch, options));

    await flush();

    expect(result.current.error).toBe('No pudimos cargar.');
  });

  it('reloads on demand, clearing the previous error while it loads', async () => {
    const fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('Falló.'))
      .mockResolvedValueOnce(['ok']);
    const { result } = renderHook(() => useReloadableResource<string[]>(fetch, options));
    await flush();
    expect(result.current.error).toBe('Falló.');

    act(() => result.current.reload());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
    await flush();

    expect(result.current).toMatchObject({ data: ['ok'], isLoading: false, error: null });
  });

  it('loads again when the fetcher changes', async () => {
    const { result, rerender } = renderHook(({ fetch }) => useReloadableResource(fetch, options), {
      initialProps: { fetch: () => Promise.resolve(['uno']) },
    });
    await flush();

    rerender({ fetch: () => Promise.resolve(['dos']) });
    await flush();

    expect(result.current.data).toEqual(['dos']);
  });

  it('lets the screen edit the loaded value locally', async () => {
    const fetch = () => Promise.resolve(['a']);
    const { result } = renderHook(() => useReloadableResource(fetch, options));
    await flush();

    act(() => result.current.setData(current => [...current, 'b']));

    expect(result.current.data).toEqual(['a', 'b']);
  });

  it('can start from null for a value that has not loaded yet', async () => {
    const fetch = () => Promise.resolve(['a'] as string[] | null);
    const { result } = renderHook(() => useReloadableResource<string[] | null>(fetch, { ...options, initial: null }));
    expect(result.current.data).toBeNull();

    await flush();

    expect(result.current.data).toEqual(['a']);
  });
});
