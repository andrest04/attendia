import { renderHook } from '@testing-library/react-hooks';
import useUnloadReportPersistence from './useUnloadReportPersistence';
import { useAppState } from '../../state';
import useCachedIdToken from '../useCachedIdToken/useCachedIdToken';
import { savePendingAttentionReport } from '../../components/AttentionReport/pendingAttentionReports';

jest.mock('../../state');
jest.mock('../useCachedIdToken/useCachedIdToken');
jest.mock('../../components/AttentionReport/pendingAttentionReports');

const mockUseAppState = useAppState as jest.Mock<any>;
const mockUseCachedIdToken = useCachedIdToken as jest.Mock<any>;
const mockSavePending = savePendingAttentionReport as jest.Mock<any>;

const report = { roomSid: 'RM123' } as any;
const firebaseUser = { uid: 'uid-1', getIdToken: jest.fn() };
let fetchMock: jest.Mock;

const fireUnload = (type: 'beforeunload' | 'pagehide' = 'beforeunload') => window.dispatchEvent(new Event(type));

describe('useUnloadReportPersistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppState.mockImplementation(() => ({ user: firebaseUser }));
    // The real hook returns one stable ref for the component's lifetime.
    const tokenRef = { current: 'cached-token' };
    mockUseCachedIdToken.mockImplementation(() => tokenRef);
    fetchMock = jest.fn(() => Promise.resolve({}));
    (global as any).fetch = fetchMock;
  });

  it('does nothing when a student leaves', () => {
    const buildReport = jest.fn(() => report);
    renderHook(() => useUnloadReportPersistence(false, buildReport));

    fireUnload();

    expect(buildReport).not.toHaveBeenCalled();
    expect(mockSavePending).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('queues the report locally and posts it with keepalive when a teacher leaves', () => {
    const buildReport = jest.fn(() => report);
    renderHook(() => useUnloadReportPersistence(true, buildReport));

    fireUnload();

    expect(buildReport).toHaveBeenCalledWith('left');
    expect(mockSavePending).toHaveBeenCalledWith('uid-1', report);
    expect(fetchMock).toHaveBeenCalledWith('/reports', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: 'cached-token' },
      body: JSON.stringify(report),
    });
  });

  it('also reacts to pagehide', () => {
    renderHook(() => useUnloadReportPersistence(true, () => report));

    fireUnload('pagehide');

    expect(mockSavePending).toHaveBeenCalledTimes(1);
  });

  it('still queues the report locally when no token is cached yet, without posting', () => {
    const emptyRef = { current: null };
    mockUseCachedIdToken.mockImplementation(() => emptyRef);
    renderHook(() => useUnloadReportPersistence(true, () => report));

    fireUnload();

    expect(mockSavePending).toHaveBeenCalledWith('uid-1', report);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips everything when there is no report to save', () => {
    renderHook(() => useUnloadReportPersistence(true, () => null));

    fireUnload();

    expect(mockSavePending).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('swallows a failed keepalive post', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('offline')));
    renderHook(() => useUnloadReportPersistence(true, () => report));

    expect(() => fireUnload()).not.toThrow();
    await Promise.resolve();
  });

  it('only caches the id token while a teacher is present', () => {
    renderHook(() => useUnloadReportPersistence(false, () => report));
    expect(mockUseCachedIdToken).toHaveBeenLastCalledWith(null);

    renderHook(() => useUnloadReportPersistence(true, () => report));
    expect(mockUseCachedIdToken).toHaveBeenLastCalledWith(firebaseUser);
  });

  it('reads the latest report builder without re-registering the listeners', () => {
    const addSpy = jest.spyOn(window, 'addEventListener');
    const first = jest.fn(() => report);
    const second = jest.fn(() => report);
    const { rerender } = renderHook(({ build }) => useUnloadReportPersistence(true, build), {
      initialProps: { build: first },
    });
    const registrations = addSpy.mock.calls.filter(([type]) => type === 'beforeunload').length;

    rerender({ build: second });
    fireUnload();

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    expect(addSpy.mock.calls.filter(([type]) => type === 'beforeunload').length).toBe(registrations);
    addSpy.mockRestore();
  });

  it('removes both listeners on unmount', () => {
    const buildReport = jest.fn(() => report);
    const { unmount } = renderHook(() => useUnloadReportPersistence(true, buildReport));

    unmount();
    fireUnload();
    fireUnload('pagehide');

    expect(buildReport).not.toHaveBeenCalled();
  });
});
