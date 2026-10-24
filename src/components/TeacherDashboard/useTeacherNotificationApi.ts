import { useMemo } from 'react';
import { useAppState } from '../../state';
import { TeacherNotificationApi } from './useTeacherNotifications';
import { t } from '../../i18n/translate';

const unavailable = () => Promise.reject(new Error(t('Las notificaciones no están disponibles.')));

/** Stands in for the API when the session has none, so nothing has to null-check or assert it. */
const UNAVAILABLE_API: TeacherNotificationApi = {
  fetchNotifications: unavailable,
  markNotificationRead: unavailable,
  markAllNotificationsRead: unavailable,
  clearNotifications: unavailable,
  reconcileNotifications: unavailable,
};

/**
 * Adapts the app state's optional notification functions into the one complete API the
 * notifications hook needs. The functions only exist in firebase mode, and only all together:
 * with any of them missing the API is unavailable (and the hook must stay disabled).
 */
export default function useTeacherNotificationApi(): { api: TeacherNotificationApi; isAvailable: boolean } {
  const {
    fetchNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    reconcileNotifications,
  } = useAppState();

  return useMemo(() => {
    if (
      !fetchNotifications ||
      !markNotificationRead ||
      !markAllNotificationsRead ||
      !clearNotifications ||
      !reconcileNotifications
    ) {
      return { api: UNAVAILABLE_API, isAvailable: false };
    }
    return {
      api: {
        fetchNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        clearNotifications,
        reconcileNotifications,
      },
      isAvailable: true,
    };
  }, [fetchNotifications, markNotificationRead, markAllNotificationsRead, clearNotifications, reconcileNotifications]);
}
