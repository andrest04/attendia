import { renderHook } from '@testing-library/react-hooks';
import { LocalVideoTrack } from 'twilio-video';
import useLightingCheck from './useLightingCheck';

function mockTrack() {
  const videoEl = document.createElement('video');
  return ({
    attach: jest.fn(() => videoEl),
    detach: jest.fn(() => [videoEl]),
  } as unknown) as LocalVideoTrack;
}

describe('useLightingCheck', () => {
  it('reports analyzing with null luminance when no track is provided', () => {
    const { result } = renderHook(() => useLightingCheck(undefined));
    expect(result.current.status).toBe('analyzing');
    expect(result.current.luminance).toBeNull();
  });

  it('attaches the track while mounted and detaches it on cleanup', () => {
    const track = mockTrack();
    const { unmount } = renderHook(() => useLightingCheck(track));
    expect(track.attach).toHaveBeenCalledTimes(1);

    unmount();
    expect(track.detach).toHaveBeenCalledTimes(1);
  });

  it('stays in analyzing when no 2D context is available (no false negative)', () => {
    // jsdom has no real canvas 2D context, so sampling yields no luminance.
    const track = mockTrack();
    const { result } = renderHook(() => useLightingCheck(track));
    expect(result.current.status).toBe('analyzing');
  });
});
