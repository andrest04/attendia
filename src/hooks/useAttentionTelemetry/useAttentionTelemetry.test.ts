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
  JSON.stringify({
    type: 'attention-telemetry',
    index,
    multiface: faces > 1,
    faces,
    cameraOff: false,
    unsupported: false,
  });

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

  it('sends no measured sample when localResult is undefined, only a pending heartbeat', () => {
    renderHook(() => useAttentionTelemetry(undefined));
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockSend.mock.calls[0][0])).toMatchObject({ pending: true, faces: 0, cameraOff: false });
  });

  it('sends no measured sample while capture is inactive, only a pending heartbeat', () => {
    renderHook(() => useAttentionTelemetry(inactiveResult));
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockSend.mock.calls[0][0])).toMatchObject({ pending: true });
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

  it('switches to the pending heartbeat when localResult transitions from active to inactive', () => {
    const { rerender } = renderHook(({ result }) => useAttentionTelemetry(result), {
      initialProps: { result: activeResult(70) },
    });
    expect(mockSend).toHaveBeenCalledTimes(1);

    rerender({ result: inactiveResult });
    // no measured sample for the inactive result — the "no reading yet" beat instead
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(JSON.parse(mockSend.mock.calls[1][0])).toMatchObject({ pending: true, index: 0, faces: 0 });
  });

  describe('pending heartbeat (camera on, no reading yet: MediaPipe loading or failed)', () => {
    it('beats an explicit pending signal at 1 Hz while capture is not producing samples', () => {
      jest.useFakeTimers();
      try {
        renderHook(() => useAttentionTelemetry(inactiveResult, false, false));
        expect(JSON.parse(mockSend.mock.calls[0][0])).toEqual({
          type: 'attention-telemetry',
          index: 0,
          multiface: false,
          faces: 0,
          cameraOff: false,
          unsupported: false,
          pending: true,
        });

        act(() => {
          jest.advanceTimersByTime(1000);
        });
        expect(mockSend).toHaveBeenCalledTimes(2);
        expect(JSON.parse(mockSend.mock.calls[1][0]).pending).toBe(true);
      } finally {
        jest.useRealTimers();
      }
    });

    it('stops beating once capture produces real samples, which carry no pending field', () => {
      jest.useFakeTimers();
      try {
        const { rerender } = renderHook(({ result }) => useAttentionTelemetry(result), {
          initialProps: { result: inactiveResult },
        });
        rerender({ result: activeResult(64) });
        const calls = mockSend.mock.calls.length;
        expect(mockSend).toHaveBeenLastCalledWith(telemetryMsg(64, 1));

        act(() => {
          jest.advanceTimersByTime(3000);
        });
        expect(mockSend).toHaveBeenCalledTimes(calls);
      } finally {
        jest.useRealTimers();
      }
    });

    it('is not sent when the camera is off or the device is unsupported', () => {
      renderHook(() => useAttentionTelemetry(inactiveResult, true));
      renderHook(() => useAttentionTelemetry(inactiveResult, false, true));
      mockSend.mock.calls.forEach(([raw]) => expect(JSON.parse(raw).pending).toBeUndefined());
    });

    it('marks a remote pending message as pending (and not camera-off)', () => {
      const bob = createParticipant('student-bob');
      const bobData = createDataTrack();
      const { result } = renderHook(() => useAttentionTelemetry());
      act(() => {
        mockRoom.emit('participantConnected', bob);
        bob.emit('trackSubscribed', bobData);
        bobData.emit(
          'message',
          JSON.stringify({
            type: 'attention-telemetry',
            index: 0,
            multiface: false,
            faces: 0,
            cameraOff: false,
            unsupported: false,
            pending: true,
          })
        );
      });
      expect(result.current[0]).toMatchObject({ pending: true, cameraOff: false });
    });

    it('treats a message from an older sender (no pending field) as not pending', () => {
      const bob = createParticipant('student-bob');
      const bobData = createDataTrack();
      const { result } = renderHook(() => useAttentionTelemetry());
      act(() => {
        mockRoom.emit('participantConnected', bob);
        bob.emit('trackSubscribed', bobData);
        bobData.emit('message', telemetryMsg(82));
      });
      expect(result.current[0]).toMatchObject({ index: 82, pending: false });
    });
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
      {
        identity: 'student-bob',
        index: 82,
        multiface: false,
        faces: 1,
        cameraOff: false,
        unsupported: false,
        pending: false,
      },
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
    expect(alice_).toEqual({
      identity: 'student-alice',
      index: 60,
      multiface: false,
      faces: 1,
      cameraOff: false,
      unsupported: false,
      pending: false,
    });
    expect(bob_).toEqual({
      identity: 'student-bob',
      index: 90,
      multiface: true,
      faces: 2,
      cameraOff: false,
      unsupported: false,
      pending: false,
    });
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
      {
        identity: 'student-carol',
        index: 77,
        multiface: false,
        faces: 1,
        cameraOff: false,
        unsupported: false,
        pending: false,
      },
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
      const { rerender } = renderHook(({ off, result }) => useAttentionTelemetry(result, off), {
        initialProps: { off: true, result: inactiveResult },
      });
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Camera back on with capture already sampling: no heartbeat of any kind.
      rerender({ off: false, result: activeResult(70) });
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

  it('beats an unsupported heartbeat when the device cannot run the pipeline (mobile)', () => {
    jest.useFakeTimers();
    try {
      renderHook(() => useAttentionTelemetry(undefined, false, true));
      expect(mockSend).toHaveBeenCalledTimes(1);
      const first = JSON.parse(mockSend.mock.calls[0][0]);
      expect(first).toMatchObject({ type: 'attention-telemetry', unsupported: true, cameraOff: false, faces: 0 });

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(JSON.parse(mockSend.mock.calls[1][0]).unsupported).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('a remote unsupported message marks the entry unsupported:true', () => {
    const bob = createParticipant('student-bob');
    const bobData = createDataTrack();
    const { result } = renderHook(() => useAttentionTelemetry());
    act(() => {
      mockRoom.emit('participantConnected', bob);
      bob.emit('trackSubscribed', bobData);
      bobData.emit(
        'message',
        JSON.stringify({ type: 'attention-telemetry', index: 0, multiface: false, faces: 0, unsupported: true })
      );
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0].unsupported).toBe(true);
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

  describe('when disabled (the CV pipeline is off)', () => {
    it('is fully inert: publishes no data track and listens to nothing', () => {
      renderHook(() => useAttentionTelemetry(undefined, false, false, false));

      expect(mockRoom.localParticipant.publishTrack).not.toHaveBeenCalled();
      expect(mockRoom.listenerCount('participantConnected')).toBe(0);
    });

    it('runs no staleness sweep', () => {
      jest.useFakeTimers();
      try {
        const setIntervalSpy = jest.spyOn(window, 'setInterval');
        renderHook(() => useAttentionTelemetry(undefined, false, false, false));
        expect(setIntervalSpy).not.toHaveBeenCalled();
        setIntervalSpy.mockRestore();
      } finally {
        jest.useRealTimers();
      }
    });

    it('reports no remote attention', () => {
      const { result } = renderHook(() => useAttentionTelemetry(undefined, false, false, false));
      expect(result.current).toEqual([]);
    });

    it('is enabled by default, so existing callers are unchanged', () => {
      renderHook(() => useAttentionTelemetry());
      expect(mockRoom.localParticipant.publishTrack).toHaveBeenCalledTimes(1);
    });
  });

  describe('attention backfill (no teacher in the room)', () => {
    const backfillCalls = () =>
      mockSend.mock.calls.map(([raw]) => JSON.parse(raw)).filter(m => m.type === 'attention-backfill');
    let now: number;
    let nowSpy: jest.SpyInstance;

    beforeEach(() => {
      jest.useFakeTimers();
      now = 1_700_000_000_000;
      nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    });
    afterEach(() => {
      nowSpy.mockRestore();
      jest.useRealTimers();
    });

    const measure = (rerender: (p: any) => void, index: number, faces = 1) => {
      act(() => rerender({ result: activeResult(index, faces) }));
    };
    const setup = (cameraOff = false, enabled = true) =>
      renderHook(({ result }) => useAttentionTelemetry(result, cameraOff, false, enabled), {
        initialProps: { result: activeResult(50) },
      });
    const connectTeacher = () =>
      act(() => {
        mockRoom.emit('participantConnected', createParticipant('Prof [Profesor]'));
      });

    it('buffers one sample per 10 s while no teacher is present and flushes them when one connects', () => {
      const { rerender } = setup();
      now += 4000;
      measure(rerender, 60);
      now += 6000;
      measure(rerender, 70);
      now += 10000;
      measure(rerender, 80);
      connectTeacher();

      const sent = backfillCalls();
      expect(sent).toHaveLength(1);
      expect(sent[0].identity).toBe('me');
      expect(sent[0].samples.map((s: any) => s.index)).toEqual([50, 70, 80]);
    });

    it('does not buffer unmeasured readings (no face)', () => {
      const { rerender } = setup();
      now += 10000;
      measure(rerender, 0, 0);
      connectTeacher();
      expect(backfillCalls()[0].samples.map((s: any) => s.index)).toEqual([50]);
    });

    it('buffers nothing when a teacher is already in the room', () => {
      mockRoom.participants.set('p', createParticipant('Prof [Profesor]'));
      const { rerender } = setup();
      now += 10000;
      measure(rerender, 70);
      connectTeacher();
      expect(backfillCalls()).toHaveLength(0);
    });

    it('resends the same chunk (the teacher may subscribe late) and then clears the buffer', () => {
      const { rerender } = setup();
      now += 10000;
      measure(rerender, 70);
      connectTeacher();
      expect(backfillCalls()).toHaveLength(1);
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(backfillCalls()).toHaveLength(2);
      expect(backfillCalls()[1]).toEqual(backfillCalls()[0]);
      act(() => {
        jest.advanceTimersByTime(10000);
      });
      expect(backfillCalls()).toHaveLength(3);

      // Teacher leaves and comes back: the buffer was already handed over.
      const before = backfillCalls().length;
      connectTeacher();
      act(() => {
        jest.advanceTimersByTime(20000);
      });
      expect(backfillCalls()).toHaveLength(before);
    });

    it('keeps the buffer when the teacher leaves before the hand-over completes', () => {
      const teacher = createParticipant('Prof [Profesor]');
      const { rerender } = setup();
      now += 10000;
      measure(rerender, 70);
      act(() => {
        mockRoom.emit('participantConnected', teacher);
      });
      act(() => {
        mockRoom.emit('participantDisconnected', teacher);
      });
      act(() => {
        jest.advanceTimersByTime(20000);
      });
      expect(backfillCalls()).toHaveLength(1);

      act(() => {
        mockRoom.emit('participantConnected', createParticipant('Prof [Profesor]'));
      });
      expect(backfillCalls()[1].samples.map((s: any) => s.index)).toEqual([50, 70]);
    });

    it('is inert when disabled: nothing buffered, nothing sent', () => {
      const { rerender } = setup(false, false);
      now += 10000;
      measure(rerender, 70);
      connectTeacher();
      expect(backfillCalls()).toHaveLength(0);
      expect(mockRoom.localParticipant.publishTrack).not.toHaveBeenCalled();
    });

    describe('receiving (teacher side)', () => {
      const deliver = (sender: string, payload: any) => {
        const from = createParticipant(sender);
        const track = createDataTrack();
        act(() => {
          mockRoom.emit('participantConnected', from);
          from.emit('trackSubscribed', track);
          track.emit('message', JSON.stringify(payload));
        });
      };
      const chunk = (identity: string) => ({
        type: 'attention-backfill',
        identity,
        samples: [{ t: now - 20000, index: 42 }],
      });

      it('reports the samples under the SENDING participant identity, ignoring the payload one', () => {
        mockRoom.localParticipant.identity = 'Prof [Profesor]';
        const onBackfill = jest.fn();
        renderHook(() => useAttentionTelemetry(undefined, false, false, true, onBackfill));
        deliver('student-bob', chunk('student-eve'));
        expect(onBackfill).toHaveBeenCalledWith('student-bob', [{ t: now - 20000, index: 42 }]);
      });

      it('ignores backfill sent by a teacher and backfill received by a student', () => {
        const onBackfill = jest.fn();
        mockRoom.localParticipant.identity = 'Prof [Profesor]';
        renderHook(() => useAttentionTelemetry(undefined, false, false, true, onBackfill));
        deliver('Other [Profesor]', chunk('Other [Profesor]'));
        expect(onBackfill).not.toHaveBeenCalled();

        mockRoom.localParticipant.identity = 'student-me';
        const studentCb = jest.fn();
        renderHook(() => useAttentionTelemetry(undefined, false, false, true, studentCb));
        deliver('student-bob', chunk('student-bob'));
        expect(studentCb).not.toHaveBeenCalled();
      });
    });
  });
});
