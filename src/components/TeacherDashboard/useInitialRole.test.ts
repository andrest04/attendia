import { renderHook } from '@testing-library/react-hooks';
import { useLocation, useParams } from 'react-router-dom';
import { useAppState } from '../../state';
import { getResumableSession } from '../../classSession/rejoinSession';
import useInitialRole from './useInitialRole';

jest.mock('../../state');
jest.mock('react-router-dom', () => ({ useParams: jest.fn(), useLocation: jest.fn() }));
jest.mock('../../classSession/rejoinSession', () => ({
  ...jest.requireActual('../../classSession/rejoinSession'),
  getResumableSession: jest.fn(),
}));

const mockUseAppState = useAppState as jest.Mock<any>;
const mockUseParams = useParams as jest.Mock<any>;
const mockUseLocation = useLocation as jest.Mock<any>;
const mockGetResumableSession = getResumableSession as jest.Mock<any>;

describe('useInitialRole', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppState.mockReturnValue({});
    mockUseParams.mockReturnValue({ URLRoomName: undefined });
    mockUseLocation.mockReturnValue({ state: undefined });
    mockGetResumableSession.mockReturnValue(null);
  });

  it('defaults to teacher with no profile, no URL room, no login state', () => {
    const { result } = renderHook(() => useInitialRole());
    expect(result.current).toBe('teacher');
  });

  it('uses the login-selected role when present', () => {
    mockUseLocation.mockReturnValue({ state: { preJoinRole: 'student' } });
    const { result } = renderHook(() => useInitialRole());
    expect(result.current).toBe('student');
  });

  it('resolves student for a deep link with no resumable session', () => {
    mockUseParams.mockReturnValue({ URLRoomName: 'sala-1' });
    const { result } = renderHook(() => useInitialRole());
    expect(result.current).toBe('student');
  });

  it('resolves the role from a resumable session identity, overriding the deep-link default', () => {
    mockUseParams.mockReturnValue({ URLRoomName: 'sala-1' });
    mockGetResumableSession.mockReturnValue({ roomName: 'sala-1', identity: 'Ana [Profesor]' });
    const { result } = renderHook(() => useInitialRole());
    expect(result.current).toBe('teacher');
  });

  it('lets a verified profile role win over everything else', () => {
    mockUseParams.mockReturnValue({ URLRoomName: 'sala-1' });
    mockUseLocation.mockReturnValue({ state: { preJoinRole: 'teacher' } });
    mockGetResumableSession.mockReturnValue({ roomName: 'sala-1', identity: 'Ana [Profesor]' });
    mockUseAppState.mockReturnValue({ profile: { role: 'student' } });
    const { result } = renderHook(() => useInitialRole());
    expect(result.current).toBe('student');
  });
});
