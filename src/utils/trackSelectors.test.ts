import { isScreenShareName, SCREEN_SHARE_TRACK_NAME, selectAudioTrack, selectCameraTrack } from './trackSelectors';

const track = (kind: 'audio' | 'video', name: string): any => ({ kind, name });

describe('trackSelectors', () => {
  it('recognizes the screen share by the name it is published with', () => {
    expect(SCREEN_SHARE_TRACK_NAME).toBe('screen');
    expect(isScreenShareName('screen')).toBe(true);
    expect(isScreenShareName('my-screen-share')).toBe(true);
    expect(isScreenShareName('camera-123')).toBe(false);
  });

  it('selects the camera as the video track that is not the screen share', () => {
    const screen = track('video', 'screen');
    const camera = track('video', 'camera-1');

    expect(selectCameraTrack([screen, camera])).toBe(camera);
    expect(selectCameraTrack([camera, screen])).toBe(camera);
  });

  it('has no camera when only the screen share or only audio is present', () => {
    expect(selectCameraTrack([track('video', 'screen')])).toBeUndefined();
    expect(selectCameraTrack([track('audio', 'mic')])).toBeUndefined();
    expect(selectCameraTrack([])).toBeUndefined();
  });

  it('selects the microphone', () => {
    const mic = track('audio', 'mic');
    expect(selectAudioTrack([track('video', 'camera-1'), mic])).toBe(mic);
    expect(selectAudioTrack([track('video', 'camera-1')])).toBeUndefined();
  });
});
