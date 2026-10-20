import { renderHook } from '@testing-library/react-hooks';
import useIsRoomOwner from './useIsRoomOwner';
import useVideoContext from '../useVideoContext/useVideoContext';
import { useAppState } from '../../state';
import { createApiClient } from '../../state/useFirebaseAuth/apiClient';

jest.mock('../useVideoContext/useVideoContext');
jest.mock('../../state');
jest.mock('../../state/useFirebaseAuth/apiClient');

const mockedVideoContext = useVideoContext as jest.Mock<any>;
const mockedAppState = useAppState as jest.Mock<any>;
const mockedCreateApiClient = createApiClient as jest.Mock<any>;

describe('useIsRoomOwner', () => {
  let json: jest.Mock;
  const user = { getIdToken: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    json = jest.fn().mockResolvedValue({ isOwner: true });
    mockedCreateApiClient.mockReturnValue({ json });
    mockedVideoContext.mockReturnValue({ room: { name: 'clase 1' } });
    mockedAppState.mockReturnValue({ user });
  });

  it('is unknown until the lookup settles, then owner', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useIsRoomOwner(true));
    expect(result.current).toBe('unknown');
    await waitForNextUpdate();
    expect(result.current).toBe('owner');
    expect(json).toHaveBeenCalledWith('/rooms/clase%201/ownership');
    expect(json).toHaveBeenCalledTimes(1);
  });

  it('reports co-teacher only when the server says isOwner false', async () => {
    json.mockResolvedValue({ isOwner: false });
    const { result, waitForNextUpdate } = renderHook(() => useIsRoomOwner(true));
    await waitForNextUpdate();
    expect(result.current).toBe('co-teacher');
  });

  it('stays unknown when the lookup fails', async () => {
    json.mockRejectedValue(new Error('503'));
    const { result, waitForNextUpdate } = renderHook(() => useIsRoomOwner(true));
    await waitForNextUpdate().catch(() => undefined);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(result.current).toBe('unknown');
  });

  it('does not call the server when disabled (students) or without a room', () => {
    renderHook(() => useIsRoomOwner(false));
    mockedVideoContext.mockReturnValue({ room: null });
    const { result } = renderHook(() => useIsRoomOwner(true));
    expect(json).not.toHaveBeenCalled();
    expect(result.current).toBe('unknown');
  });
});
