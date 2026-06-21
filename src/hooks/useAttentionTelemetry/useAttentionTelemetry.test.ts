import { act, renderHook } from '@testing-library/react-hooks';
import EventEmitter from 'events';
import useAttentionTelemetry from './useAttentionTelemetry';
import useVideoContext from '../useVideoContext/useVideoContext';
import { AttentionCaptureResult } from '../useAttentionCapture/useAttentionCapture';

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

const activeResult = (index: number, faces = 1): AttentionCaptureResult => ({
  capture: 'active',
  index,
  components: { eyes: index, head: index },
  faces,
  multiface: faces > 1,
});

const inactiveResult: AttentionCaptureResult = {
  capture: 'inactive',
  index: 0,
  components: { eyes: 0, head: 0 },
  faces: 0,
  multiface: false,
};

const telemetryMsg = (index: number, faces = 1) =>
  JSON.stringify({ type: 'attention-telemetry', index, multiface: faces > 1, faces, cameraOff: false });

describe('useAttentionTelemetry', () => {
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
    renderHook(() => useAttentionTelemetry());
    expect(mockRoom.localParticipant.publishTrack).toHaveBeenCalledTimes(1);
  });

  it('unpublishes the data track on unmount (after publish settles)', async () => {
    const { unmount } = renderHook(() => useAttentionTelemetry());
    unmount();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockRoom.localParticipant.unpublishTrack).toHaveBeenCalled();
  });

  it('does not send when localResult is undefined', () => {
    renderHook(() => useAttentionTelemetry(undefined));
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does not send when capture is inactive', () => {
    renderHook(() => useAttentionTelemetry(inactiveResult));
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sends a well-formed attention-telemetry message when capture is active', () => {
    renderHook(() => useAttentionTelemetry(activeResult(75)));
    expect(mockSend).toHaveBeenCalledWith(telemetryMsg(75, 1));
  });

  it('sends updated telemetry when localResult changes to a new active value', () => {
    const { rerender } = renderHook(({ result }) => useAttentionTelemetry(result), {
      initialProps: { result: activeResult(60) },
    });
    expect(mockSend).toHaveBeenCalledWith(telemetryMsg(60, 1));

    rerender({ result: activeResult(80, 2) });
    expect(mockSend).toHaveBeenCalledWith(telemetryMsg(80, 2));
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('stops sending when localResult transitions from active to inactive', () => {
    const { rerender } = renderHook(({ result }) => useAttentionTelemetry(result), {
      initialProps: { result: activeResult(70) },
    });
    expect(mockSend).toHaveBeenCalledTimes(1);

    rerender({ result: inactiveResult });
    // still only 1 call — no extra send on transition to inactive
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('produces a RemoteAttention entry for a remote participant telemetry message', () => {
    const bob = createParticipant('student-bob');
    const bobData = createDataTrack();
    const { result } = renderHook(() => useAttentionTelemetry());
    act(() => {
      mockRoom.emit('participantConnected', bob);
      bob.emit('trackSubscribed', bobData);
      bobData.emit('message', telemetryMsg(82));
    });
    expect(result.current).toEqual([
      { identity: 'student-bob', index: 82, multiface: false, faces: 1, cameraOff: false },
    ]);
  });

  it('uses the Twilio participant identity, not any identity from the payload', () => {
    const bob = createParticipant('student-bob');
    const bobData = createDataTrack();
    const { result } = renderHook(() => useAttentionTelemetry());
    act(() => {
      mockRoom.emit('participantConnected', bob);
      bob.emit('trackSubscribed', bobData);
      // The payload has no identity field; the hook must use participant.identity
      bobData.emit('message', JSON.stringify({ type: 'attention-telemetry', index: 55, multiface: false, faces: 1 }));
    });
    expect(result.current[0].identity).toBe('student-bob');
  });

  it('handles two remote participants independently', () => {
    const alice = createParticipant('student-alice');
    const aliceData = createDataTrack();
    const bob = createParticipant('student-bob');
    const bobData = createDataTrack();
    const { result } = renderHook(() => useAttentionTelemetry());
    act(() => {
      mockRoom.emit('participantConnected', alice);
      alice.emit('trackSubscribed', aliceData);
      aliceData.emit('message', telemetryMsg(60));

      mockRoom.emit('participantConnected', bob);
      bob.emit('trackSubscribed', bobData);
      bobData.emit('message', telemetryMsg(90, 2));
    });
    const identities = result.current.map((r: any) => r.identity).sort();
    expect(identities).toEqual(['student-alice', 'student-bob']);
    const alice_ = result.current.find((r: any) => r.identity === 'student-alice');
    const bob_ = result.current.find((r: any) => r.identity === 'student-bob');
    expect(alice_).toEqual({ identity: 'student-alice', index: 60, multiface: false, faces: 1, cameraOff: false });
    expect(bob_).toEqual({ identity: 'student-bob', index: 90, multiface: true, faces: 2, cameraOff: false });
  });

  it('updating the same participant overwrites the previous entry (no duplicates)', () => {
    const bob = createParticipant('student-bob');
    const bobData = createDataTrack();
    const { result } = renderHook(() => useAttentionTelemetry());
    act(() => {
      mockRoom.emit('participantConnected', bob);
      bob.emit('trackSubscribed', bobData);
      bobData.emit('message', telemetryMsg(50));
    });
    act(() => void bobData.emit('message', telemetryMsg(95)));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].index).toBe(95);
  });

  it('reads telemetry from a participant whose data track was already subscribed', () => {
    const carol = createParticipant('student-carol');
    const carolData = createDataTrack();
    carol.tracks.set('t1', { track: carolData });
    mockRoom.participants.set(0, carol);
    const { result } = renderHook(() => useAttentionTelemetry());
    act(() => void carolData.emit('message', telemetryMsg(77)));
    expect(result.current).toEqual([
      { identity: 'student-carol', index: 77, multiface: false, faces: 1, cameraOff: false },
    ]);
  });

  it('removes a participant entry on participantDisconnected', () => {
    const bob = createParticipant('student-bob');
    const bobData = createDataTrack();
    const { result } = renderHook(() => useAttentionTelemetry());
    act(() => {
      mockRoom.emit('participantConnected', bob);
      bob.emit('trackSubscribed', bobData);
      bobData.emit('message', telemetryMsg(70));
    });
    act(() => void mockRoom.emit('participantDisconnected', bob));
    expect(result.current).toEqual([]);
  });

  it('cleans up room listeners on unmount', () => {
    const { unmount } = renderHook(() => useAttentionTelemetry());
    expect(mockRoom.listenerCount('participantConnected')).toBe(1);
    unmount();
    expect(mockRoom.listenerCount('participantConnected')).toBe(0);
    expect(mockRoom.listenerCount('participantDisconnected')).toBe(0);
  });

  it('does not attach a second message listener to the same data track', () => {
    const bob = createParticipant('student-bob');
    const bobData = createDataTrack();
    bob.tracks.set('t1', { track: bobData });
    mockRoom.participants.set(0, bob);
    renderHook(() => useAttentionTelemetry());

    act(() => void bob.emit('trackSubscribed', bobData));

    expect(bobData.listenerCount('message')).toBe(1);
  });

  it('ignores non-JSON messages', () => {
    const bob = createParticipant('student-bob');
    const bobData = createDataTrack();
    const { result } = renderHook(() => useAttentionTelemetry());
    act(() => {
      mockRoom.emit('participantConnected', bob);
      bob.emit('trackSubscribed', bobData);
      bobData.emit('message', 'not-json');
    });
    expect(result.current).toEqual([]);
  });

  it('ignores messages with a different type', () => {
    const bob = createParticipant('student-bob');
    const bobData = createDataTrack();
    const { result } = renderHook(() => useAttentionTelemetry());
    act(() => {
      mockRoom.emit('participantConnected', bob);
      bob.emit('trackSubscribed', bobData);
      bobData.emit('message', JSON.stringify({ type: 'raise-hand', raised: true }));
    });
    expect(result.current).toEqual([]);
  });

  it('ignores messages missing required numeric fields', () => {
    const bob = createParticipant('student-bob');
    const bobData = createDataTrack();
    const { result } = renderHook(() => useAttentionTelemetry());
    act(() => {
      mockRoom.emit('participantConnected', bob);
      bob.emit('trackSubscribed', bobData);
      // missing index
      bobData.emit('message', JSON.stringify({ type: 'attention-telemetry', multiface: false, faces: 1 }));
    });
    expect(result.current).toEqual([]);
  });

  it('active broadcast includes cameraOff:false', () => {
    renderHook(() => useAttentionTelemetry(activeResult(75)));
    const sent = JSON.parse(mockSend.mock.calls[0][0]);
    expect(sent.cameraOff).toBe(false);
  });

  it('broadcasts a camera-off heartbeat while cameraOff is true', () => {
    jest.useFakeTimers();
    try {
      renderHook(() => useAttentionTelemetry(undefined, true));
      // immediate send on activation
      expect(mockSend).toHaveBeenCalledTimes(1);
      const first = JSON.parse(mockSend.mock.calls[0][0]);
      expect(first).toMatchObject({
        type: 'attention-telemetry',
        index: 0,
        multiface: false,
        faces: 0,
        cameraOff: true,
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(mockSend).toHaveBeenCalledTimes(2);
      const second = JSON.parse(mockSend.mock.calls[1][0]);
      expect(second.cameraOff).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('stops the camera-off heartbeat when cameraOff returns to false', () => {
    jest.useFakeTimers();
    try {
      const { rerender } = renderHook(({ off }) => useAttentionTelemetry(undefined, off), {
        initialProps: { off: true },
      });
      expect(mockSend).toHaveBeenCalledTimes(1);

      rerender({ off: false });
      const callsAfterStop = mockSend.mock.calls.length;

      act(() => {
        jest.advanceTimersByTime(3000);
      });
      // no further heartbeat sends after cameraOff turned false
      expect(mockSend).toHaveBeenCalledTimes(callsAfterStop);
    } finally {
      jest.useRealTimers();
    }
  });

  it('a remote camera-off message marks the entry cameraOff:true', () => {
    const bob = createParticipant('student-bob');
    const bobData = createDataTrack();
    const { result } = renderHook(() => useAttentionTelemetry());
    act(() => {
      mockRoom.emit('participantConnected', bob);
      bob.emit('trackSubscribed', bobData);
      bobData.emit(
        'message',
        JSON.stringify({ type: 'attention-telemetry', index: 0, multiface: false, faces: 0, cameraOff: true })
      );
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0].cameraOff).toBe(true);
  });

  it('expires a stale remote entry after STALE_TTL_MS with no refresh', () => {
    jest.useFakeTimers();
    try {
      const bob = createParticipant('student-bob');
      const bobData = createDataTrack();
      const { result } = renderHook(() => useAttentionTelemetry());
      act(() => {
        mockRoom.emit('participantConnected', bob);
        bob.emit('trackSubscribed', bobData);
        bobData.emit('message', telemetryMsg(82));
      });
      expect(result.current).toHaveLength(1);

      // Advance past STALE_TTL_MS (5000) plus a sweep tick (1000) with no refresh.
      act(() => {
        jest.advanceTimersByTime(7000);
      });
      expect(result.current).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });
});
