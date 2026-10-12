import { renderHook, act } from '@testing-library/react-hooks';
import useAsyncResource from './useAsyncResource';

const options = { failureMessage: 'No pudimos cargarlo.' };

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('useAsyncResource', () => {
  it('stays idle without a loader', () => {
    const { result } = renderHook(() => useAsyncResource<string>(null, options));

    expect(result.current).toEqual({ data: null, error: null });
  });

  it('exposes the loaded value', async () => {
    const load = () => Promise.resolve('hola');
    const { result, waitForNextUpdate } = renderHook(() => useAsyncResource(load, options));

    await waitForNextUpdate();

    expect(result.current).toEqual({ data: 'hola', error: null });
  });

  it('exposes the message of a failure', async () => {
    const load = () => Promise.reject(new Error('Sin permiso.'));
    const { result, waitForNextUpdate } = renderHook(() => useAsyncResource(load, options));

    await waitForNextUpdate();

    expect(result.current).toEqual({ data: null, error: 'Sin permiso.' });
  });

  it('falls back to the configured message when the failure has none', async () => {
    const load = () => Promise.reject(new Error(''));
    const { result, waitForNextUpdate } = renderHook(() => useAsyncResource(load, options));

    await waitForNextUpdate();

    expect(result.current.error).toBe('No pudimos cargarlo.');
  });

  it('falls back to the configured message when the rejection is not an error', async () => {
    const load = () => Promise.reject(undefined);
    const { result, waitForNextUpdate } = renderHook(() => useAsyncResource(load, options));

    await waitForNextUpdate();

    expect(result.current.error).toBe('No pudimos cargarlo.');
  });

  it('loads again when the loader changes', async () => {
    const { result, rerender, waitForNextUpdate } = renderHook(({ load }) => useAsyncResource(load, options), {
      initialProps: { load: () => Promise.resolve('uno') },
    });
    await waitForNextUpdate();
    expect(result.current.data).toBe('uno');

    rerender({ load: () => Promise.resolve('dos') });
    await waitForNextUpdate();

    expect(result.current.data).toBe('dos');
  });

  it('clears a previous error once the next load succeeds', async () => {
    const { result, rerender, waitForNextUpdate } = renderHook(({ load }) => useAsyncResource(load, options), {
      initialProps: { load: () => Promise.reject(new Error('Falló.')) as Promise<string> },
    });
    await waitForNextUpdate();
    expect(result.current.error).toBe('Falló.');

    rerender({ load: () => Promise.resolve('ok') });
    await waitForNextUpdate();

    expect(result.current).toEqual({ data: 'ok', error: null });
  });

  it('settles when a persistently failing loader is recreated on every render', async () => {
    let renders = 0;
    const { result, waitForNextUpdate } = renderHook(() => {
      renders += 1;
      return useAsyncResource(() => Promise.reject(new Error('Falló.')) as Promise<string>, options);
    });
    await waitForNextUpdate();
    await act(async () => {});

    expect(result.current.error).toBe('Falló.');
    expect(renders).toBeLessThan(5);
  });

  it('ignores a response that arrives after unmount', async () => {
    const pending = deferred<string>();
    const dispose = jest.fn();
    const load = () => pending.promise;
    const { result, unmount } = renderHook(() => useAsyncResource(load, { ...options, dispose }));
    unmount();

    await act(async () => pending.resolve('tarde'));

    expect(result.current.data).toBeNull();
    // A value nobody will ever use is released straight away.
    expect(dispose).toHaveBeenCalledWith('tarde');
  });

  it('ignores a response from a loader that was replaced', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const { result, rerender } = renderHook(({ load }) => useAsyncResource(load, options), {
      initialProps: { load: () => first.promise },
    });
    rerender({ load: () => second.promise });

    await act(async () => {
      second.resolve('segundo');
      first.resolve('primero');
    });

    expect(result.current.data).toBe('segundo');
  });

  it('ignores a failure that arrives after unmount', async () => {
    const pending = deferred<string>();
    const load = () => pending.promise;
    const { result, unmount } = renderHook(() => useAsyncResource(load, options));
    unmount();

    await act(async () => pending.reject(new Error('tarde')));

    expect(result.current.error).toBeNull();
  });

  describe('dispose', () => {
    it('releases the loaded value on unmount', async () => {
      const dispose = jest.fn();
      const load = () => Promise.resolve('blob:1');
      const { unmount, waitForNextUpdate } = renderHook(() => useAsyncResource(load, { ...options, dispose }));
      await waitForNextUpdate();
      expect(dispose).not.toHaveBeenCalled();

      unmount();

      expect(dispose).toHaveBeenCalledTimes(1);
      expect(dispose).toHaveBeenCalledWith('blob:1');
    });

    it('releases the previous value when the loader changes', async () => {
      const dispose = jest.fn();
      const { rerender, waitForNextUpdate } = renderHook(
        ({ load }) => useAsyncResource(load, { ...options, dispose }),
        {
          initialProps: { load: () => Promise.resolve('blob:1') },
        }
      );
      await waitForNextUpdate();

      rerender({ load: () => Promise.resolve('blob:2') });
      await waitForNextUpdate();

      expect(dispose).toHaveBeenCalledWith('blob:1');
      expect(dispose).not.toHaveBeenCalledWith('blob:2');
    });

    it('does not release anything when the load failed', async () => {
      const dispose = jest.fn();
      const load = () => Promise.reject(new Error('x')) as Promise<string>;
      const { unmount, waitForNextUpdate } = renderHook(() => useAsyncResource(load, { ...options, dispose }));
      await waitForNextUpdate();

      unmount();

      expect(dispose).not.toHaveBeenCalled();
    });
  });
});
