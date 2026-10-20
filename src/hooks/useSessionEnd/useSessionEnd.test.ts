import { act, renderHook } from '@testing-library/react-hooks';
import useSessionEnd from './useSessionEnd';
import useVideoContext from '../useVideoContext/useVideoContext';
import useClassDataChannel from '../useClassDataChannel/useClassDataChannel';
import { useAppState } from '../../state';
import { clearRejoinSession } from '../../classSession/rejoinSession';

const mockEnqueue = jest.fn();
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: mockEnqueue }) }));
jest.mock('../useVideoContext/useVideoContext');
jest.mock('../useClassDataChannel/useClassDataChannel');
jest.mock('../../state');
jest.mock('../../classSession/rejoinSession', () => ({
  clearRejoinSession: jest.fn(),
}));

const mockedVideoContext = useVideoContext as jest.Mock<any>;
const mockedDataChannel = useClassDataChannel as jest.Mock<any>;
const mockedAppState = useAppState as jest.Mock<any>;
const mockClearRejoin = clearRejoinSession as jest.Mock;

describe('useSessionEnd', () => {
  let mockSend: jest.Mock;
  let mockDisconnect: jest.Mock;
  let mockSetEnded: jest.Mock;
  let capturedOnMessage: (message: any, participant?: any) => void;
  const teacher = { identity: 'Ana [Profesor]' };
  const student = { identity: 'student-bob' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend = jest.fn();
    mockDisconnect = jest.fn();
    mockSetEnded = jest.fn();

    mockedVideoContext.mockImplementation(() => ({
      room: { name: 'clase-1', localParticipant: { identity: 'Ana [Profesor]' }, disconnect: mockDisconnect },
    }));
    mockedDataChannel.mockImplementation((opts: any) => {
      capturedOnMessage = opts.onMessage;
      return { send: mockSend };
    });
    mockedAppState.mockImplementation(() => ({
      user: { getIdToken: jest.fn(() => Promise.resolve('teacher-id-token')) },
      setSessionEndedByProfessor: mockSetEnded,
    }));
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ completed: true }) });
  });

  it('endSessionForAll broadcasts, completes the room, then leaves', async () => {
    const { result } = renderHook(() => useSessionEnd());

    await act(async () => {
      await result.current.endSessionForAll();
    });

    expect(mockSend).toHaveBeenCalledWith({ type: 'session-ended' });
    expect((global as any).fetch).toHaveBeenCalledWith(
      '/completeRoom',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ room_name: 'clase-1', user_identity: 'Ana [Profesor]' }),
      })
    );
    // POST /completeRoom is behind the Firebase auth middleware: without the ID token the
    // server answers 401 and the Twilio room is never completed for the other participants.
    expect(((global as any).fetch as jest.Mock).mock.calls[0][1].headers).toEqual({
      Authorization: 'teacher-id-token',
      'content-type': 'application/json',
    });
    expect(mockClearRejoin).toHaveBeenCalled();
    expect(mockSetEnded).toHaveBeenCalledWith(true);
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('still leaves and flags the app even if the completion request fails', async () => {
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useSessionEnd());

    await act(async () => {
      await result.current.endSessionForAll();
    });

    expect(mockClearRejoin).toHaveBeenCalled();
    expect(mockSetEnded).toHaveBeenCalledWith(true);
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('warns the professor with a toast when the room could not be closed on the server', async () => {
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useSessionEnd());

    await act(async () => {
      await result.current.endSessionForAll();
    });

    expect(mockEnqueue).toHaveBeenCalledWith(
      'No se pudo cerrar la sala en el servidor. Los estudiantes podrían seguir conectados.',
      expect.objectContaining({ variant: 'warning' })
    );
  });

  it('does not warn when the room was closed', async () => {
    const { result } = renderHook(() => useSessionEnd());

    await act(async () => {
      await result.current.endSessionForAll();
    });

    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('on receiving a session-ended message, clears rejoin, flags the app, and disconnects', () => {
    renderHook(() => useSessionEnd());

    act(() => capturedOnMessage({ type: 'session-ended' }, teacher));

    expect(mockClearRejoin).toHaveBeenCalled();
    expect(mockSetEnded).toHaveBeenCalledWith(true);
    expect(mockDisconnect).toHaveBeenCalled();
    // A student receiver must NOT re-broadcast or complete the room.
    expect(mockSend).not.toHaveBeenCalled();
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('ignores a session-ended message sent by a student', () => {
    renderHook(() => useSessionEnd());

    act(() => capturedOnMessage({ type: 'session-ended' }, student));

    expect(mockDisconnect).not.toHaveBeenCalled();
    expect(mockSetEnded).not.toHaveBeenCalled();
    expect(mockClearRejoin).not.toHaveBeenCalled();
  });

  it('ignores unrelated messages on the shared channel', () => {
    renderHook(() => useSessionEnd());

    act(() => capturedOnMessage({ type: 'raise-hand', raised: true }, student));

    expect(mockDisconnect).not.toHaveBeenCalled();
    expect(mockSetEnded).not.toHaveBeenCalled();
  });

  describe('the onProfessorEnd option', () => {
    it('endSessionForAll awaits onProfessorEnd("ended-for-all") before disconnecting', async () => {
      const onProfessorEnd = jest.fn(() => Promise.resolve());
      const { result } = renderHook(() => useSessionEnd({ onProfessorEnd }));

      await act(async () => {
        await result.current.endSessionForAll();
      });

      expect(onProfessorEnd).toHaveBeenCalledTimes(1);
      expect(onProfessorEnd).toHaveBeenCalledWith('ended-for-all');
      // The snapshot must run before the room is torn down — the attention
      // provider clears its history on disconnect.
      expect(onProfessorEnd.mock.invocationCallOrder[0]).toBeLessThan(mockDisconnect.mock.invocationCallOrder[0]);
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('leaveWithoutEnding fires onProfessorEnd("left"), clears the rejoin session, and disconnects', () => {
      const onProfessorEnd = jest.fn(() => Promise.resolve());
      const { result } = renderHook(() => useSessionEnd({ onProfessorEnd }));

      act(() => result.current.leaveWithoutEnding());

      expect(onProfessorEnd).toHaveBeenCalledWith('left');
      expect(mockClearRejoin).toHaveBeenCalled();
      expect(mockDisconnect).toHaveBeenCalled();
      // Leaving alone keeps the class open: no broadcast, no room completion, and
      // no "session ended" screen for anyone.
      expect(mockSend).not.toHaveBeenCalled();
      expect((global as any).fetch).not.toHaveBeenCalled();
      expect(mockSetEnded).not.toHaveBeenCalled();
    });

    it('leaveWithoutEnding does not throw when the room is already gone', () => {
      mockedVideoContext.mockImplementation(() => ({ room: null }));
      const { result } = renderHook(() => useSessionEnd({ onProfessorEnd: jest.fn(() => Promise.resolve()) }));

      expect(() => act(() => result.current.leaveWithoutEnding())).not.toThrow();
      expect(mockClearRejoin).toHaveBeenCalled();
    });

    it('is NOT invoked on the student session-ended message path', () => {
      const onProfessorEnd = jest.fn(() => Promise.resolve());
      renderHook(() => useSessionEnd({ onProfessorEnd }));

      act(() => capturedOnMessage({ type: 'session-ended' }, teacher));

      expect(onProfessorEnd).not.toHaveBeenCalled();
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });
});
