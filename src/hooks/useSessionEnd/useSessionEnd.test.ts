import { act, renderHook } from '@testing-library/react-hooks';
import useSessionEnd from './useSessionEnd';
import useVideoContext from '../useVideoContext/useVideoContext';
import useClassDataChannel from '../useClassDataChannel/useClassDataChannel';
import { useAppState } from '../../state';
import { clearRejoinSession } from '../../components/PreJoinScreens/rejoinSession';

jest.mock('../useVideoContext/useVideoContext');
jest.mock('../useClassDataChannel/useClassDataChannel');
jest.mock('../../state');
jest.mock('../../state/usePasscodeAuth/usePasscodeAuth', () => ({
  getPasscode: () => undefined,
}));
jest.mock('../../components/PreJoinScreens/rejoinSession', () => ({
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
  let capturedOnMessage: (message: any) => void;

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
    mockedAppState.mockImplementation(() => ({ setSessionEndedByProfessor: mockSetEnded }));
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

  it('on receiving a session-ended message, clears rejoin, flags the app, and disconnects', () => {
    renderHook(() => useSessionEnd());

    act(() => capturedOnMessage({ type: 'session-ended' }));

    expect(mockClearRejoin).toHaveBeenCalled();
    expect(mockSetEnded).toHaveBeenCalledWith(true);
    expect(mockDisconnect).toHaveBeenCalled();
    // A student receiver must NOT re-broadcast or complete the room.
    expect(mockSend).not.toHaveBeenCalled();
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('ignores unrelated messages on the shared channel', () => {
    renderHook(() => useSessionEnd());

    act(() => capturedOnMessage({ type: 'raise-hand', raised: true }));

    expect(mockDisconnect).not.toHaveBeenCalled();
    expect(mockSetEnded).not.toHaveBeenCalled();
  });
});
