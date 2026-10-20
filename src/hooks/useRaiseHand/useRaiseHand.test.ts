import { act, renderHook } from '@testing-library/react-hooks';
import EventEmitter from 'events';
import useRaiseHand from './useRaiseHand';
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

const raiseHand = (raised: boolean) => JSON.stringify({ type: 'raise-hand', raised });
const grantTurn = (identity: string) => JSON.stringify({ type: 'grant-turn', identity });

describe('useRaiseHand', () => {
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
    renderHook(() => useRaiseHand());
    expect(mockRoom.localParticipant.publishTrack).toHaveBeenCalledTimes(1);
  });

  it('sends a raise-hand message and tracks the local hand state', () => {
    const { result } = renderHook(() => useRaiseHand());
    act(() => result.current.setHandRaised(true));
    expect(result.current.isHandRaised).toBe(true);
    expect(mockSend).toHaveBeenCalledWith(raiseHand(true));
  });

  it('adds a remote participant to the queue when they raise their hand', () => {
    const bob = createParticipant('student-bob');
    const bobData = createDataTrack();
    const { result } = renderHook(() => useRaiseHand());
    act(() => {
      mockRoom.emit('participantConnected', bob);
      bob.emit('trackSubscribed', bobData);
      bobData.emit('message', raiseHand(true));
    });
    expect(result.current.raisedHands).toEqual(['student-bob']);
  });

  it('reads hands from a participant whose data track was already subscribed', () => {
    const carol = createParticipant('student-carol');
    const carolData = createDataTrack();
    carol.tracks.set('t1', { track: carolData });
    mockRoom.participants.set(0, carol);
    const { result } = renderHook(() => useRaiseHand());
    act(() => void carolData.emit('message', raiseHand(true)));
    expect(result.current.raisedHands).toEqual(['student-carol']);
  });

  it('removes a participant from the queue when they lower their hand', () => {
    const bob = createParticipant('student-bob');
    const bobData = createDataTrack();
    const { result } = renderHook(() => useRaiseHand());
    act(() => {
      mockRoom.emit('participantConnected', bob);
      bob.emit('trackSubscribed', bobData);
      bobData.emit('message', raiseHand(true));
    });
    act(() => void bobData.emit('message', raiseHand(false)));
    expect(result.current.raisedHands).toEqual([]);
  });

  it('grantTurn sends a grant-turn message and clears that hand from the queue', () => {
    const bob = createParticipant('student-bob');
    const bobData = createDataTrack();
    const { result } = renderHook(() => useRaiseHand());
    act(() => {
      mockRoom.emit('participantConnected', bob);
      bob.emit('trackSubscribed', bobData);
      bobData.emit('message', raiseHand(true));
    });
    act(() => result.current.grantTurn('student-bob'));
    expect(mockSend).toHaveBeenCalledWith(grantTurn('student-bob'));
    expect(result.current.raisedHands).toEqual([]);
  });

  it('lowers the local hand and signals a granted turn when granted to me', () => {
    const prof = createParticipant('Ana [Profesor]');
    const profData = createDataTrack();
    const { result } = renderHook(() => useRaiseHand());
    act(() => result.current.setHandRaised(true));
    act(() => {
      mockRoom.emit('participantConnected', prof);
      prof.emit('trackSubscribed', profData);
      profData.emit('message', grantTurn('me'));
    });
    expect(result.current.isHandRaised).toBe(false);
    expect(result.current.turnGrantedCount).toBe(1);
    expect(mockSend).toHaveBeenCalledWith(raiseHand(false));
  });

  it('ignores a grant-turn sent by a student', () => {
    const student = createParticipant('student-bob');
    const studentData = createDataTrack();
    const { result } = renderHook(() => useRaiseHand());
    act(() => result.current.setHandRaised(true));
    act(() => {
      mockRoom.emit('participantConnected', student);
      student.emit('trackSubscribed', studentData);
      studentData.emit('message', grantTurn('me'));
    });
    expect(result.current.isHandRaised).toBe(true);
    expect(result.current.turnGrantedCount).toBe(0);
  });

  it('ignores a grant-turn aimed at someone else', () => {
    const prof = createParticipant('Ana [Profesor]');
    const profData = createDataTrack();
    const { result } = renderHook(() => useRaiseHand());
    act(() => result.current.setHandRaised(true));
    act(() => {
      mockRoom.emit('participantConnected', prof);
      prof.emit('trackSubscribed', profData);
      profData.emit('message', grantTurn('someone-else'));
    });
    expect(result.current.isHandRaised).toBe(true);
    expect(result.current.turnGrantedCount).toBe(0);
  });

  it('drops a disconnecting participant from the queue', () => {
    const bob = createParticipant('student-bob');
    const bobData = createDataTrack();
    const { result } = renderHook(() => useRaiseHand());
    act(() => {
      mockRoom.emit('participantConnected', bob);
      bob.emit('trackSubscribed', bobData);
      bobData.emit('message', raiseHand(true));
    });
    act(() => void mockRoom.emit('participantDisconnected', bob));
    expect(result.current.raisedHands).toEqual([]);
  });

  it('preserves the raise order when an already-raised hand re-announces on a join', () => {
    // When a new participant connects, every raised student re-broadcasts raise:true
    // so the late joiner can rebuild the queue. That re-announce must NOT move an
    // already-queued hand to the end and corrupt the FIFO raise order (#6 fix).
    const bob = createParticipant('student-bob');
    const bobData = createDataTrack();
    const alice = createParticipant('student-alice');
    const aliceData = createDataTrack();
    const { result } = renderHook(() => useRaiseHand());
    act(() => {
      mockRoom.emit('participantConnected', bob);
      bob.emit('trackSubscribed', bobData);
      bobData.emit('message', raiseHand(true));
      mockRoom.emit('participantConnected', alice);
      alice.emit('trackSubscribed', aliceData);
      aliceData.emit('message', raiseHand(true));
    });
    expect(result.current.raisedHands).toEqual(['student-bob', 'student-alice']);

    // Bob re-announces (as happens when a third participant joins). Order must hold.
    act(() => void bobData.emit('message', raiseHand(true)));

    expect(result.current.raisedHands).toEqual(['student-bob', 'student-alice']);
  });

  it('cleans up room listeners on unmount', () => {
    const { unmount } = renderHook(() => useRaiseHand());
    expect(mockRoom.listenerCount('participantConnected')).toBe(1);
    unmount();
    expect(mockRoom.listenerCount('participantConnected')).toBe(0);
    expect(mockRoom.listenerCount('participantDisconnected')).toBe(0);
  });

  it('re-announces a raised hand when a new participant connects (late-join recovery)', () => {
    const { result } = renderHook(() => useRaiseHand());
    act(() => result.current.setHandRaised(true));
    mockSend.mockClear();

    act(() => void mockRoom.emit('participantConnected', createParticipant('Ana [Profesor]')));

    expect(mockSend).toHaveBeenCalledWith(raiseHand(true));
  });

  it('does not re-announce when the local hand is down', () => {
    renderHook(() => useRaiseHand());
    mockSend.mockClear();

    act(() => void mockRoom.emit('participantConnected', createParticipant('Ana [Profesor]')));

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('ignores a malformed raise-hand message and keeps the existing hand', () => {
    const bob = createParticipant('student-bob');
    const bobData = createDataTrack();
    const { result } = renderHook(() => useRaiseHand());
    act(() => {
      mockRoom.emit('participantConnected', bob);
      bob.emit('trackSubscribed', bobData);
      bobData.emit('message', raiseHand(true));
    });
    expect(result.current.raisedHands).toEqual(['student-bob']);

    act(() => void bobData.emit('message', JSON.stringify({ type: 'raise-hand' })));

    expect(result.current.raisedHands).toEqual(['student-bob']);
  });

  it('does not attach a second message listener to the same data track', () => {
    const bob = createParticipant('student-bob');
    const bobData = createDataTrack();
    bob.tracks.set('t1', { track: bobData });
    mockRoom.participants.set(0, bob);
    renderHook(() => useRaiseHand());

    act(() => void bob.emit('trackSubscribed', bobData));

    expect(bobData.listenerCount('message')).toBe(1);
  });

  it('unpublishes the data track on unmount (after publish settles)', async () => {
    const { unmount } = renderHook(() => useRaiseHand());
    unmount();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockRoom.localParticipant.unpublishTrack).toHaveBeenCalled();
  });
});
