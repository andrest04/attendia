import { renderHook } from '@testing-library/react-hooks';
import { useHistory, useLocation } from 'react-router-dom';
import useDashboardRouteSync from './useDashboardRouteSync';

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useLocation: jest.fn(),
}));

const mockUseHistory = useHistory as jest.Mock<any>;
const mockUseLocation = useLocation as jest.Mock<any>;
const mockReplace = jest.fn();

beforeEach(() => {
  mockReplace.mockClear();
  mockUseHistory.mockImplementation(() => ({ replace: mockReplace }));
});

describe('useDashboardRouteSync', () => {
  it('replaces a bare "/" with "/dashboard/clases" once the dashboard is active', () => {
    mockUseLocation.mockImplementation(() => ({ pathname: '/' }));
    renderHook(() => useDashboardRouteSync(true));

    expect(mockReplace).toHaveBeenCalledWith('/dashboard/clases');
  });

  it('does nothing while the dashboard is inactive', () => {
    mockUseLocation.mockImplementation(() => ({ pathname: '/' }));
    renderHook(() => useDashboardRouteSync(false));

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does nothing for routes other than the bare "/", even when active', () => {
    mockUseLocation.mockImplementation(() => ({ pathname: '/dashboard/historial' }));
    renderHook(() => useDashboardRouteSync(true));

    expect(mockReplace).not.toHaveBeenCalled();

    mockUseLocation.mockImplementation(() => ({ pathname: '/room/mat-a' }));
    renderHook(() => useDashboardRouteSync(true));

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
