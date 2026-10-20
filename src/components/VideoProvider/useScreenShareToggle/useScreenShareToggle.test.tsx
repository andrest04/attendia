import { renderHook, act } from '@testing-library/react-hooks';
import useScreenShareToggle from './useScreenShareToggle';
import { EventEmitter } from 'events';
import { ErrorCallback } from '../../../types';

const mockLocalParticipant = new EventEmitter() as any;
mockLocalParticipant.publishTrack = jest.fn(() => Promise.resolve('mockPublication'));
mockLocalParticipant.unpublishTrack = jest.fn();

const mockRoom = {
  localParticipant: mockLocalParticipant,
} as any;

const mockOnError: ErrorCallback = () => {};

const mockTrack: any = { kind: 'video', stop: jest.fn() };
const mockAudioTrack: any = { kind: 'audio', stop: jest.fn() };

function mockStream(tracks: any[]) {
  return {
    getTracks: jest.fn(() => tracks),
    getVideoTracks: jest.fn(() => tracks.filter(track => track.kind === 'video')),
    getAudioTracks: jest.fn(() => tracks.filter(track => track.kind === 'audio')),
  };
}

const mockMediaDevices = {
  value: {
    getDisplayMedia: jest.fn(() => Promise.resolve(mockStream([mockTrack]))),
  } as any,
};

Object.defineProperty(navigator, 'mediaDevices', mockMediaDevices);

describe('the useScreenShareToggle hook', () => {
  beforeEach(() => {
    delete mockTrack.onended;
    jest.clearAllMocks();
  });

  it('should return a default value of false', () => {
    const { result } = renderHook(() => useScreenShareToggle(mockRoom, mockOnError));
    expect(result.current).toEqual([false, expect.any(Function)]);
  });

  describe('toggle function', () => {
    it('should call localParticipant.publishTrack with the correct arguments when isSharing is false', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useScreenShareToggle(mockRoom, mockOnError));
      result.current[1]();
      await waitForNextUpdate();
      expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalled();
      expect(mockLocalParticipant.publishTrack).toHaveBeenCalledWith(mockTrack, { name: 'screen', priority: 'low' });
      expect(result.current[0]).toEqual(true);
    });

    it('should not toggle screen sharing when there is no room', async () => {
      const { result } = renderHook(() => useScreenShareToggle(null, mockOnError));
      result.current[1]();
      expect(navigator.mediaDevices.getDisplayMedia).not.toHaveBeenCalled();
      expect(mockLocalParticipant.publishTrack).not.toHaveBeenCalled();
    });

    it('should correctly stop screen sharing when isSharing is true', async () => {
      const localParticipantSpy = jest.spyOn(mockLocalParticipant, 'emit');
      const { result, waitForNextUpdate } = renderHook(() => useScreenShareToggle(mockRoom, mockOnError));
      expect(mockTrack.onended).toBeUndefined();
      result.current[1]();
      await waitForNextUpdate();
      expect(result.current[0]).toEqual(true);
      act(() => {
        result.current[1]();
      });
      expect(mockLocalParticipant.unpublishTrack).toHaveBeenCalledWith(mockTrack);
      expect(localParticipantSpy).toHaveBeenCalledWith('trackUnpublished', 'mockPublication');
      expect(mockTrack.stop).toHaveBeenCalled();
      expect(result.current[0]).toEqual(false);
    });

    it('should ask the browser for the audio of the shared screen or tab', async () => {
      const { result, waitForNextUpdate } = renderHook(() => useScreenShareToggle(mockRoom, mockOnError));
      result.current[1]();
      await waitForNextUpdate();
      expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledWith(
        expect.objectContaining({ video: true, audio: true })
      );
    });

    describe('when the shared screen includes audio', () => {
      beforeEach(() => {
        (navigator.mediaDevices.getDisplayMedia as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve(mockStream([mockTrack, mockAudioTrack]))
        );
        mockLocalParticipant.publishTrack.mockImplementation((track: any) =>
          Promise.resolve(track === mockAudioTrack ? 'mockAudioPublication' : 'mockPublication')
        );
      });

      afterEach(() => {
        mockLocalParticipant.publishTrack.mockImplementation(() => Promise.resolve('mockPublication'));
      });

      it('should publish the video and the audio tracks', async () => {
        const { result, waitForNextUpdate } = renderHook(() => useScreenShareToggle(mockRoom, mockOnError));
        result.current[1]();
        await waitForNextUpdate();
        expect(mockLocalParticipant.publishTrack).toHaveBeenCalledWith(mockTrack, { name: 'screen', priority: 'low' });
        expect(mockLocalParticipant.publishTrack).toHaveBeenCalledWith(mockAudioTrack, { name: 'screen-audio' });
        expect(result.current[0]).toEqual(true);
      });

      it('should unpublish and stop both tracks when screen sharing stops', async () => {
        const localParticipantSpy = jest.spyOn(mockLocalParticipant, 'emit');
        const { result, waitForNextUpdate } = renderHook(() => useScreenShareToggle(mockRoom, mockOnError));
        result.current[1]();
        await waitForNextUpdate();
        act(() => {
          result.current[1]();
        });
        expect(mockLocalParticipant.unpublishTrack).toHaveBeenCalledWith(mockTrack);
        expect(mockLocalParticipant.unpublishTrack).toHaveBeenCalledWith(mockAudioTrack);
        expect(localParticipantSpy).toHaveBeenCalledWith('trackUnpublished', 'mockPublication');
        expect(localParticipantSpy).toHaveBeenCalledWith('trackUnpublished', 'mockAudioPublication');
        expect(mockTrack.stop).toHaveBeenCalled();
        expect(mockAudioTrack.stop).toHaveBeenCalled();
        expect(result.current[0]).toEqual(false);
      });

      it('should keep sharing the screen when the audio track cannot be published', async () => {
        jest.spyOn(console, 'warn').mockImplementationOnce(() => {});
        mockLocalParticipant.publishTrack.mockImplementation((track: any) =>
          track === mockAudioTrack ? Promise.reject(new Error('audio failed')) : Promise.resolve('mockPublication')
        );
        const { result, waitForNextUpdate } = renderHook(() => useScreenShareToggle(mockRoom, mockOnError));
        result.current[1]();
        await waitForNextUpdate();
        expect(result.current[0]).toEqual(true);
        expect(mockAudioTrack.stop).toHaveBeenCalled();
      });
    });

    describe('onended function', () => {
      it('should correctly stop screen sharing when called', async () => {
        const localParticipantSpy = jest.spyOn(mockLocalParticipant, 'emit');
        const { result, waitForNextUpdate } = renderHook(() => useScreenShareToggle(mockRoom, mockOnError));
        expect(mockTrack.onended).toBeUndefined();
        result.current[1]();
        await waitForNextUpdate();
        expect(mockTrack.onended).toEqual(expect.any(Function));
        act(() => {
          mockTrack.onended();
        });
        expect(mockLocalParticipant.unpublishTrack).toHaveBeenCalledWith(mockTrack);
        expect(localParticipantSpy).toHaveBeenCalledWith('trackUnpublished', 'mockPublication');
        expect(mockTrack.stop).toHaveBeenCalled();
        expect(result.current[0]).toEqual(false);
      });
    });
  });
});
