import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ClientApiError,
  NotificationMutationResult,
  NotificationPage,
  NotificationReadResult,
  NotificationReconcileResult,
  ReportFailureClaim,
  TeacherNotification,
} from '../../state/useFirebaseAuth/useFirebaseAuth';

export interface TeacherNotificationLifecycleOptions {
  enabled: boolean;
  userKey: string | null;
  pollIntervalMs?: number;
}

export interface TeacherNotificationApi {
  fetchNotifications(cursor?: string): Promise<NotificationPage>;
  markNotificationRead(id: string): Promise<NotificationReadResult>;
  markAllNotificationsRead(idempotencyKey: string): Promise<NotificationMutationResult>;
  clearNotifications(idempotencyKey: string): Promise<NotificationMutationResult>;
  reconcileNotifications(
    scope: 'all' | 'recordings',
    pendingReportFailures?: ReportFailureClaim[]
  ): Promise<NotificationReconcileResult>;
}

const createOperationKey = () =>
  `notification-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;

const asError = (value: unknown): Error => (value instanceof Error ? value : new Error(String(value)));

const notificationTime = (value: number | null): number => (value === null ? Number.MIN_SAFE_INTEGER : value);

export const orderNotifications = (items: TeacherNotification[]): TeacherNotification[] =>
  items.slice().sort((left, right) => {
    const occurrence = notificationTime(right.eventOccurrenceAtMs) - notificationTime(left.eventOccurrenceAtMs);
    const created = notificationTime(right.createdAtMs) - notificationTime(left.createdAtMs);
    return occurrence || created || right.notificationId.localeCompare(left.notificationId);
  });

const mergeNotifications = (current: TeacherNotification[], incoming: TeacherNotification[]): TeacherNotification[] => {
  const byId: { [id: string]: TeacherNotification } = {};
  current.concat(incoming).forEach(notification => {
    if (!byId[notification.notificationId]) byId[notification.notificationId] = notification;
  });
  return orderNotifications(Object.keys(byId).map(id => byId[id]));
};

export default function useTeacherNotifications(
  api: TeacherNotificationApi,
  newOperationKey: () => string = createOperationKey,
  pendingReportFailures: ReportFailureClaim[] = [],
  lifecycle: TeacherNotificationLifecycleOptions = { enabled: false, userKey: null }
) {
  const [notifications, setNotifications] = useState<TeacherNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [hasConfirmedState, setHasConfirmedState] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pendingReadId, setPendingReadId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [refreshError, setRefreshError] = useState<Error | null>(null);
  const [paginationError, setPaginationError] = useState<Error | null>(null);
  const [readError, setReadError] = useState<Error | null>(null);
  const [markAllError, setMarkAllError] = useState<Error | null>(null);
  const [clearError, setClearError] = useState<Error | null>(null);
  const [reconcileError, setReconcileError] = useState<Error | null>(null);
  const refreshSequence = useRef(0);
  const loadingMore = useRef(false);
  const operationKeys = useRef<{ markAll?: string; clear?: string }>({});

  const commitPageOne = useCallback((page: NotificationPage) => {
    setNotifications(orderNotifications(page.items));
    setUnreadCount(page.unreadCount);
    setNextCursor(page.nextCursor);
    setHasMore(page.hasMore);
    setHasConfirmedState(true);
  }, []);

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const page = await api.fetchNotifications();
      if (sequence === refreshSequence.current) commitPageOne(page);
    } catch (value) {
      if (sequence === refreshSequence.current) setRefreshError(asError(value));
    } finally {
      if (sequence === refreshSequence.current) setIsRefreshing(false);
    }
  }, [api, commitPageOne]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMore.current) return;
    loadingMore.current = true;
    setIsLoadingMore(true);
    setPaginationError(null);
    try {
      const page = await api.fetchNotifications(nextCursor);
      setNotifications(current => mergeNotifications(current, page.items));
      setUnreadCount(page.unreadCount);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (value) {
      if (value instanceof ClientApiError && value.status === 409 && value.code === 'stale_cursor') {
        try {
          commitPageOne(await api.fetchNotifications());
        } catch (recoveryError) {
          setPaginationError(asError(recoveryError));
        }
      } else setPaginationError(asError(value));
    } finally {
      loadingMore.current = false;
      setIsLoadingMore(false);
    }
  }, [api, commitPageOne, hasMore, nextCursor]);

  const markRead = useCallback(async (id: string) => {
    setReadError(null);
    setPendingReadId(id);
    try {
      const result = await api.markNotificationRead(id);
      setNotifications(current =>
        orderNotifications(current.map(value => (value.notificationId === id ? result.notification : value)))
      );
      setUnreadCount(result.unreadCount);
    } catch (value) {
      const error = asError(value);
      setReadError(error);
      throw error;
    } finally {
      setPendingReadId(null);
    }
  }, [api]);

  const markAllRead = useCallback(async () => {
    setMarkAllError(null);
    setIsMarkingAll(true);
    const key = operationKeys.current.markAll || newOperationKey();
    operationKeys.current.markAll = key;
    try {
      const result = await api.markAllNotificationsRead(key);
      setNotifications(current => current.map(value => (value.readAtMs === null ? { ...value, readAtMs: result.acceptedAtMs } : value)));
      setUnreadCount(result.unreadCount);
      delete operationKeys.current.markAll;
    } catch (value) {
      const error = asError(value);
      if (value instanceof ClientApiError) delete operationKeys.current.markAll;
      setMarkAllError(error);
      throw error;
    } finally {
      setIsMarkingAll(false);
    }
  }, [api, newOperationKey]);

  const clearAll = useCallback(async () => {
    setClearError(null);
    setIsClearing(true);
    const key = operationKeys.current.clear || newOperationKey();
    operationKeys.current.clear = key;
    try {
      const result = await api.clearNotifications(key);
      setNotifications([]);
      setUnreadCount(result.unreadCount);
      setNextCursor(null);
      setHasMore(false);
      setHasConfirmedState(true);
      delete operationKeys.current.clear;
    } catch (value) {
      const error = asError(value);
      if (value instanceof ClientApiError) delete operationKeys.current.clear;
      setClearError(error);
      throw error;
    } finally {
      setIsClearing(false);
    }
  }, [api, newOperationKey]);

  const reconcile = useCallback(async (scope: 'all' | 'recordings' = 'all') => {
    setReconcileError(null);
    try {
      await api.reconcileNotifications(scope, pendingReportFailures);
      commitPageOne(await api.fetchNotifications());
    } catch (value) {
      const error = asError(value);
      setReconcileError(error);
      throw error;
    }
  }, [api, commitPageOne, pendingReportFailures]);

  const pendingFailuresRef = useRef(pendingReportFailures);
  pendingFailuresRef.current = pendingReportFailures;

  useEffect(() => {
    let generationActive = true;
    let online = typeof navigator === 'undefined' || navigator.onLine !== false;
    let inFlight = false;
    let queuedScope: 'all' | 'recordings' | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const interval = Math.min(lifecycle.pollIntervalMs || 30000, 30000);
    const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
    const active = () => generationActive && lifecycle.enabled && !!lifecycle.userKey && online && visible();
    const stopTimer = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    const resetConfirmedState = () => {
      setNotifications([]);
      setUnreadCount(0);
      setNextCursor(null);
      setHasMore(false);
      setHasConfirmedState(false);
      setReconcileError(null);
    };

    const schedulePoll = () => {
      stopTimer();
      if (!active()) return;
      timer = setTimeout(() => {
        timer = null;
        run('all');
      }, interval);
    };

    // Stale-while-revalidate: render whatever is already durable immediately instead
    // of blocking the dropdown behind reconcile, which then runs in the background.
    // The unread count from reconcile is always authoritative (it never touches read
    // state), but the item list is only worth a second round trip when reconcile
    // actually created/removed something.
    const run = async (scope: 'all' | 'recordings') => {
      if (!active()) return;
      if (inFlight) {
        if (scope === 'all' || queuedScope === null) queuedScope = scope;
        return;
      }
      inFlight = true;
      stopTimer();
      setReconcileError(null);
      try {
        const cached = await api.fetchNotifications();
        if (!active()) return;
        commitPageOne(cached);
        const outcome = await api.reconcileNotifications(scope, pendingFailuresRef.current);
        if (!active()) return;
        if (outcome.changed) {
          const reconciled = await api.fetchNotifications();
          if (active()) commitPageOne(reconciled);
        } else {
          setUnreadCount(outcome.unreadCount);
        }
      } catch (value) {
        if (generationActive) setReconcileError(asError(value));
      } finally {
        inFlight = false;
        if (!generationActive) return;
        const queued = queuedScope;
        queuedScope = null;
        if (queued && active()) run(queued);
        else schedulePoll();
      }
    };

    const wake = () => {
      if (active()) run('all');
      else stopTimer();
    };
    const handleVisibility = () => wake();
    const handleFocus = () => wake();
    const handleOffline = () => {
      online = false;
      stopTimer();
    };
    const handleOnline = () => {
      online = true;
      wake();
    };

    resetConfirmedState();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    wake();

    return () => {
      generationActive = false;
      stopTimer();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [api, commitPageOne, lifecycle.enabled, lifecycle.pollIntervalMs, lifecycle.userKey]);

  return {
    notifications, unreadCount, hasMore, hasConfirmedState,
    isInitialLoading: !hasConfirmedState, isRefreshing, isLoadingMore,
    pendingReadId, isMarkingAll, isClearing,
    refreshError, paginationError, readError, markAllError, clearError, reconcileError,
    refresh, loadMore, markRead, markAllRead, clearAll, reconcile,
  };
}
