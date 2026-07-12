import { renderHook, act } from '@testing-library/react-hooks';
import useCachedIdToken, { REFRESH_INTERVAL_MS } from './useCachedIdToken';

function createUser(tokens: string[]): any {
  let call = 0;
  return {
    getIdToken: jest.fn(() => Promise.resolve(tokens[Math.min(call++, tokens.length - 1)])),
  };
}

describe('useCachedIdToken', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('caches the id token fetched on mount', async () => {
    const user = createUser(['token-1']);
    const { result } = renderHook(() => useCachedIdToken(user));

    await act(async () => {
      await Promise.resolve();
    });

    expect(user.getIdToken).toHaveBeenCalledTimes(1);
    expect(result.current.current).toBe('token-1');
  });

  it('refreshes the cached token every ~10 minutes', async () => {
    const user = createUser(['token-1', 'token-2', 'token-3']);
    const { result } = renderHook(() => useCachedIdToken(user));

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.current).toBe('token-1');

    await act(async () => {
      jest.advanceTimersByTime(REFRESH_INTERVAL_MS);
      await Promise.resolve();
    });
    expect(result.current.current).toBe('token-2');

    await act(async () => {
      jest.advanceTimersByTime(REFRESH_INTERVAL_MS);
      await Promise.resolve();
    });
    expect(result.current.current).toBe('token-3');
  });

  it('clears the cached token when the user signs out', async () => {
    const user = createUser(['token-1']);
    const { result, rerender } = renderHook(({ user: currentUser }) => useCachedIdToken(currentUser), {
      initialProps: { user },
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.current).toBe('token-1');

    rerender({ user: null as any });
    expect(result.current.current).toBeNull();
  });

  it('stops refreshing after unmount', async () => {
    const user = createUser(['token-1', 'token-2']);
    const { result, unmount } = renderHook(() => useCachedIdToken(user));

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.current).toBe('token-1');

    unmount();

    await act(async () => {
      jest.advanceTimersByTime(REFRESH_INTERVAL_MS * 2);
      await Promise.resolve();
    });
    expect(user.getIdToken).toHaveBeenCalledTimes(1);
  });

  it('does not fetch a token when there is no user', () => {
    const { result } = renderHook(() => useCachedIdToken(null));
    expect(result.current.current).toBeNull();
  });

  it('logs and keeps the previous token when a refresh fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const user: any = {
      getIdToken: jest
        .fn()
        .mockResolvedValueOnce('token-1')
        .mockRejectedValueOnce(new Error('network error')),
    };
    const { result } = renderHook(() => useCachedIdToken(user));

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.current).toBe('token-1');

    await act(async () => {
      jest.advanceTimersByTime(REFRESH_INTERVAL_MS);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.current).toBe('token-1');
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
