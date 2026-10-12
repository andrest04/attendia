import { useRef, useState } from 'react';
import { mockDashboardData } from './mockDashboardData';
import { ClassRecord, CreateClassInput } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { StateContextType } from '../../state';
import { toClassSessionDisplayName } from '../PreJoinScreens/classSessionTypes';
import { checkRoomOpen } from '../PreJoinScreens/checkRoomOpen';
import { buildMockClassesView, buildRealClassesView } from './classSessionsView';
import useConfirmDialog from '../../hooks/useConfirmDialog/useConfirmDialog';
import { countOf } from '../../utils/pluralize';
import useReloadableResource from '../../hooks/useReloadableResource/useReloadableResource';

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
    failureMessage: 'No pudimos consultar las clases programadas.',
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
        setCancelError(err.message || 'No pudimos cancelar la clase.');
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
          setCancelExpiredError(`No pudimos cancelar ${countOf(failedCount, 'clase vencida', 'clases vencidas')}.`);
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
        'Ya hay una sesión activa con este nombre de sala. Espera a que termine o cambia el título de la clase.'
      );
      return;
    }
    startClass!(classId, roomName)
      .then(() => onStartClass({ roomName, name: toClassSessionDisplayName(professorName, 'teacher'), classId }))
      .catch(err => setStartClassError(err.message || 'No pudimos iniciar la clase programada.'))
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
