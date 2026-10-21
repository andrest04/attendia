import { act, renderHook } from '@testing-library/react-hooks';
import EventEmitter from 'events';
import useModeration from './useModeration';
import useVideoContext from '../useVideoContext/useVideoContext';

jest.mock('../useVideoContext/useVideoContext');

const mockSend = jest.fn();
jest.mock('twilio-video', () => ({
  __esModule: true,
  LocalDataTrack: jest.fn().mockImplementation(() => ({ kind: 'data', send: mockSend, stop: jest.fn() })),
}));

const mockedVideoContext = useVideoContext as jest.Mock<any>;

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

  beforeEach(() => {
    jest.clearAllMocks();
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
});
