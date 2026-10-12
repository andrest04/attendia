import { act, renderHook } from '@testing-library/react-hooks';
import EventEmitter from 'events';
import useEmitterState from './useEmitterState';

const flag = new EventEmitter() as EventEmitter & { enabled: boolean };

describe('the useEmitterState hook', () => {
  beforeEach(() => {
    flag.removeAllListeners();
    flag.enabled = false;
  });

  const useFlag = (subject: typeof flag | null | undefined) =>
    useEmitterState(subject, s => (s ? s.enabled : false), { enabled: () => true, disabled: () => false });

  it('seeds the state from the subject', () => {
    flag.enabled = true;
    const { result } = renderHook(() => useFlag(flag));
    expect(result.current).toBe(true);
  });

  it('applies the value returned by the handler of each event, without re-reading the subject', () => {
    const { result } = renderHook(() => useFlag(flag));

    act(() => {
      flag.emit('enabled');
    });
    expect(result.current).toBe(true);
    expect(flag.enabled).toBe(false); // the subject itself never changed

    act(() => {
      flag.emit('disabled');
    });
    expect(result.current).toBe(false);
  });

  it('passes the subject and the event arguments to the handler', () => {
    const emitter = new EventEmitter();
    const handler = jest.fn((_subject: unknown, level: number) => level);
    const { result } = renderHook(() => useEmitterState(emitter, () => 0, { level: handler }));

    act(() => {
      emitter.emit('level', 3);
    });

    expect(handler).toHaveBeenCalledWith(emitter, 3);
    expect(result.current).toBe(3);
  });

  it('copes with a missing subject (and reports whatever read() returns for it)', () => {
    const { result } = renderHook(() => useFlag(undefined));
    expect(result.current).toBe(false);
  });

  it('re-syncs and re-subscribes when the subject changes, unsubscribing from the old one', () => {
    const first = new EventEmitter() as typeof flag;
    const second = new EventEmitter() as typeof flag;
    first.enabled = true;
    second.enabled = false;
    const { result, rerender } = renderHook(({ subject }) => useFlag(subject), { initialProps: { subject: first } });
    expect(result.current).toBe(true);

    rerender({ subject: second });
    expect(result.current).toBe(false);
    expect(first.listenerCount('enabled')).toBe(0);
    expect(second.listenerCount('enabled')).toBe(1);

    act(() => {
      first.emit('disabled'); // stale subject: ignored
      second.emit('enabled');
    });
    expect(result.current).toBe(true);
  });

  it('removes every listener on unmount', () => {
    const { unmount } = renderHook(() => useFlag(flag));
    expect(flag.listenerCount('enabled')).toBe(1);
    expect(flag.listenerCount('disabled')).toBe(1);

    unmount();

    expect(flag.listenerCount('enabled')).toBe(0);
    expect(flag.listenerCount('disabled')).toBe(0);
  });

  it('does not re-subscribe when only the inline read/handlers identities change', () => {
    const { rerender } = renderHook(() => useFlag(flag));
    const addListener = jest.spyOn(flag, 'on');

    rerender();
    rerender();

    expect(addListener).not.toHaveBeenCalled();
  });

  it('can start from an explicit initial state instead of reading the subject', () => {
    flag.enabled = true;
    const seen: boolean[] = [];
    const { result } = renderHook(() => {
      const value = useEmitterState(flag, s => (s ? s.enabled : false), {}, { initial: false });
      seen.push(value);
      return value;
    });

    expect(seen[0]).toBe(false); // first render uses `initial`…
    expect(result.current).toBe(true); // …then the effect re-syncs from the subject
  });

  it('also subscribes to DOM EventTargets (addEventListener / removeEventListener)', () => {
    const target = new EventTarget();
    const { result, unmount } = renderHook(() =>
      useEmitterState(target, () => false, { mute: () => true, unmute: () => false })
    );

    act(() => {
      target.dispatchEvent(new Event('mute'));
    });
    expect(result.current).toBe(true);

    act(() => {
      target.dispatchEvent(new Event('unmute'));
    });
    expect(result.current).toBe(false);

    unmount();
    act(() => {
      target.dispatchEvent(new Event('mute'));
    });
    expect(result.current).toBe(false);
  });
});
