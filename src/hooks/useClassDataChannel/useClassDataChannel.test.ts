import { act, renderHook } from '@testing-library/react-hooks';
import EventEmitter from 'events';
import { LocalDataTrack } from 'twilio-video';
import useClassDataChannel from './useClassDataChannel';
import useVideoContext from '../useVideoContext/useVideoContext';

jest.mock('../useVideoContext/useVideoContext');

const mockSend = jest.fn();
jest.mock('twilio-video', () => ({
  __esModule: true,
  LocalDataTrack: jest.fn().mockImplementation(() => ({ kind: 'data', send: mockSend, stop: jest.fn() })),
}));

const mockedVideoContext = useVideoContext as jest.Mock<any>;
const MockLocalDataTrack = (LocalDataTrack as unknown) as jest.Mock;

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

describe('useClassDataChannel', () => {
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
    renderHook(() => useClassDataChannel({ onMessage: jest.fn() }));
    expect(mockRoom.localParticipant.publishTrack).toHaveBeenCalledTimes(1);
  });

  it('constructs the data track with no options by default (reliable track)', () => {
    renderHook(() => useClassDataChannel({ onMessage: jest.fn() }));
    expect(MockLocalDataTrack).toHaveBeenCalledTimes(1);
    expect(MockLocalDataTrack.mock.calls[0]).toEqual([]);
  });

  it('passes trackOptions through to the LocalDataTrack constructor', () => {
    renderHook(() =>
      useClassDataChannel({ trackOptions: { ordered: false, maxRetransmits: 0 }, onMessage: jest.fn() })
    );
    expect(MockLocalDataTrack).toHaveBeenCalledWith({ ordered: false, maxRetransmits: 0 });
  });

  it('send() serializes the payload and writes it to the data track', () => {
    const { result } = renderHook(() => useClassDataChannel<{ type: string; n: number }>({ onMessage: jest.fn() }));
    act(() => result.current.send({ type: 'ping', n: 7 }));
    expect(mockSend).toHaveBeenCalledWith(JSON.stringify({ type: 'ping', n: 7 }));
  });

  it('send() swallows errors when the track is not ready', () => {
    mockSend.mockImplementationOnce(() => {
      throw new Error('not connected');
    });
    const { result } = renderHook(() => useClassDataChannel({ onMessage: jest.fn() }));
    expect(() => act(() => result.current.send({ type: 'ping' }))).not.toThrow();
  });

  it('parses an incoming JSON message and dispatches it with the sending participant', () => {
    const onMessage = jest.fn();
    const bob = createParticipant('student-bob');
    const bobData = createDataTrack();
    renderHook(() => useClassDataChannel({ onMessage }));
    act(() => {
      mockRoom.emit('participantConnected', bob);
      bob.emit('trackSubscribed', bobData);
      bobData.emit('message', JSON.stringify({ type: 'hello', value: 1 }));
    });
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith({ type: 'hello', value: 1 }, bob);
  });

  it('reads from a participant whose data track was already subscribed on mount', () => {
    const onMessage = jest.fn();
    const carol = createParticipant('student-carol');
    const carolData = createDataTrack();
    carol.tracks.set('t1', { track: carolData });
    mockRoom.participants.set(0, carol);
    renderHook(() => useClassDataChannel({ onMessage }));
    act(() => void carolData.emit('message', JSON.stringify({ type: 'hi' })));
    expect(onMessage).toHaveBeenCalledWith({ type: 'hi' }, carol);
  });

  it('ignores non-string and non-JSON messages', () => {
    const onMessage = jest.fn();
    const bob = createParticipant('student-bob');
    const bobData = createDataTrack();
    renderHook(() => useClassDataChannel({ onMessage }));
    act(() => {
      mockRoom.emit('participantConnected', bob);
      bob.emit('trackSubscribed', bobData);
      bobData.emit('message', { not: 'a string' });
      bobData.emit('message', 'not-json');
    });
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('does not attach a second message listener to the same data track', () => {
    const bob = createParticipant('student-bob');
    const bobData = createDataTrack();
    bob.tracks.set('t1', { track: bobData });
    mockRoom.participants.set(0, bob);
    renderHook(() => useClassDataChannel({ onMessage: jest.fn() }));

    act(() => void bob.emit('trackSubscribed', bobData));

    expect(bobData.listenerCount('message')).toBe(1);
  });

  it('invokes onParticipantConnected after attaching a newly joined participant', () => {
    const onParticipantConnected = jest.fn();
    const bob = createParticipant('student-bob');
    renderHook(() => useClassDataChannel({ onMessage: jest.fn(), onParticipantConnected }));
    act(() => void mockRoom.emit('participantConnected', bob));
    expect(onParticipantConnected).toHaveBeenCalledWith(bob);
  });

  it('invokes onParticipantDisconnected when a participant leaves', () => {
    const onParticipantDisconnected = jest.fn();
    const bob = createParticipant('student-bob');
    renderHook(() => useClassDataChannel({ onMessage: jest.fn(), onParticipantDisconnected }));
    act(() => {
      mockRoom.emit('participantConnected', bob);
      mockRoom.emit('participantDisconnected', bob);
    });
    expect(onParticipantDisconnected).toHaveBeenCalledWith(bob);
  });

  it('prunes a disconnected participant listeners so the set stays bounded', () => {
    const bob = createParticipant('student-bob');
    const bobData = createDataTrack();
    bob.tracks.set('t1', { track: bobData });
    mockRoom.participants.set(0, bob);
    renderHook(() => useClassDataChannel({ onMessage: jest.fn() }));
    expect(bobData.listenerCount('message')).toBe(1);
    expect(bob.listenerCount('trackSubscribed')).toBe(1);

    act(() => void mockRoom.emit('participantDisconnected', bob));

    expect(bobData.listenerCount('message')).toBe(0);
    expect(bob.listenerCount('trackSubscribed')).toBe(0);
  });

  it('cleans up room listeners on unmount', () => {
    const { unmount } = renderHook(() => useClassDataChannel({ onMessage: jest.fn() }));
    expect(mockRoom.listenerCount('participantConnected')).toBe(1);
    expect(mockRoom.listenerCount('participantDisconnected')).toBe(1);
    unmount();
    expect(mockRoom.listenerCount('participantConnected')).toBe(0);
    expect(mockRoom.listenerCount('participantDisconnected')).toBe(0);
  });

  it('unpublishes the data track on unmount (after publish settles)', async () => {
    const { unmount } = renderHook(() => useClassDataChannel({ onMessage: jest.fn() }));
    unmount();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockRoom.localParticipant.unpublishTrack).toHaveBeenCalled();
  });
});
