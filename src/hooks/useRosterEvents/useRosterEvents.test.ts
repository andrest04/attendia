import { renderHook } from '@testing-library/react-hooks';
import EventEmitter from 'events';
import useRosterEvents from './useRosterEvents';

const makeRoom = (participants: string[] = []): any => {
  const room: any = new EventEmitter();
  room.participants = new Map(participants.map(sid => [sid, { sid }]));
  return room;
};

const makeCallbacks = () => ({ onReset: jest.fn(), onConnected: jest.fn(), onDisconnected: jest.fn() });

describe('the useRosterEvents hook', () => {
  it('resets with the current roster on mount', () => {
    const callbacks = makeCallbacks();
    renderHook(() => useRosterEvents(makeRoom(['a', 'b']), callbacks));
    expect(callbacks.onReset).toHaveBeenCalledWith([{ sid: 'a' }, { sid: 'b' }]);
  });

  it('forwards participantConnected and participantDisconnected', () => {
    const room = makeRoom();
    const callbacks = makeCallbacks();
    renderHook(() => useRosterEvents(room, callbacks));

    room.emit('participantConnected', { sid: 'x' });
    room.emit('participantDisconnected', { sid: 'y' });

    expect(callbacks.onConnected).toHaveBeenCalledWith({ sid: 'x' });
    expect(callbacks.onDisconnected).toHaveBeenCalledWith({ sid: 'y' });
  });

  it('does nothing without a room', () => {
    const callbacks = makeCallbacks();
    renderHook(() => useRosterEvents(null, callbacks));
    expect(callbacks.onReset).not.toHaveBeenCalled();
  });

  it('resets and re-subscribes when the room changes, and cleans up the old room', () => {
    const first = makeRoom(['a']);
    const second = makeRoom(['b']);
    const callbacks = makeCallbacks();
    const { rerender, unmount } = renderHook(({ room }) => useRosterEvents(room, callbacks), {
      initialProps: { room: first },
    });

    rerender({ room: second });
    expect(callbacks.onReset).toHaveBeenLastCalledWith([{ sid: 'b' }]);
    expect(first.listenerCount('participantConnected')).toBe(0);
    expect(second.listenerCount('participantConnected')).toBe(1);

    unmount();
    expect(second.listenerCount('participantConnected')).toBe(0);
    expect(second.listenerCount('participantDisconnected')).toBe(0);
  });

  it('always calls the latest callbacks without re-subscribing', () => {
    const room = makeRoom();
    const first = makeCallbacks();
    const second = makeCallbacks();
    const { rerender } = renderHook(({ callbacks }) => useRosterEvents(room, callbacks), {
      initialProps: { callbacks: first },
    });
    const listeners = room.listenerCount('participantConnected');

    rerender({ callbacks: second });
    room.emit('participantConnected', { sid: 'x' });

    expect(room.listenerCount('participantConnected')).toBe(listeners);
    expect(first.onConnected).not.toHaveBeenCalled();
    expect(second.onConnected).toHaveBeenCalledWith({ sid: 'x' });
  });
});
