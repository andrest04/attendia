import { act, renderHook } from '@testing-library/react-hooks';
import useDashboardHandoff from './useDashboardHandoff';

describe('useDashboardHandoff', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('starts with the dashboard active for a teacher and inactive for a student', () => {
    const teacher = renderHook(() => useDashboardHandoff('teacher', 'disconnected'));
    expect(teacher.result.current.dashboardActive).toBe(true);

    const student = renderHook(() => useDashboardHandoff('student', 'disconnected'));
    expect(student.result.current.dashboardActive).toBe(false);
  });

  it('drops into the prejoin flow with the picked session on handleStartClass', () => {
    const { result } = renderHook(() => useDashboardHandoff('teacher', 'disconnected'));

    act(() => {
      result.current.handleStartClass({ roomName: 'mat-a', name: 'Prof. García [Profesor]' });
    });

    expect(result.current.dashboardActive).toBe(false);
    expect(result.current.pendingSession).toEqual({ roomName: 'mat-a', name: 'Prof. García [Profesor]' });
  });

  it('returns to the dashboard and drops the picked session once the class ends, instead of re-using it forever', () => {
    let roomState = 'disconnected';
    const { result, rerender } = renderHook(() => useDashboardHandoff('teacher', roomState));

    act(() => {
      result.current.handleStartClass({ roomName: 'mat-a', name: 'Prof. García [Profesor]' });
    });
    expect(result.current.dashboardActive).toBe(false);

    // The class connects...
    roomState = 'connected';
    rerender();
    expect(result.current.dashboardActive).toBe(false);
    expect(result.current.pendingSession).toEqual({ roomName: 'mat-a', name: 'Prof. García [Profesor]' });

    // ...and later ends. Without the fix, `dashboardActive` never returns to true and
    // `pendingSession` never clears, so the SAME class would silently re-open every time.
    roomState = 'disconnected';
    rerender();
    expect(result.current.dashboardActive).toBe(true);
    expect(result.current.pendingSession).toBeNull();
  });

  it('re-activates the dashboard and drops the pending session on handleReturnToDashboard', () => {
    const { result } = renderHook(() => useDashboardHandoff('teacher', 'disconnected'));

    act(() => {
      result.current.handleStartClass({ roomName: 'mat-a', name: 'Prof. García [Profesor]' });
    });
    expect(result.current.dashboardActive).toBe(false);

    act(() => {
      result.current.handleReturnToDashboard();
    });

    expect(result.current.dashboardActive).toBe(true);
    expect(result.current.pendingSession).toBeNull();
  });

  it('does not reset on the initial mount, even though roomState starts disconnected', () => {
    const { result } = renderHook(() => useDashboardHandoff('teacher', 'disconnected'));
    expect(result.current.dashboardActive).toBe(true);
    expect(result.current.pendingSession).toBeNull();
  });

  it('never re-activates the dashboard for a student once a class ends', () => {
    let roomState = 'disconnected';
    const { result, rerender } = renderHook(() => useDashboardHandoff('student', roomState));

    roomState = 'connected';
    rerender();
    roomState = 'disconnected';
    rerender();

    expect(result.current.dashboardActive).toBe(false);
  });

  it('survives a refresh: a fresh mount stays on the prejoin flow with the picked class', () => {
    const first = renderHook(() => useDashboardHandoff('teacher', 'disconnected'));
    act(() => {
      first.result.current.handleStartClass({ roomName: 'mat-a', name: 'Prof. García [Profesor]' });
    });

    // Simulates a page refresh: App remounts, so this is a brand new hook instance.
    const afterRefresh = renderHook(() => useDashboardHandoff('teacher', 'disconnected'));
    expect(afterRefresh.result.current.dashboardActive).toBe(false);
    expect(afterRefresh.result.current.pendingSession).toEqual({ roomName: 'mat-a', name: 'Prof. García [Profesor]' });
  });

  it('does not resurrect a handoff after handleReturnToDashboard clears it', () => {
    const first = renderHook(() => useDashboardHandoff('teacher', 'disconnected'));
    act(() => {
      first.result.current.handleStartClass({ roomName: 'mat-a', name: 'Prof. García [Profesor]' });
    });
    act(() => {
      first.result.current.handleReturnToDashboard();
    });

    const afterRefresh = renderHook(() => useDashboardHandoff('teacher', 'disconnected'));
    expect(afterRefresh.result.current.dashboardActive).toBe(true);
    expect(afterRefresh.result.current.pendingSession).toBeNull();
  });
});
