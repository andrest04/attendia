import { act, renderHook } from '@testing-library/react-hooks';
import { ClientApiError, TeacherNotification } from '../../state/useFirebaseAuth/useFirebaseAuth';
import useTeacherNotifications, { TeacherNotificationApi } from './useTeacherNotifications';

const item = (id: string, occurrence: number, readAtMs: number | null = null): TeacherNotification => ({
  notificationId: id,
  ownerUid: 'teacher-1',
  eventType: 'class.upcoming',
  eventKey: `class:${id}:upcoming`,
  source: { kind: 'class', classId: id },
  eventOccurrenceAtMs: occurrence,
  createdAtMs: occurrence,
  readAtMs,
  title: id,
  message: id,
  destination: { kind: 'classes' },
});

const page = (items: TeacherNotification[], unreadCount: number, nextCursor: string | null = null) => ({
  items,
  unreadCount,
  nextCursor,
  hasMore: nextCursor !== null,
});

const api = (): jest.Mocked<TeacherNotificationApi> => ({
  fetchNotifications: jest.fn(),
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
  clearNotifications: jest.fn(),
  reconcileNotifications: jest.fn(),
});

const flush = () => act(async () => Promise.resolve());

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe('useTeacherNotifications confirmed state', () => {
  it('distinguishes initial loading from a confirmed empty inbox and uses the global count', async () => {
    const client = api();
    client.fetchNotifications.mockResolvedValue(page([], 7));
    const { result } = renderHook(() => useTeacherNotifications(client));

    expect(result.current.isInitialLoading).toBe(true);
    expect(result.current.hasConfirmedState).toBe(false);
    await act(async () => result.current.refresh());

    expect(result.current.isInitialLoading).toBe(false);
    expect(result.current.hasConfirmedState).toBe(true);
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(7);
  });

  it('appends pages with deterministic order and deduplication', async () => {
    const client = api();
    client.fetchNotifications
      .mockResolvedValueOnce(page([item('b', 20), item('a', 30)], 4, 'older'))
      .mockResolvedValueOnce(page([item('b', 20), item('c', 10)], 5));
    const { result } = renderHook(() => useTeacherNotifications(client));

    await act(async () => result.current.refresh());
    await act(async () => result.current.loadMore());

    expect(client.fetchNotifications).toHaveBeenNthCalledWith(2, 'older');
    expect(result.current.notifications.map(value => value.notificationId)).toEqual(['a', 'b', 'c']);
    expect(result.current.unreadCount).toBe(5);
    expect(result.current.hasMore).toBe(false);
  });

  it('recovers a stale continuation by atomically replacing state with page one', async () => {
    const client = api();
    client.fetchNotifications
      .mockResolvedValueOnce(page([item('old', 10)], 1, 'retired'))
      .mockRejectedValueOnce(new ClientApiError(409, 'stale_cursor', 'stale'))
      .mockResolvedValueOnce(page([item('new', 30)], 2, 'current'));
    const { result } = renderHook(() => useTeacherNotifications(client));

    await act(async () => result.current.refresh());
    await act(async () => result.current.loadMore());

    expect(client.fetchNotifications).toHaveBeenLastCalledWith();
    expect(result.current.notifications).toEqual([item('new', 30)]);
    expect(result.current.unreadCount).toBe(2);
    expect(result.current.paginationError).toBeNull();
  });

  it('keeps confirmed state intact and isolates refresh, pagination, and mutation failures', async () => {
    const client = api();
    client.fetchNotifications.mockResolvedValueOnce(page([item('kept', 10)], 1, 'next'));
    const { result } = renderHook(() => useTeacherNotifications(client));
    await act(async () => result.current.refresh());

    client.fetchNotifications.mockRejectedValueOnce(new Error('page failed'));
    await act(async () => result.current.loadMore());
    client.markNotificationRead.mockRejectedValueOnce(new Error('read failed'));
    let readFailure: Error | null = null;
    await act(async () => {
      try { await result.current.markRead('kept'); } catch (value) { readFailure = value as Error; }
    });

    expect(readFailure).toEqual(new Error('read failed'));
    expect(result.current.notifications).toEqual([item('kept', 10)]);
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.paginationError?.message).toBe('page failed');
    expect(result.current.readError?.message).toBe('read failed');
    expect(result.current.refreshError).toBeNull();
  });

  it('commits read, mark-all, clear, and reconcile only after confirmed server results', async () => {
    const client = api();
    client.fetchNotifications
      .mockResolvedValueOnce(page([item('one', 20), item('two', 10)], 2))
      .mockResolvedValueOnce(page([item('remote', 30)], 1));
    client.markNotificationRead.mockResolvedValue({ notification: item('one', 20, 21), unreadCount: 1 });
    client.markAllNotificationsRead.mockResolvedValue({ acceptedAtMs: 22, unreadCount: 0 });
    client.clearNotifications.mockResolvedValue({ acceptedAtMs: 23, unreadCount: 0 });
    client.reconcileNotifications.mockResolvedValue({ changed: true, unreadCount: 1 });
    const { result } = renderHook(() => useTeacherNotifications(client, () => 'operation-key'));

    await act(async () => result.current.refresh());
    await act(async () => result.current.markRead('one'));
    expect(result.current.notifications[0].readAtMs).toBe(21);
    await act(async () => result.current.markAllRead());
    expect(result.current.notifications.map(value => value.readAtMs)).toEqual([21, 22]);
    await act(async () => result.current.reconcile('all'));
    expect(result.current.notifications).toEqual([item('remote', 30)]);
    await act(async () => result.current.clearAll());

    expect(client.markAllNotificationsRead).toHaveBeenCalledWith('operation-key');
    expect(client.clearNotifications).toHaveBeenCalledWith('operation-key');
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it('exposes each pending mutation until its confirmed server result settles', async () => {
    const client = api();
    const read = deferred<{ notification: TeacherNotification; unreadCount: number }>();
    const markAll = deferred<{ acceptedAtMs: number; unreadCount: number }>();
    const clear = deferred<{ acceptedAtMs: number; unreadCount: number }>();
    client.markNotificationRead.mockReturnValue(read.promise);
    client.markAllNotificationsRead.mockReturnValue(markAll.promise);
    client.clearNotifications.mockReturnValue(clear.promise);
    const { result } = renderHook(() => useTeacherNotifications(client, () => 'operation-key'));

    let readAction!: Promise<void>;
    act(() => { readAction = result.current.markRead('one'); });
    expect(result.current.pendingReadId).toBe('one');
    await act(async () => read.resolve({ notification: item('one', 20, 21), unreadCount: 0 }));
    await readAction;
    expect(result.current.pendingReadId).toBeNull();

    let markAllAction!: Promise<void>;
    act(() => { markAllAction = result.current.markAllRead(); });
    expect(result.current.isMarkingAll).toBe(true);
    await act(async () => markAll.resolve({ acceptedAtMs: 22, unreadCount: 0 }));
    await markAllAction;
    expect(result.current.isMarkingAll).toBe(false);

    let clearAction!: Promise<void>;
    act(() => { clearAction = result.current.clearAll(); });
    expect(result.current.isClearing).toBe(true);
    await act(async () => clear.resolve({ acceptedAtMs: 23, unreadCount: 0 }));
    await clearAction;
    expect(result.current.isClearing).toBe(false);
  });

  it('uses reconciliation refreshes to remove recovered reports and reveal recording outcomes', async () => {
    const client = api();
    const report = { ...item('report', 10), eventType: 'report.save_failed' as const };
    const recording = { ...item('recording', 20), eventType: 'recording.ready' as const };
    client.fetchNotifications
      .mockResolvedValueOnce(page([report], 1))
      .mockResolvedValueOnce(page([], 0))
      .mockResolvedValueOnce(page([recording], 1));
    client.reconcileNotifications.mockResolvedValue({ changed: true, unreadCount: 0 });
    const { result } = renderHook(() => useTeacherNotifications(client));

    await act(async () => result.current.refresh());
    await act(async () => result.current.reconcile('all'));
    expect(result.current.notifications).toEqual([]);
    await act(async () => result.current.reconcile('recordings'));
    expect(result.current.notifications).toEqual([recording]);
    expect(client.reconcileNotifications.mock.calls.map(call => call[0])).toEqual(['all', 'recordings']);
  });

  it('preserves confirmed state across mutation failures and reuses an ambiguous operation key', async () => {
    const client = api();
    client.fetchNotifications.mockResolvedValue(page([item('kept', 10)], 1));
    client.markAllNotificationsRead.mockRejectedValue(new Error('ambiguous'));
    client.clearNotifications.mockRejectedValue(new Error('clear failed'));
    client.reconcileNotifications.mockRejectedValue(new Error('reconcile failed'));
    let key = 0;
    const { result } = renderHook(() => useTeacherNotifications(client, () => `key-${++key}`));
    await act(async () => result.current.refresh());

    for (const mutation of [result.current.markAllRead, result.current.markAllRead, result.current.clearAll, result.current.reconcile]) {
      await act(async () => { try { await mutation(); } catch (_) {} });
    }

    expect(client.markAllNotificationsRead.mock.calls).toEqual([['key-1'], ['key-1']]);
    expect(result.current.notifications).toEqual([item('kept', 10)]);
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.markAllError?.message).toBe('ambiguous');
    expect(result.current.clearError?.message).toBe('clear failed');
    expect(result.current.reconcileError?.message).toBe('reconcile failed');
  });

  it('converges to another device on first-page refresh and ignores an older overlapping response', async () => {
    const client = api();
    let resolveOld!: (value: ReturnType<typeof page>) => void;
    client.fetchNotifications
      .mockImplementationOnce(() => new Promise(resolve => (resolveOld = resolve)))
      .mockResolvedValueOnce(page([item('remote', 40, 41)], 0));
    const { result } = renderHook(() => useTeacherNotifications(client));

    let oldRequest!: Promise<void>;
    act(() => { oldRequest = result.current.refresh(); });
    await act(async () => result.current.refresh());
    act(() => resolveOld(page([item('stale', 10)], 1)));
    await act(async () => oldRequest);

    expect(result.current.notifications).toEqual([item('remote', 40, 41)]);
    expect(result.current.unreadCount).toBe(0);
  });

  describe('active lifecycle', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('reconciles all immediately and runs one non-overlapping all-scope poll every 30 seconds', async () => {
      const client = api();
      const first = deferred<{ changed: boolean; unreadCount: number }>();
      client.reconcileNotifications
        .mockReturnValueOnce(first.promise)
        .mockResolvedValue({ changed: false, unreadCount: 1 });
      client.fetchNotifications.mockResolvedValue(page([item('recording', 30)], 1));
      renderHook(() => useTeacherNotifications(client, undefined, [], { enabled: true, userKey: 'teacher-1' }));

      expect(client.reconcileNotifications).toHaveBeenCalledTimes(1);
      expect(client.reconcileNotifications).toHaveBeenLastCalledWith('all', []);
      act(() => jest.advanceTimersByTime(60000));
      expect(client.reconcileNotifications).toHaveBeenCalledTimes(1);

      await act(async () => first.resolve({ changed: true, unreadCount: 1 }));
      act(() => jest.advanceTimersByTime(30000));
      await flush();

      expect(client.reconcileNotifications).toHaveBeenCalledTimes(2);
      expect(client.reconcileNotifications).toHaveBeenLastCalledWith('all', []);
      expect(client.fetchNotifications).toHaveBeenCalledTimes(2);
    });

    it('stops while hidden or offline and performs an all-scope wake that converges after recovery', async () => {
      const client = api();
      client.reconcileNotifications
        .mockResolvedValueOnce({ changed: false, unreadCount: 1 })
        .mockRejectedValueOnce(new Error('wake failed'))
        .mockResolvedValue({ changed: true, unreadCount: 0 });
      client.fetchNotifications
        .mockResolvedValueOnce(page([item('kept', 10)], 1))
        .mockResolvedValue(page([item('remote', 40, 41)], 0));
      const { result } = renderHook(() =>
        useTeacherNotifications(client, undefined, [], { enabled: true, userKey: 'teacher-1' })
      );
      await flush();

      act(() => { window.dispatchEvent(new Event('focus')); });
      await flush();
      expect(result.current.notifications).toEqual([item('kept', 10)]);
      expect(result.current.reconcileError?.message).toBe('wake failed');

      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      act(() => { document.dispatchEvent(new Event('visibilitychange')); });
      act(() => jest.advanceTimersByTime(60000));
      expect(client.reconcileNotifications).toHaveBeenCalledTimes(2);

      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      act(() => { document.dispatchEvent(new Event('visibilitychange')); });
      await flush();
      expect(result.current.notifications).toEqual([item('remote', 40, 41)]);

      act(() => { window.dispatchEvent(new Event('offline')); });
      act(() => jest.advanceTimersByTime(60000));
      expect(client.reconcileNotifications).toHaveBeenCalledTimes(3);
      act(() => { window.dispatchEvent(new Event('online')); });
      await flush();

      expect(client.reconcileNotifications).toHaveBeenLastCalledWith('all', []);
      expect(result.current.notifications).toEqual([item('remote', 40, 41)]);
      expect(result.current.unreadCount).toBe(0);
      expect(result.current.reconcileError).toBeNull();
    });

    it('stops and discards stale work on disable, user change, and unmount', async () => {
      const client = api();
      const oldWake = deferred<{ changed: boolean; unreadCount: number }>();
      client.reconcileNotifications
        .mockReturnValueOnce(oldWake.promise)
        .mockResolvedValue({ changed: false, unreadCount: 0 });
      client.fetchNotifications.mockResolvedValue(page([item('new-user', 50)], 0));
      const { result, rerender, unmount } = renderHook(
        ({ enabled, userKey }) => useTeacherNotifications(client, undefined, [], { enabled, userKey }),
        { initialProps: { enabled: true, userKey: 'teacher-1' } }
      );

      rerender({ enabled: false, userKey: 'teacher-1' });
      await act(async () => oldWake.resolve({ changed: true, unreadCount: 9 }));
      expect(client.fetchNotifications).not.toHaveBeenCalled();
      expect(result.current.hasConfirmedState).toBe(false);

      rerender({ enabled: true, userKey: 'teacher-2' });
      await flush();
      expect(result.current.notifications).toEqual([item('new-user', 50)]);
      unmount();
      act(() => jest.advanceTimersByTime(60000));
      expect(client.reconcileNotifications).toHaveBeenCalledTimes(2);
    });
  });
});
