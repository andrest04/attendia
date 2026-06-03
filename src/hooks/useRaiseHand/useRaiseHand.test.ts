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

  it('cleans up room listeners on unmount', () => {
    const { unmount } = renderHook(() => useRaiseHand());
    expect(mockRoom.listenerCount('participantConnected')).toBe(1);
    unmount();
    expect(mockRoom.listenerCount('participantConnected')).toBe(0);
    expect(mockRoom.listenerCount('participantDisconnected')).toBe(0);
  });
});
