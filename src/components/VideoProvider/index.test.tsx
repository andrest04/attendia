import { EventEmitter } from 'events';
import React, { useEffect } from 'react';
import { renderHook } from '@testing-library/react-hooks';
import { Room, TwilioError } from 'twilio-video';
import { VideoProvider } from './index';
import { useAppState } from '../../state';
import useLocalTracks from './useLocalTracks/useLocalTracks';
import useRestartAudioTrackOnDeviceChange from './useRestartAudioTrackOnDeviceChange/useRestartAudioTrackOnDeviceChange';
import useRoom from './useRoom/useRoom';
import useHandleRoomDisconnection from './useHandleRoomDisconnection/useHandleRoomDisconnection';
import useHandleTrackPublicationFailed from './useHandleTrackPublicationFailed/useHandleTrackPublicationFailed';
import { clearRejoinSession } from '../../classSession/rejoinSession';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';

const mockRoom = new EventEmitter() as Room;

jest.mock('./useRoom/useRoom', () => jest.fn(() => ({ room: mockRoom, isConnecting: false, connect: () => {} })));
jest.mock('./useLocalTracks/useLocalTracks', () =>
  jest.fn(() => ({
    localTracks: [{ name: 'mockTrack' }],
    getLocalVideoTrack: () => {},
    getLocalAudioTrack: () => {},
    isAcquiringLocalTracks: true,
    removeLocalAudioTrack: () => {},
    removeLocalVideoTrack: () => {},
  }))
);
jest.mock('../../state');
jest.mock('./useHandleRoomDisconnection/useHandleRoomDisconnection');
jest.mock('../../classSession/rejoinSession', () => ({ clearRejoinSession: jest.fn() }));
jest.mock('./useHandleTrackPublicationFailed/useHandleTrackPublicationFailed');
jest.mock('./useRestartAudioTrackOnDeviceChange/useRestartAudioTrackOnDeviceChange');
jest.mock('@twilio/video-processors', () => {
  return {
    GaussianBlurBackgroundProcessor: jest.fn().mockImplementation(() => {
      return {
        loadModel: jest.fn(),
      };
    }),
  };
});

const mockUseAppState = useAppState as jest.Mock<any>;

mockUseAppState.mockImplementation(() => ({ isGalleryViewActive: false }));

