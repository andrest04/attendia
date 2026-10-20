import { act, renderHook } from '@testing-library/react-hooks';
import EventEmitter from 'events';
import useProctoringWarnings from './useProctoringWarnings';
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

const warning = (identity: string, kind: string) => JSON.stringify({ type: 'proctoring-warning', identity, kind });

describe('useProctoringWarnings', () => {
  let mockRoom: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRoom = new EventEmitter();
    mockRoom.participants = new Map();
    mockRoom.localParticipant = {
      identity: 'me',
      publishTrack: jest.fn(),
      unpublishTrack: jest.fn(),
    };
    mockedVideoContext.mockImplementation(() => ({ room: mockRoom }));
  });

  it('publishes a data track on mount', () => {
    renderHook(() => useProctoringWarnings());
    expect(mockRoom.localParticipant.publishTrack).toHaveBeenCalledTimes(1);
  });

  it('sendWarning sends a proctoring-warning message targeted at the identity with its kind', () => {
    const { result } = renderHook(() => useProctoringWarnings());
    act(() => result.current.sendWarning('student-bob', 'camera-off'));
    expect(mockSend).toHaveBeenCalledWith(warning('student-bob', 'camera-off'));
  });

  it('bumps the count and records the kind when warned at me', () => {
    const prof = createParticipant('Ana [Profesor]');
    const profData = createDataTrack();
    const { result } = renderHook(() => useProctoringWarnings());
    act(() => {
      mockRoom.emit('participantConnected', prof);
      prof.emit('trackSubscribed', profData);
      profData.emit('message', warning('me', 'multiface'));
    });
    expect(result.current.warnedByProfessorCount).toBe(1);
    expect(result.current.lastWarningKind).toBe('multiface');
  });

  it('ignores a warning sent by a student', () => {
    const student = createParticipant('student-bob');
    const studentData = createDataTrack();
    const { result } = renderHook(() => useProctoringWarnings());
    act(() => {
      mockRoom.emit('participantConnected', student);
      student.emit('trackSubscribed', studentData);
      studentData.emit('message', warning('me', 'multiface'));
    });
    expect(result.current.warnedByProfessorCount).toBe(0);
    expect(result.current.lastWarningKind).toBeNull();
  });

  it('ignores a warning aimed at someone else', () => {
    const prof = createParticipant('Ana [Profesor]');
    const profData = createDataTrack();
    const { result } = renderHook(() => useProctoringWarnings());
    act(() => {
      mockRoom.emit('participantConnected', prof);
      prof.emit('trackSubscribed', profData);
      profData.emit('message', warning('someone-else', 'camera-off'));
    });
    expect(result.current.warnedByProfessorCount).toBe(0);
    expect(result.current.lastWarningKind).toBeNull();
  });

  it('ignores a malformed warning message', () => {
    const prof = createParticipant('Ana [Profesor]');
    const profData = createDataTrack();
    const { result } = renderHook(() => useProctoringWarnings());
    act(() => {
      mockRoom.emit('participantConnected', prof);
      prof.emit('trackSubscribed', profData);
      profData.emit('message', JSON.stringify({ type: 'proctoring-warning', identity: 'me' }));
    });
    expect(result.current.warnedByProfessorCount).toBe(0);
  });

  it('cleans up room listeners on unmount', () => {
    const { unmount } = renderHook(() => useProctoringWarnings());
    expect(mockRoom.listenerCount('participantConnected')).toBe(1);
    unmount();
    expect(mockRoom.listenerCount('participantConnected')).toBe(0);
  });

  it('unpublishes the data track on unmount (after publish settles)', async () => {
    const { unmount } = renderHook(() => useProctoringWarnings());
    unmount();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockRoom.localParticipant.unpublishTrack).toHaveBeenCalled();
  });
});
