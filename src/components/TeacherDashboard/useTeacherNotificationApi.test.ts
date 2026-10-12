import { renderHook } from '@testing-library/react-hooks';
import useTeacherNotificationApi from './useTeacherNotificationApi';
import { useAppState } from '../../state';

jest.mock('../../state');

const mockUseAppState = useAppState as jest.Mock<any>;

const complete = () => ({
  fetchNotifications: jest.fn(),
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
  clearNotifications: jest.fn(),
  reconcileNotifications: jest.fn(),
});

describe('useTeacherNotificationApi', () => {
  it('exposes the app state functions when all of them exist', () => {
    const state = complete();
    mockUseAppState.mockImplementation(() => state);

    const { result } = renderHook(() => useTeacherNotificationApi());

    expect(result.current.isAvailable).toBe(true);
    expect(result.current.api).toEqual(state);
  });

  it.each(Object.keys(complete()))('is unavailable when %s is missing', missing => {
    const state: { [key: string]: unknown } = complete();
    delete state[missing];
    mockUseAppState.mockImplementation(() => state);

    expect(renderHook(() => useTeacherNotificationApi()).result.current.isAvailable).toBe(false);
  });

  it('is unavailable outside firebase mode', () => {
    mockUseAppState.mockImplementation(() => ({}));

    expect(renderHook(() => useTeacherNotificationApi()).result.current.isAvailable).toBe(false);
  });

  it('rejects every call of the unavailable API instead of throwing a TypeError', async () => {
    mockUseAppState.mockImplementation(() => ({}));
    const { api } = renderHook(() => useTeacherNotificationApi()).result.current;

    await expect(api.fetchNotifications()).rejects.toThrow('no están disponibles');
    await expect(api.markNotificationRead('id')).rejects.toThrow('no están disponibles');
    await expect(api.markAllNotificationsRead('key')).rejects.toThrow('no están disponibles');
    await expect(api.clearNotifications('key')).rejects.toThrow('no están disponibles');
    await expect(api.reconcileNotifications('all')).rejects.toThrow('no están disponibles');
  });

  it('keeps the same API while the functions do not change', () => {
    const state = complete();
    mockUseAppState.mockImplementation(() => state);

    const { result, rerender } = renderHook(() => useTeacherNotificationApi());
    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
  });
});