describe('the VideoProvider component', () => {
  it('should correctly return the Video Context object', () => {
    const wrapper: React.FC = ({ children }) => (
      <VideoProvider onError={() => {}} options={{ dominantSpeaker: true }}>
        {children}
      </VideoProvider>
    );
    const { result } = renderHook(useVideoContext, { wrapper });
    const expectedSettings = {
      type: 'none',
      index: 0,
    };
    expect(result.current).toMatchObject({
      isConnecting: false,
      localTracks: [{ name: 'mockTrack' }],
      room: mockRoom,
      onError: expect.any(Function),
      connect: expect.any(Function),
      getLocalVideoTrack: expect.any(Function),
      removeLocalVideoTrack: expect.any(Function),
      isAcquiringLocalTracks: true,
      toggleScreenShare: expect.any(Function),
      isBackgroundSelectionOpen: false,
      setIsBackgroundSelectionOpen: expect.any(Function),
      backgroundSettings: expectedSettings,
      setBackgroundSettings: expect.any(Function),
    });
    expect(useRoom).toHaveBeenCalledWith([{ name: 'mockTrack' }], expect.any(Function), {
      dominantSpeaker: true,
    });
    expect(useLocalTracks).toHaveBeenCalled();
    expect(useHandleRoomDisconnection).toHaveBeenCalledWith(
      mockRoom,
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      false,
      expect.any(Function)
    );
    expect(useHandleTrackPublicationFailed).toHaveBeenCalledWith(mockRoom, expect.any(Function));
    expect(useRestartAudioTrackOnDeviceChange).toHaveBeenCalledWith(result.current.localTracks);
  });

  it('should call the onError function when there is an error', () => {
    const mockOnError = jest.fn();
    const wrapper: React.FC = ({ children }) => (
      <VideoProvider onError={mockOnError} options={{ dominantSpeaker: true }}>
        {children}
      </VideoProvider>
    );
    const { result } = renderHook(useVideoContext, { wrapper });
    result.current.onError({} as TwilioError);
    expect(mockOnError).toHaveBeenCalledWith({});
  });

  describe('when the room is completed (TwilioError 53118)', () => {
    const roomCompleted = { code: 53118, message: 'Room completed' } as TwilioError;
    const setEnded = jest.fn();

    function disconnectionOnError(identity: string, onError: jest.Mock) {
      (mockRoom as any).localParticipant = { identity };
      mockUseAppState.mockImplementation(() => ({ isGalleryViewActive: false, setSessionEndedByProfessor: setEnded }));
      const wrapper: React.FC = ({ children }) => (
        <VideoProvider onError={onError} options={{ dominantSpeaker: true }}>
          {children}
        </VideoProvider>
      );
      renderHook(useVideoContext, { wrapper });
      const calls = (useHandleRoomDisconnection as jest.Mock).mock.calls;
      return calls[calls.length - 1][1] as (error: TwilioError) => void;
    }

    beforeEach(() => jest.clearAllMocks());
    afterAll(() => mockUseAppState.mockImplementation(() => ({ isGalleryViewActive: false })));

    it('shows a student the ended screen instead of the error dialog', () => {
      const onError = jest.fn();
      disconnectionOnError('student-bob', onError)(roomCompleted);
      expect(setEnded).toHaveBeenCalledWith(true);
      expect(clearRejoinSession).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('does not treat it specially for a teacher', () => {
      const onError = jest.fn();
      disconnectionOnError('Ana [Profesor]', onError)(roomCompleted);
      expect(setEnded).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(roomCompleted);
    });

    it('still reports other disconnection errors to a student', () => {
      const onError = jest.fn();
      const other = { code: 53000, message: 'Signaling connection error' } as TwilioError;
      disconnectionOnError('student-bob', onError)(other);
      expect(setEnded).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(other);
    });
  });

  describe('when a newer connection replaces this one (TwilioError 53205)', () => {
    const replaced = { code: 53205, message: 'Participant disconnected because of duplicate identity' } as TwilioError;
    const setEnded = jest.fn();

    function renderProvider(identity: string, onError: jest.Mock, children: React.ReactNode = null) {
      (mockRoom as any).localParticipant = { identity };
      mockUseAppState.mockImplementation(() => ({ isGalleryViewActive: false, setSessionEndedByProfessor: setEnded }));
      const wrapper: React.FC = ({ children: hookChild }) => (
        <VideoProvider onError={onError} options={{ dominantSpeaker: true }}>
          {children}
          {hookChild}
        </VideoProvider>
      );
      const { unmount } = renderHook(useVideoContext, { wrapper });
      const calls = (useHandleRoomDisconnection as jest.Mock).mock.calls;
      return { unmount, onDisconnectError: calls[calls.length - 1][1] as (error: TwilioError) => void };
    }

    beforeEach(() => jest.clearAllMocks());
    afterAll(() => mockUseAppState.mockImplementation(() => ({ isGalleryViewActive: false })));

    it.each([
      ['student', 'student-bob'],
      ['teacher', 'Ana [Profesor]'],
    ])('clears the rejoin session and reports the error to a %s', (_, identity) => {
      const onError = jest.fn();
      const { unmount, onDisconnectError } = renderProvider(identity, onError);

      mockRoom.emit('disconnected', mockRoom, replaced);
      onDisconnectError(replaced);

      expect(clearRejoinSession).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(replaced);
      expect(setEnded).not.toHaveBeenCalled();
      unmount();
    });

    // The lobby mounts from a descendant's 'disconnected' listener (useRoomState) and useAutoRejoin
    // reads the session there, so clearing any later would let this tab reconnect and kick the newer one.
    it('clears the session before any descendant hears the disconnection', () => {
      let clearsSeenByDescendant = -1;
      const Descendant = () => {
        useEffect(() => {
          const listener = () => {
            clearsSeenByDescendant = (clearRejoinSession as jest.Mock).mock.calls.length;
          };
          mockRoom.on('disconnected', listener);
          return () => {
            mockRoom.off('disconnected', listener);
          };
        }, []);
        return null;
      };
      const { unmount } = renderProvider('student-bob', jest.fn(), <Descendant />);

      mockRoom.emit('disconnected', mockRoom, replaced);

      expect(clearsSeenByDescendant).toBe(1);
      unmount();
    });

    it('keeps the rejoin session on any other disconnection', () => {
      const { unmount } = renderProvider('student-bob', jest.fn());

      mockRoom.emit('disconnected', mockRoom, { code: 53000, message: 'Signaling connection error' });
      mockRoom.emit('disconnected', mockRoom);

      expect(clearRejoinSession).not.toHaveBeenCalled();
      unmount();
    });
  });
});
