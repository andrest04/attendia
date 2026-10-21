import { act, renderHook } from '@testing-library/react-hooks';
import EventEmitter from 'events';
import useModeration from './useModeration';
import useVideoContext from '../useVideoContext/useVideoContext';
import useLocalVideoToggle from '../useLocalVideoToggle/useLocalVideoToggle';

jest.mock('../useVideoContext/useVideoContext');
jest.mock('../useLocalVideoToggle/useLocalVideoToggle');

const mockSend = jest.fn();
jest.mock('twilio-video', () => ({
  __esModule: true,
  LocalDataTrack: jest.fn().mockImplementation(() => ({ kind: 'data', send: mockSend, stop: jest.fn() })),
}));

const mockedVideoContext = useVideoContext as jest.Mock<any>;
const mockedLocalVideoToggle = useLocalVideoToggle as jest.Mock<any>;

function createParticipant(identity: string): any {
  const participant: any = new EventEmitter();
  participant.identity = identity;
  participant.tracks = new Map();
  return participant;
}

function createDataTrack(): any {
  const track: any = new EventEmitter();
  track.kind = 'data';
  return track;
}

const muteAudio = (identity: string) => JSON.stringify({ type: 'mute-audio', identity });

describe('useModeration', () => {
  let mockRoom: any;
  let localAudioDisable: jest.Mock;
  let mockToggleVideo: jest.Mock;
  let mockCameraOn = true;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCameraOn = true;
    localAudioDisable = jest.fn();
    mockRoom = new EventEmitter();
    mockRoom.participants = new Map();
    mockRoom.localParticipant = {
      identity: 'me',
      audioTracks: new Map([['a1', { track: { isEnabled: true, disable: localAudioDisable } }]]),
      publishTrack: jest.fn(),
      unpublishTrack: jest.fn(),
    };
    mockedVideoContext.mockImplementation(() => ({ room: mockRoom }));
    mockToggleVideo = jest.fn();
    mockedLocalVideoToggle.mockImplementation(() => [mockCameraOn, mockToggleVideo]);
  });

  it('publishes a data track on mount', () => {
    renderHook(() => useModeration());
    expect(mockRoom.localParticipant.publishTrack).toHaveBeenCalledTimes(1);
  });

  it('muteParticipant sends a mute-audio message targeted at the identity', () => {
    const { result } = renderHook(() => useModeration());
    act(() => result.current.muteParticipant('student-bob'));
    expect(mockSend).toHaveBeenCalledWith(muteAudio('student-bob'));
  });

  it('disables the local audio track and bumps the count when muted at me', () => {
    const prof = createParticipant('Ana [Profesor]');
    const profData = createDataTrack();
    const { result } = renderHook(() => useModeration());
    act(() => {
      mockRoom.emit('participantConnected', prof);
      prof.emit('trackSubscribed', profData);
      profData.emit('message', muteAudio('me'));
    });
    expect(localAudioDisable).toHaveBeenCalledTimes(1);
    expect(result.current.mutedByProfessorCount).toBe(1);
  });

  it('ignores a mute-audio sent by a student', () => {
    const student = createParticipant('student-bob');
    const studentData = createDataTrack();
    const { result } = renderHook(() => useModeration());
    act(() => {
      mockRoom.emit('participantConnected', student);
      student.emit('trackSubscribed', studentData);
      studentData.emit('message', muteAudio('me'));
    });
    expect(localAudioDisable).not.toHaveBeenCalled();
    expect(result.current.mutedByProfessorCount).toBe(0);
  });

  it('does NOT bump the count when the audio was already muted (nothing to silence)', () => {
    // Mic already off → disable() is a no-op and the student should not be notified.
    mockRoom.localParticipant.audioTracks = new Map([
      ['a1', { track: { isEnabled: false, disable: localAudioDisable } }],
    ]);
    const prof = createParticipant('Ana [Profesor]');
    const profData = createDataTrack();
    const { result } = renderHook(() => useModeration());
    act(() => {
      mockRoom.emit('participantConnected', prof);
      prof.emit('trackSubscribed', profData);
      profData.emit('message', muteAudio('me'));
    });
    expect(localAudioDisable).not.toHaveBeenCalled();
    expect(result.current.mutedByProfessorCount).toBe(0);
  });

  it('ignores a mute-audio aimed at someone else', () => {
    const prof = createParticipant('Ana [Profesor]');
    const profData = createDataTrack();
    const { result } = renderHook(() => useModeration());
    act(() => {
      mockRoom.emit('participantConnected', prof);
      prof.emit('trackSubscribed', profData);
      profData.emit('message', muteAudio('someone-else'));
    });
    expect(localAudioDisable).not.toHaveBeenCalled();
    expect(result.current.mutedByProfessorCount).toBe(0);
  });

  it('ignores a malformed moderation message', () => {
    const prof = createParticipant('Ana [Profesor]');
    const profData = createDataTrack();
    const { result } = renderHook(() => useModeration());
    act(() => {
      mockRoom.emit('participantConnected', prof);
      prof.emit('trackSubscribed', profData);
      profData.emit('message', JSON.stringify({ type: 'mute-audio' }));
    });
    expect(localAudioDisable).not.toHaveBeenCalled();
    expect(result.current.mutedByProfessorCount).toBe(0);
  });

  describe('unmute request (T3)', () => {
    const requestUnmute = (identity: string) => JSON.stringify({ type: 'request-unmute', identity });
    let localAudioEnable: jest.Mock;

    function connectTeacher() {
      const prof = createParticipant('Ana [Profesor]');
      const profData = createDataTrack();
      act(() => {
        mockRoom.emit('participantConnected', prof);
        prof.emit('trackSubscribed', profData);
      });
      return profData;
    }

    beforeEach(() => {
      localAudioEnable = jest.fn();
      mockRoom.localParticipant.audioTracks = new Map([
        ['a1', { track: { isEnabled: false, enable: localAudioEnable, disable: localAudioDisable } }],
      ]);
    });

    it('requestUnmute sends a request-unmute message targeted at the identity', () => {
      const { result } = renderHook(() => useModeration());
      act(() => result.current.requestUnmute('student-bob'));
      expect(mockSend).toHaveBeenCalledWith(requestUnmute('student-bob'));
    });

    it('raises a pending request but does NOT enable the mic by itself', () => {
      const { result } = renderHook(() => useModeration());
      const profData = connectTeacher();
      act(() => {
        profData.emit('message', requestUnmute('me'));
      });
      expect(result.current.unmuteRequestPending).toBe(true);
      expect(localAudioEnable).not.toHaveBeenCalled();
    });

    it('acceptUnmuteRequest enables the local mic and clears the request', () => {
      const { result } = renderHook(() => useModeration());
      const profData = connectTeacher();
      act(() => {
        profData.emit('message', requestUnmute('me'));
      });
      act(() => result.current.acceptUnmuteRequest());
      expect(localAudioEnable).toHaveBeenCalledTimes(1);
      expect(result.current.unmuteRequestPending).toBe(false);
    });

    it('dismissUnmuteRequest clears the request without enabling the mic', () => {
      const { result } = renderHook(() => useModeration());
      const profData = connectTeacher();
      act(() => {
        profData.emit('message', requestUnmute('me'));
      });
      act(() => result.current.dismissUnmuteRequest());
      expect(localAudioEnable).not.toHaveBeenCalled();
      expect(result.current.unmuteRequestPending).toBe(false);
    });

    it('ignores a request from a student, aimed at someone else, or when the mic is already on', () => {
      const student = createParticipant('student-bob');
      const studentData = createDataTrack();
      const { result } = renderHook(() => useModeration());
      act(() => {
        mockRoom.emit('participantConnected', student);
        student.emit('trackSubscribed', studentData);
        studentData.emit('message', requestUnmute('me'));
      });
      expect(result.current.unmuteRequestPending).toBe(false);

      const profData = connectTeacher();
      act(() => {
        profData.emit('message', requestUnmute('someone-else'));
      });
      expect(result.current.unmuteRequestPending).toBe(false);

      mockRoom.localParticipant.audioTracks = new Map([
        ['a1', { track: { isEnabled: true, enable: localAudioEnable, disable: localAudioDisable } }],
      ]);
      act(() => {
        profData.emit('message', requestUnmute('me'));
      });
      expect(result.current.unmuteRequestPending).toBe(false);
    });
  });

  describe('screen-share grants (T4)', () => {
    const grant = (identity: string, allowed: boolean) =>
      JSON.stringify({ type: 'grant-screenshare', identity, allowed });

    function connectPeer(identity: string) {
      const peer = createParticipant(identity);
      const data = createDataTrack();
      act(() => {
        mockRoom.emit('participantConnected', peer);
        peer.emit('trackSubscribed', data);
      });
      return { peer, data };
    }

    it('student: defaults to NOT allowed, stores the grant only from the teacher and addressed to me', () => {
      const { result } = renderHook(() => useModeration());
      expect(result.current.screenShareAllowed).toBe(false);

      const student = connectPeer('student-bob');
      act(() => {
        student.data.emit('message', grant('me', true));
      });
      expect(result.current.screenShareAllowed).toBe(false);

      const teacher = connectPeer('Ana [Profesor]');
      act(() => {
        teacher.data.emit('message', grant('someone-else', true));
      });
      expect(result.current.screenShareAllowed).toBe(false);

      act(() => {
        teacher.data.emit('message', grant('me', true));
      });
      expect(result.current.screenShareAllowed).toBe(true);

      act(() => {
        teacher.data.emit('message', grant('me', false));
      });
      expect(result.current.screenShareAllowed).toBe(false);
    });

    it('student: a revoke while sharing stops the share', () => {
      const toggleScreenShare = jest.fn();
      mockedVideoContext.mockImplementation(() => ({ room: mockRoom, isSharingScreen: true, toggleScreenShare }));
      const { result } = renderHook(() => useModeration());
      const teacher = connectPeer('Ana [Profesor]');
      act(() => {
        teacher.data.emit('message', grant('me', true));
      });
      expect(result.current.screenShareAllowed).toBe(true);
      expect(toggleScreenShare).not.toHaveBeenCalled();
      act(() => {
        teacher.data.emit('message', grant('me', false));
      });
      expect(toggleScreenShare).toHaveBeenCalledTimes(1);
    });

    it('teacher: grantScreenShare sends the message and tracks the granted identities', () => {
      mockRoom.localParticipant.identity = 'Ana [Profesor]';
      const { result } = renderHook(() => useModeration());
      act(() => result.current.grantScreenShare('student-bob', true));
      expect(mockSend).toHaveBeenCalledWith(grant('student-bob', true));
      expect(result.current.screenShareGrants).toEqual(['student-bob']);
      act(() => result.current.grantScreenShare('student-bob', false));
      expect(mockSend).toHaveBeenLastCalledWith(grant('student-bob', false));
      expect(result.current.screenShareGrants).toEqual([]);
    });

    it('teacher: re-sends the current grant when a granted student (re)connects', () => {
      mockRoom.localParticipant.identity = 'Ana [Profesor]';
      const { result } = renderHook(() => useModeration());
      act(() => result.current.grantScreenShare('student-bob', true));
      mockSend.mockClear();
      connectPeer('student-carol');
      expect(mockSend).not.toHaveBeenCalled();
      connectPeer('student-bob');
      expect(mockSend).toHaveBeenCalledWith(grant('student-bob', true));
    });
  });

  it('cleans up room listeners on unmount', () => {
    const { unmount } = renderHook(() => useModeration());
    expect(mockRoom.listenerCount('participantConnected')).toBe(1);
    unmount();
    expect(mockRoom.listenerCount('participantConnected')).toBe(0);
    expect(mockRoom.listenerCount('participantDisconnected')).toBe(0);
  });

  it('unpublishes the data track on unmount (after publish settles)', async () => {
    const { unmount } = renderHook(() => useModeration());
    unmount();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockRoom.localParticipant.unpublishTrack).toHaveBeenCalled();
  });

  describe('camera moderation', () => {
    const muteVideo = (identity: string) => JSON.stringify({ type: 'mute-video', identity });
    const requestVideo = (identity: string) => JSON.stringify({ type: 'request-video', identity });

    function connectPeer(identity: string) {
      const peer = createParticipant(identity);
      const data = createDataTrack();
      act(() => {
        mockRoom.emit('participantConnected', peer);
        peer.emit('trackSubscribed', data);
      });
      return data;
    }

    it('muteVideo and requestVideo send messages targeted at the identity', () => {
      const { result } = renderHook(() => useModeration());
      act(() => result.current.muteVideo('student-bob'));
      act(() => result.current.requestVideo('student-bob'));
      expect(mockSend).toHaveBeenCalledWith(muteVideo('student-bob'));
      expect(mockSend).toHaveBeenCalledWith(requestVideo('student-bob'));
    });

    it('turns the camera off through the shared toggle and bumps the count when the teacher mutes video at me', () => {
      const { result } = renderHook(() => useModeration());
      const profData = connectPeer('Ana [Profesor]');
      act(() => {
        profData.emit('message', muteVideo('me'));
      });
      expect(mockToggleVideo).toHaveBeenCalledTimes(1);
      expect(result.current.cameraOffByProfessorCount).toBe(1);
    });

    it('ignores mute-video from a student or aimed at someone else', () => {
      const { result } = renderHook(() => useModeration());
      const studentData = connectPeer('student-bob');
      act(() => {
        studentData.emit('message', muteVideo('me'));
      });
      const profData = connectPeer('Ana [Profesor]');
      act(() => {
        profData.emit('message', muteVideo('someone-else'));
      });
      expect(mockToggleVideo).not.toHaveBeenCalled();
      expect(result.current.cameraOffByProfessorCount).toBe(0);
    });

    it('does nothing on mute-video when the camera is already off', () => {
      mockCameraOn = false;
      const { result } = renderHook(() => useModeration());
      const profData = connectPeer('Ana [Profesor]');
      act(() => {
        profData.emit('message', muteVideo('me'));
      });
      expect(mockToggleVideo).not.toHaveBeenCalled();
      expect(result.current.cameraOffByProfessorCount).toBe(0);
    });

    it('request-video only raises a pending request when the camera is off, and never turns it on by itself', () => {
      mockCameraOn = false;
      const { result } = renderHook(() => useModeration());
      const profData = connectPeer('Ana [Profesor]');
      act(() => {
        profData.emit('message', requestVideo('me'));
      });
      expect(result.current.cameraRequestPending).toBe(true);
      expect(mockToggleVideo).not.toHaveBeenCalled();
    });

    it('ignores request-video when the camera is on', () => {
      const { result } = renderHook(() => useModeration());
      const profData = connectPeer('Ana [Profesor]');
      act(() => {
        profData.emit('message', requestVideo('me'));
      });
      expect(result.current.cameraRequestPending).toBe(false);
    });

    it('ignores request-video from a student or aimed at someone else', () => {
      mockCameraOn = false;
      const { result } = renderHook(() => useModeration());
      const studentData = connectPeer('student-bob');
      const profData = connectPeer('Ana [Profesor]');
      act(() => {
        studentData.emit('message', requestVideo('me'));
        profData.emit('message', requestVideo('someone-else'));
      });
      expect(result.current.cameraRequestPending).toBe(false);
    });

    it('acceptCameraRequest turns the camera on from the click and clears the request; dismiss does not', () => {
      mockCameraOn = false;
      const { result } = renderHook(() => useModeration());
      const profData = connectPeer('Ana [Profesor]');
      act(() => {
        profData.emit('message', requestVideo('me'));
      });
      act(() => result.current.dismissCameraRequest());
      expect(result.current.cameraRequestPending).toBe(false);
      expect(mockToggleVideo).not.toHaveBeenCalled();

      act(() => {
        profData.emit('message', requestVideo('me'));
      });
      act(() => result.current.acceptCameraRequest());
      expect(mockToggleVideo).toHaveBeenCalledTimes(1);
      expect(result.current.cameraRequestPending).toBe(false);
    });
  });
});
