import { renderHook } from '@testing-library/react-hooks';
import { act } from 'react-dom/test-utils';
import useAutoRejoin from './useAutoRejoin';
import { useAppState } from '../../state';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import useChatContext from '../../hooks/useChatContext/useChatContext';
import { clearRejoinSession, getResumableSession } from '../../classSession/rejoinSession';

jest.mock('../../state');
jest.mock('../../hooks/useVideoContext/useVideoContext');
jest.mock('../../hooks/useChatContext/useChatContext');
jest.mock('../../classSession/rejoinSession');

const mockUseAppState = useAppState as jest.Mock<any>;
const mockUseVideoContext = useVideoContext as jest.Mock<any>;
const mockUseChatContext = useChatContext as jest.Mock<any>;
const mockGetResumableSession = getResumableSession as jest.Mock;
const mockClearRejoinSession = clearRejoinSession as jest.Mock;

const RETRY_DELAY_MS = 2000;

describe('the useAutoRejoin hook', () => {
  let getToken: jest.Mock;
  let setError: jest.Mock;
  let videoConnect: jest.Mock;
  let chatConnect: jest.Mock;
  let getAudioAndVideoTracks: jest.Mock;
  let removeLocalAudioTrack: jest.Mock;
  let removeLocalVideoTrack: jest.Mock;

  const flush = () => act(async () => {});

  beforeEach(() => {
    jest.clearAllMocks();
    getToken = jest.fn(() => Promise.resolve({ token: 'fresh-token' }));
    setError = jest.fn();
    videoConnect = jest.fn(() => Promise.resolve());
    chatConnect = jest.fn(() => Promise.resolve());
    getAudioAndVideoTracks = jest.fn(() => Promise.resolve());
    removeLocalAudioTrack = jest.fn();
    removeLocalVideoTrack = jest.fn();

    mockUseAppState.mockImplementation(() => ({ getToken, error: null, setError }));
    mockUseVideoContext.mockImplementation(() => ({
      connect: videoConnect,
      getAudioAndVideoTracks,
      removeLocalAudioTrack,
      removeLocalVideoTrack,
    }));
    mockUseChatContext.mockImplementation(() => ({ connect: chatConnect }));
    delete process.env.REACT_APP_DISABLE_TWILIO_CONVERSATIONS;
  });

  it('does nothing when there is no resumable session', async () => {
    mockGetResumableSession.mockReturnValue(null);

    const { result } = renderHook(() => useAutoRejoin('prueba'));
    await flush();

    expect(result.current).toBe(false);
    expect(getToken).not.toHaveBeenCalled();
    expect(videoConnect).not.toHaveBeenCalled();
  });

  it('reconnects from a resumable session: media, token, video and chat', async () => {
    mockGetResumableSession.mockReturnValue({ roomName: 'prueba', identity: 'Ana Lopez' });

    const { result } = renderHook(() => useAutoRejoin('prueba'));
    // Spinner shows synchronously before any async work resolves.
    expect(result.current).toBe(true);

    await flush();

    expect(getAudioAndVideoTracks).toHaveBeenCalledTimes(1);
    expect(getToken).toHaveBeenCalledWith('Ana Lopez', 'prueba');
    expect(videoConnect).toHaveBeenCalledWith('fresh-token');
    expect(chatConnect).toHaveBeenCalledWith('fresh-token');
  });

  it('skips chat connect when conversations are disabled', async () => {
    process.env.REACT_APP_DISABLE_TWILIO_CONVERSATIONS = 'true';
    mockGetResumableSession.mockReturnValue({ roomName: 'prueba', identity: 'Ana Lopez' });

    renderHook(() => useAutoRejoin('prueba'));
    await flush();

    expect(videoConnect).toHaveBeenCalledWith('fresh-token');
    expect(chatConnect).not.toHaveBeenCalled();
  });

  it('clears the session and stops rejoining when getToken rejects', async () => {
    mockGetResumableSession.mockReturnValue({ roomName: 'prueba', identity: 'Ana Lopez' });
    getToken.mockRejectedValue(new Error('room closed'));

    const { result } = renderHook(() => useAutoRejoin('prueba'));
    await flush();

    expect(mockClearRejoinSession).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(false);
    expect(videoConnect).not.toHaveBeenCalled();
  });

  it('releases the acquired media when falling back to the lobby on a token rejection', async () => {
    mockGetResumableSession.mockReturnValue({ roomName: 'prueba', identity: 'Ana Lopez' });
    getToken.mockRejectedValue(new Error('room closed'));

    renderHook(() => useAutoRejoin('prueba'));
    await flush();

    // Media was acquired before the token request; the lobby renders no media UI, so the
    // tracks must be released or the camera/mic "in use" indicator stays on forever.
    expect(getAudioAndVideoTracks).toHaveBeenCalledTimes(1);
    expect(removeLocalAudioTrack).toHaveBeenCalled();
    expect(removeLocalVideoTrack).toHaveBeenCalled();
  });

  it('preserves the error dialog when getToken rejects (does not auto-dismiss it)', async () => {
    mockGetResumableSession.mockReturnValue({ roomName: 'prueba', identity: 'Ana Lopez' });
    // The real getToken both setError()s AND rejects on a genuine refusal (room closed).
    getToken.mockRejectedValue(new Error('room closed'));

    const { result, rerender } = renderHook(() => useAutoRejoin('prueba'));
    await flush();

    // The mount catch cleared the session and stopped rejoining.
    expect(mockClearRejoinSession).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(false);

    // Now the app error state flips truthy because getToken called setError(). The
    // error-watcher must NOT dismiss the dialog the user needs ("room closed").
    mockUseAppState.mockImplementation(() => ({ getToken, error: new Error('room closed'), setError }));
    await act(async () => {
      rerender();
    });

    expect(setError).not.toHaveBeenCalledWith(null);
    // No retry was scheduled for a genuine token rejection.
    expect(getToken).toHaveBeenCalledTimes(1);
    expect(videoConnect).not.toHaveBeenCalled();
  });

  it('retries once on a transient connect error without clearing the session', async () => {
    jest.useFakeTimers();
    try {
      const session = { roomName: 'prueba', identity: 'Ana Lopez' };
      mockGetResumableSession.mockReturnValue(session);

      // First render: no error yet, the rejoin starts.
      const { rerender } = renderHook(() => useAutoRejoin('prueba'));
      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      expect(getToken).toHaveBeenCalledTimes(1);
      expect(videoConnect).toHaveBeenCalledTimes(1);

      // Simulate the SDK surfacing a connect failure through app error state.
      mockUseAppState.mockImplementation(() => ({ getToken, error: new Error('connect failed'), setError }));
      await act(async () => {
        rerender();
      });

      // The retry dismisses the dialog and schedules a delayed reconnect.
      expect(setError).toHaveBeenCalledWith(null);
      expect(mockClearRejoinSession).not.toHaveBeenCalled();

      // Advance to fire the retry timer; the connect sequence runs again.
      await act(async () => {
        jest.advanceTimersByTime(RETRY_DELAY_MS);
      });
      await act(async () => {});

      expect(getToken).toHaveBeenCalledTimes(2);
      expect(videoConnect).toHaveBeenCalledTimes(2);
      expect(mockClearRejoinSession).not.toHaveBeenCalled();
      // The retry is still using the acquired media — it must NOT be released mid-flight.
      expect(removeLocalAudioTrack).not.toHaveBeenCalled();
      expect(removeLocalVideoTrack).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('falls back to the lobby on a second error but preserves the session', async () => {
    jest.useFakeTimers();
    try {
      const session = { roomName: 'prueba', identity: 'Ana Lopez' };
      mockGetResumableSession.mockReturnValue(session);

      const { result, rerender } = renderHook(() => useAutoRejoin('prueba'));
      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      // First error → schedules a retry.
      mockUseAppState.mockImplementation(() => ({ getToken, error: new Error('connect failed'), setError }));
      await act(async () => {
        rerender();
      });
      await act(async () => {
        jest.advanceTimersByTime(RETRY_DELAY_MS);
      });
      await act(async () => {});

      // Second error → give up, drop to the lobby, but keep the session.
      await act(async () => {
        rerender();
      });

      expect(result.current).toBe(false);
      expect(mockClearRejoinSession).not.toHaveBeenCalled();
      // Giving up releases the media so the lobby doesn't hold the camera/mic.
      expect(removeLocalAudioTrack).toHaveBeenCalled();
      expect(removeLocalVideoTrack).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
