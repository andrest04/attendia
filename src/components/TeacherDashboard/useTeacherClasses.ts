import { useCallback, useEffect, useRef, useState } from 'react';
import { mockDashboardData } from './mockDashboardData';
import { ClassRecord, CreateClassInput } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { StateContextType } from '../../state';
import { toClassSessionDisplayName } from '../../classSession/classSessionTypes';
import { checkRoomOpen } from '../../classSession/checkRoomOpen';
import { shouldReprobe } from './roomProbeThrottle';
import { buildMockClassesView, buildRealClassesView } from './classSessionsView';
import useConfirmDialog from '../../hooks/useConfirmDialog/useConfirmDialog';
import useReloadableResource from '../../hooks/useReloadableResource/useReloadableResource';
import { t } from '../../i18n/translate';

export interface UseTeacherClassesParams {
  fetchClasses?: StateContextType['fetchClasses'];
  createClass?: StateContextType['createClass'];
  deleteClass?: StateContextType['deleteClass'];
  startClass?: StateContextType['startClass'];
  professorName: string;
  onStartClass: (session: { roomName: string; name: string; classId?: string }) => void;
  /** Refreshes the notification bell after a class-cancel mutation — see notifications.refresh() below. */
  refreshNotifications: () => void;
}

/**
 * The class mutations the tab offers. Without the real classes API (mock mode) every one is
 * undefined — the tab reads "undefined" as "hide this control" — so this single Null Object
 * stands in for what used to be a `hasRealClasses ? … : undefined` at each handler.
 */
interface ClassCommands {
  handleCreateClass?: (input: CreateClassInput & { roomName: string }) => Promise<void>;
  handleCancelClass?: (session: { id: string; title: string }) => void;
  handleDeleteClassFromResources?: (classId: string) => Promise<void>;
  handleCancelExpiredClasses?: () => void;
}

const NO_CLASS_COMMANDS: ClassCommands = {};

/** `/rooms/:name/open` is public and rate-limited, so started rooms are re-probed this slowly. */
export const ROOM_PROBE_INTERVAL_MS = 30000;

/**
 * Latest `checkRoomOpen` result per room for the given rooms (the teacher's started classes):
 * probed once when the set of rooms appears and then every ROOM_PROBE_INTERVAL_MS while the tab
 * is visible. It also re-probes when the tab becomes visible / the window regains focus and on
 * demand (`refresh`), but never twice within REPROBE_MIN_GAP_MS. Keyed on the rooms' names, so a
 * class list reload does not restart the probing.
 */
