import { useCallback, useEffect, useRef, useState } from 'react';
import { UpcomingSession } from './types';
import { mockDashboardData } from './mockDashboardData';
import { ClassRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { StateContextType } from '../../state';
import { toClassSessionDisplayName } from '../PreJoinScreens/classSessionTypes';
import { checkRoomOpen } from '../PreJoinScreens/checkRoomOpen';
import { buildExpiredSessions, buildUpcomingSessions, findExpiredClasses } from './classSessionsView';

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
 * Owns the "Clases" concern of TeacherDashboard: fetching/creating/cancelling
 * scheduled classes, the derived upcoming-sessions/expired-classes views, and
 * starting a scheduled (or ad-hoc) class. Mechanical extraction from
 * TeacherDashboard.tsx — every branch, dependency array, and closure capture
 * is preserved exactly as it was inline.
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
  const [realClasses, setRealClasses] = useState<ClassRecord[]>([]);
  const [isClassesLoading, setIsClassesLoading] = useState(false);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [cancellingClassId, setCancellingClassId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const cancelRetrySessionRef = useRef<{ id: string; title: string } | null>(null);
  const [isCancellingExpired, setIsCancellingExpired] = useState(false);
  const [cancelExpiredError, setCancelExpiredError] = useState<string | null>(null);
  const [startClassError, setStartClassError] = useState<string | null>(null);
  const [isStartingClass, setIsStartingClass] = useState(false);
  // The dialog's target data is kept separate from its open flag: MUI's Dialog
  // plays a ~225ms exit transition with its content still mounted, so clearing
  // the data at the same time as closing would flash "undefined" mid-animation.
  const [cancelDialogSession, setCancelDialogSession] = useState<{ id: string; title: string } | null>(null);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isCancelExpiredDialogOpen, setIsCancelExpiredDialogOpen] = useState(false);

  const loadClasses = useCallback(() => {
    if (!fetchClasses) return;
    setIsClassesLoading(true);
    setClassesError(null);
    fetchClasses()
      .then(setRealClasses)
      .catch(err => {
        console.error('TeacherDashboard: could not fetch classes', err);
        setClassesError(err.message || 'No pudimos consultar las clases programadas.');
      })
      .finally(() => setIsClassesLoading(false));
  }, [fetchClasses]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const hasRealClasses = Boolean(fetchClasses && createClass && deleteClass && startClass);

  const sessions: UpcomingSession[] = hasRealClasses
    ? buildUpcomingSessions(realClasses, Date.now())
    : data.upcomingSessions;
  const expiredSessions: UpcomingSession[] = hasRealClasses ? buildExpiredSessions(realClasses, Date.now()) : [];
  const dateLabel = hasRealClasses
    ? capitalizeFirst(
        new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      )
    : data.upcomingSessionsDateLabel;

  const handleCreateClass = hasRealClasses
    ? (input: {
        title: string;
        scheduledAtMs: number;
        studentCount: number;
        durationMinutes: number;
        idempotencyKey: string;
        roomName: string;
      }) =>
        createClass!(input).then(created => {
          setRealClasses(current => [created, ...current]);
        })
    : undefined;

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

  const handleCancelClass = hasRealClasses
    ? (session: { id: string; title: string }) => {
        setCancelDialogSession(session);
        setIsCancelDialogOpen(true);
      }
    : undefined;

  // Recursos' own cleanup action for a vencida/completed class's pill — no confirm
  // dialog/retry-ref plumbing here since ResourcesTab owns its own confirm dialog and
  // error state (bulkDeleteError) around this call.
  const handleDeleteClassFromResources = hasRealClasses
    ? (classId: string) =>
        deleteClass!(classId).then(() => {
          setRealClasses(current => current.filter(c => c.id !== classId));
        })
    : undefined;

  const confirmCancelClass = () => {
    if (!cancelDialogSession) return;
    cancelClass(cancelDialogSession);
    setIsCancelDialogOpen(false);
  };

  const retryCancelClass = () => {
    if (cancelRetrySessionRef.current) cancelClass(cancelRetrySessionRef.current);
  };

  const expiredClasses = hasRealClasses ? findExpiredClasses(realClasses, Date.now()) : [];
  const expiredClassIds = new Set(expiredClasses.map(classRecord => classRecord.id));

  const handleCancelExpiredClasses = hasRealClasses
    ? () => {
        if (expiredClasses.length === 0) return;
        setIsCancelExpiredDialogOpen(true);
      }
    : undefined;

  const confirmCancelExpiredClasses = () => {
    setIsCancelExpiredDialogOpen(false);
    setIsCancellingExpired(true);
    setCancelExpiredError(null);
    Promise.allSettled(
      expiredClasses.map(classRecord => deleteClass!(classRecord.id).then(() => classRecord.id))
    ).then(results => {
      const deletedIds = results
        .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
        .map(result => result.value);
      const failedCount = results.length - deletedIds.length;
      if (deletedIds.length > 0) {
        setRealClasses(current => current.filter(c => !deletedIds.includes(c.id)));
      }
      if (failedCount > 0) {
        setCancelExpiredError(
          failedCount === 1 ? 'No pudimos cancelar 1 clase vencida.' : `No pudimos cancelar ${failedCount} clases vencidas.`
        );
      }
      setIsCancellingExpired(false);
    });
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
    cancelDialogSession,
    isCancelDialogOpen,
    setIsCancelDialogOpen,
    isCancelExpiredDialogOpen,
    setIsCancelExpiredDialogOpen,
    hasRealClasses,
    sessions,
    dateLabel,
    expiredClasses,
    expiredSessions,
    expiredClassIds,
    loadClasses,
    handleCreateClass,
    handleCancelClass,
    handleDeleteClassFromResources,
    confirmCancelClass,
    retryCancelClass,
    handleCancelExpiredClasses,
    confirmCancelExpiredClasses,
    startScheduledClass,
    handleStartClass,
  };
}

// es-AR lowercases the weekday ("miércoles, 8 de julio de 2026"); the mock data's
// label convention capitalizes it, so we match that by hand.
function capitalizeFirst(value: string): string {
  return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;
}
