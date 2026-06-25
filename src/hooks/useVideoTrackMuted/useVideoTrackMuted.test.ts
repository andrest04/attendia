import { act, renderHook } from '@testing-library/react-hooks';
import useVideoTrackMuted from './useVideoTrackMuted';

jest.mock('../useMediaStreamTrack/useMediaStreamTrack');

/** Minimal MediaStreamTrack stand-in exposing muted state + mute/unmute events. */
function createFakeMediaStreamTrack(muted = false) {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    muted,
    addEventListener: jest.fn((event: string, cb: () => void) => {
      (listeners[event] = listeners[event] || []).push(cb);
    }),
    removeEventListener: jest.fn((event: string, cb: () => void) => {
      listeners[event] = (listeners[event] || []).filter(fn => fn !== cb);
    }),
    emit(event: string) {
      (listeners[event] || []).forEach(fn => fn());
    },
    listenerCount(event: string) {
      return (listeners[event] || []).length;
    },
  };
}

describe('the useVideoTrackMuted hook', () => {
  it('returns false when there is no track', () => {
    const { result } = renderHook(() => useVideoTrackMuted(undefined));
    expect(result.current).toBe(false);
  });

  it('reflects the initial muted state of the mediaStreamTrack', () => {
    const mediaStreamTrack = createFakeMediaStreamTrack(true);
    const { result } = renderHook(() => useVideoTrackMuted({ mediaStreamTrack } as any));
    expect(result.current).toBe(true);
  });

  it('updates to true on a "mute" event (camera blocked at the source)', () => {
    const mediaStreamTrack = createFakeMediaStreamTrack(false);
    const { result } = renderHook(() => useVideoTrackMuted({ mediaStreamTrack } as any));
    expect(result.current).toBe(false);
    act(() => mediaStreamTrack.emit('mute'));
    expect(result.current).toBe(true);
  });

  it('updates to false on an "unmute" event (camera restored)', () => {
    const mediaStreamTrack = createFakeMediaStreamTrack(true);
    const { result } = renderHook(() => useVideoTrackMuted({ mediaStreamTrack } as any));
    expect(result.current).toBe(true);
    act(() => mediaStreamTrack.emit('unmute'));
    expect(result.current).toBe(false);
  });

  it('cleans up its listeners on unmount', () => {
    const mediaStreamTrack = createFakeMediaStreamTrack(false);
    const { unmount } = renderHook(() => useVideoTrackMuted({ mediaStreamTrack } as any));
    unmount();
    expect(mediaStreamTrack.listenerCount('mute')).toBe(0);
    expect(mediaStreamTrack.listenerCount('unmute')).toBe(0);
  });
});