function useRoomOpenStatus(roomNames: string[]) {
  const [status, setStatus] = useState<Record<string, boolean | null>>({});
  const key = roomNames.join('\n');
  const lastProbeAtRef = useRef<number | null>(null);
  const probeNowRef = useRef<() => void>(() => {});

  useEffect(() => {
    const rooms = key ? key.split('\n') : [];
    if (rooms.length === 0) {
      probeNowRef.current = () => {};
      return undefined;
    }
    let cancelled = false;
    const probe = () => {
      lastProbeAtRef.current = Date.now();
      rooms.forEach(room =>
        checkRoomOpen(room).then(open => {
          if (!cancelled) setStatus(current => ({ ...current, [room]: open }));
        })
      );
    };
    const probeIfAllowed = () => {
      if (shouldReprobe(Date.now(), lastProbeAtRef.current)) probe();
    };
    const onVisible = () => {
      if (!document.hidden) probeIfAllowed();
    };
    probeNowRef.current = probeIfAllowed;
    probe();
    const timer = setInterval(() => {
      if (!document.hidden) probe();
    }, ROOM_PROBE_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      cancelled = true;
      probeNowRef.current = () => {};
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [key]);

  const refresh = useCallback(() => probeNowRef.current(), []);
  return { status, refresh };
}

/**
 * Owns the "Clases" concern of TeacherDashboard: fetching/creating/cancelling
 * scheduled classes, the derived upcoming-sessions/expired-classes views, and
 * starting a scheduled (or ad-hoc) class.
 */
export default function useTeacherClasses({
  fetchClasses,
  createClass,
  deleteClass,
  startClass,
  professorName,
  onStartClass,
  refreshNotifications,
}: UseTeacherClassesParams) {
  const data = mockDashboardData;
  const {
    data: realClasses,
    setData: setRealClasses,
    isLoading: isClassesLoading,
    error: classesError,
    reload: loadClasses,
  } = useReloadableResource<ClassRecord[]>(fetchClasses, {
    initial: [],
    failureMessage: t('No pudimos consultar las clases programadas.'),
    logLabel: 'TeacherDashboard: could not fetch classes',
  });
  const [cancellingClassId, setCancellingClassId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const cancelRetrySessionRef = useRef<{ id: string; title: string } | null>(null);
  const [isCancellingExpired, setIsCancellingExpired] = useState(false);
  const [cancelExpiredError, setCancelExpiredError] = useState<string | null>(null);
  const [startClassError, setStartClassError] = useState<string | null>(null);
  const [isStartingClass, setIsStartingClass] = useState(false);
  const cancelDialog = useConfirmDialog<{ id: string; title: string }>();
  const cancelExpiredDialog = useConfirmDialog();

  const hasRealClasses = Boolean(fetchClasses && createClass && deleteClass && startClass);

  const { sessions, expiredSessions, expiredClasses, dateLabel } = hasRealClasses
    ? buildRealClassesView(realClasses, Date.now())
    : buildMockClassesView(data);
  const expiredClassIds = new Set(expiredClasses.map(classRecord => classRecord.id));
  const { status: startedRoomStatus, refresh: refreshStartedRooms } = useRoomOpenStatus(
    hasRealClasses ? realClasses.filter(c => c.status === 'started').map(c => c.roomName) : []
  );

  const cancelClass = (session: { id: string; title: string }) => {
    setCancellingClassId(session.id);
    setCancelError(null);
    return deleteClass!(session.id)
      .then(() => {
        setRealClasses(current => current.filter(c => c.id !== session.id));
        cancelRetrySessionRef.current = null;
        // Server-side deletion already removes the class's stale notification (see
        // classes.ts createDeleteClassHandler); refresh here so the bell reflects
        // that immediately instead of waiting for the next periodic poll.
        refreshNotifications();
      })
      .catch(err => {
        setCancelError(err.message || t('No pudimos cancelar la clase.'));
        cancelRetrySessionRef.current = session;
      })
      .finally(() => setCancellingClassId(null));
  };

  const confirmCancelClass = () => {
    if (!cancelDialog.target) return;
    cancelClass(cancelDialog.target);
    cancelDialog.close();
  };

  const retryCancelClass = () => {
    if (cancelRetrySessionRef.current) cancelClass(cancelRetrySessionRef.current);
  };

  const commands: ClassCommands = hasRealClasses
    ? {
        handleCreateClass: input =>
          createClass!(input).then(created => {
            setRealClasses(current => [created, ...current]);
          }),
        handleCancelClass: session => cancelDialog.open(session),
        // Recursos' own cleanup action for a vencida/completed class's pill — no confirm
        // dialog/retry-ref plumbing here since ResourcesTab owns its own confirm dialog and
        // error state (bulkDeleteError) around this call.
        handleDeleteClassFromResources: classId =>
          deleteClass!(classId).then(() => {
            setRealClasses(current => current.filter(c => c.id !== classId));
          }),
        handleCancelExpiredClasses: () => {
          if (expiredClasses.length === 0) return;
          cancelExpiredDialog.open();
        },
      }
    : NO_CLASS_COMMANDS;

  const confirmCancelExpiredClasses = () => {
    cancelExpiredDialog.close();
    setIsCancellingExpired(true);
    setCancelExpiredError(null);
    Promise.allSettled(expiredClasses.map(classRecord => deleteClass!(classRecord.id).then(() => classRecord.id))).then(
      results => {
        const deletedIds = results
          .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
          .map(result => result.value);
        const failedCount = results.length - deletedIds.length;
        if (deletedIds.length > 0) {
          setRealClasses(current => current.filter(c => !deletedIds.includes(c.id)));
        }
        if (failedCount > 0) {
          setCancelExpiredError(
            failedCount === 1
              ? t('No pudimos cancelar 1 clase vencida.')
              : t('No pudimos cancelar {{count}} clases vencidas.', { count: failedCount })
          );
        }
        setIsCancellingExpired(false);
      }
    );
  };

  const startScheduledClass = async (classId: string, roomName: string) => {
    setStartClassError(null);
    setIsStartingClass(true);
    const open = await checkRoomOpen(roomName);
    if (open === true) {
      // The collision may be the teacher's own leftover/recurring session (same
      // title reused, previous class never closed) rather than someone else's —
      // resume that instead of dead-ending on a message they can't act on.
      const ownOpenSession = realClasses.find(c => c.roomName === roomName && c.status === 'started');
      setIsStartingClass(false);
      if (ownOpenSession) {
        onStartClass({
          roomName: ownOpenSession.roomName,
          name: toClassSessionDisplayName(professorName, 'teacher'),
          classId: ownOpenSession.id,
        });
        return;
      }
      setStartClassError(
        t(
          'Ya hay una sesión activa con este nombre de sala. Si es de otro profesor, entra con su código desde "Iniciar clase".'
        )
      );
      return;
    }
    startClass!(classId, roomName)
      .then(() => onStartClass({ roomName, name: toClassSessionDisplayName(professorName, 'teacher'), classId }))
      .catch(err => setStartClassError(err.message || t('No pudimos iniciar la clase programada.')))
      .finally(() => setIsStartingClass(false));
  };

  const handleStartClass = (session: { roomName: string; name: string; classId?: string }) => {
    if (session.classId) {
      startScheduledClass(session.classId, session.roomName);
      return;
    }
    onStartClass(session);
  };

  return {
    realClasses,
    setRealClasses,
    isClassesLoading,
    classesError,
    cancellingClassId,
    cancelError,
    isCancellingExpired,
    cancelExpiredError,
    startClassError,
    isStartingClass,
    startedRoomStatus,
    refreshStartedRooms,
    cancelDialog,
    cancelExpiredDialog,
    hasRealClasses,
    sessions,
    dateLabel,
    expiredClasses,
    expiredSessions,
    expiredClassIds,
    loadClasses,
    ...commands,
    confirmCancelClass,
    retryCancelClass,
    confirmCancelExpiredClasses,
    startScheduledClass,
    handleStartClass,
  };
}
