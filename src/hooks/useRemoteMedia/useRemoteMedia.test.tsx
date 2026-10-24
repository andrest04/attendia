import { act, renderHook } from '@testing-library/react-hooks';
import EventEmitter from 'events';
import useRemoteMedia from './useRemoteMedia';
import useParticipants from '../useParticipants/useParticipants';

jest.mock('../useParticipants/useParticipants');
const mockUseParticipants = useParticipants as jest.Mock;

function makeParticipant(identity: string) {
  const participant: any = new EventEmitter();
  participant.identity = identity;
  participant.tracks = new Map();
  return participant;
}

describe('useRemoteMedia', () => {
  it('is undefined for someone who is not in the room', () => {
    mockUseParticipants.mockReturnValue([]);
    const { result } = renderHook(() => useRemoteMedia('Ana'));
    expect(result.current).toBeUndefined();
  });

  it('follows the participant’s mic and camera', () => {
    const ana = makeParticipant('Ana');
    ana.tracks.set('a', { kind: 'audio', trackName: 'microphone', isTrackEnabled: true });
    mockUseParticipants.mockReturnValue([ana]);
    const { result } = renderHook(() => useRemoteMedia('Ana'));
    expect(result.current).toEqual({ micOn: true, cameraOn: false });

    act(() => {
      ana.tracks.get('a').isTrackEnabled = false;
      ana.tracks.set('v', { kind: 'video', trackName: 'camera-1', isTrackEnabled: true });
      ana.emit('trackDisabled');
    });
    expect(result.current).toEqual({ micOn: false, cameraOn: true });
  });

  it('ignores a screen share when deciding whether the camera is on', () => {
    const ana = makeParticipant('Ana');
    ana.tracks.set('s', { kind: 'video', trackName: 'screen-1', isTrackEnabled: true });
    mockUseParticipants.mockReturnValue([ana]);
    const { result } = renderHook(() => useRemoteMedia('Ana'));
    expect(result.current?.cameraOn).toBe(false);
  });
});
