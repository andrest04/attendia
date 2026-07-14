import React, { useCallback, useEffect, useRef, useState } from 'react';
import Button from '@material-ui/core/Button';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { useAppState } from '../../state';
import { DashboardStat, DashboardTabId, UpcomingSession } from './types';
import { mockDashboardData } from './mockDashboardData';
import DashboardHeader from './DashboardHeader';
import DashboardSidebar from './DashboardSidebar';
import ClassesTab, { createIdempotencyKey } from './ClassesTab';
import HistoryTab from './HistoryTab';
import ResourcesTab from './ResourcesTab';
import CalendarTab from './CalendarTab';
import ConfirmDialog from './ConfirmDialog';
import QuickStartClassPanel from './QuickStartClassPanel';
import TeacherProfilePage from '../TeacherProfilePage/TeacherProfilePage';
import { ClassRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { toClassSessionDisplayName } from '../PreJoinScreens/classSessionTypes';
import { checkRoomOpen } from '../PreJoinScreens/checkRoomOpen';
import { getProfessorInitials } from '../../utils/professorIdentity/professorIdentity';
import { StoredAttentionReport } from '../../components/AttentionProvider/reportTypes';
import { buildUpcomingSessions, findExpiredClasses } from './classSessionsView';
import { buildReportStats, computeTotalHoursTaught } from './reportStats';
import {
  clearPendingAttentionReports,
  getPendingAttentionReports,
  removePendingAttentionReport,
} from '../AttentionReport/pendingAttentionReports';

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.palette.background.default,
  },
  body: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    // Below 'sm' (600px, this app's real mobile switch — see Room.tsx's isMobile) the
    // sidebar becomes a horizontal top strip (DashboardSidebar), so the body stacks
    // vertically instead of splitting the width into a rail + content pane.
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column',
      overflow: 'auto',
    },
  },
  pendingReports: {
    margin: theme.spacing(2, 4, 0),
    padding: theme.spacing(1.5, 2),
    border: '1px solid #f0c36d',
    borderRadius: theme.shape.borderRadius,
    backgroundColor: '#fff8e6',
    color: theme.palette.text.primary,
    fontSize: '0.8125rem',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
  },
}));

interface Props {
  /** Real navigation: starts the highlighted upcoming class immediately. */
  onStartClass: (session: { roomName: string; name: string; classId?: string }) => void;
  /** The protected /profile route reuses this dashboard shell instead of a standalone page. */
  showProfile?: boolean;
  /** Route-derived active tab (see dashboardTabPath) — App.tsx owns the URL, not this component. */
  activeTab?: DashboardTabId;
  onTabChange?: (tab: DashboardTabId) => void;
}

// es-AR lowercases the weekday ("miércoles, 8 de julio de 2026"); the mock data's
// label convention capitalizes it, so we match that by hand.
function capitalizeFirst(value: string): string {
  return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;
}

/**
 * "Panel Docente" — the teacher landing dashboard shown before PreJoinScreens.
 * Owns the active-tab state and composes the shared header/sidebar with one of
 * the four tabs. "Recursos" is fully real (self-fetching from useAppState,
 * firebase-mode only). "Clases" is real for session scheduling (fetch/create/
 * cancel) and for all four of its stat cards (sessions-week/active-students/
 * avg-attention scoped to this week, hours-taught summed across all reports —
 * see reportStats.ts); the Historial/Calendario tabs remain visual-only stubs
 * backed by mockDashboardData.
 *
 * The professor's identity (header name/initials/photo, and the name fed into
 * onStartClass) is the one exception: it is real, not mocked. It must match the
 * signed-in user — the same profile > user displayName priority PreJoinScreens
 * uses — since it also becomes the Twilio room identity when starting a class.
 */
export default function TeacherDashboard({
  onStartClass,
  showProfile = false,
  activeTab = 'clases',
  onTabChange,
}: Props) {
  const classes = useStyles();
  const {
    signOut,
    user,
    profile,
    fetchClasses,
    createClass,
    deleteClass,
    startClass,
    fetchAttentionReports,
    saveAttentionReport,
    requestRecordingArtifact,
    fetchRecordingArtifactStatus,
    fetchRecordingDownloadUrl,
  } = useAppState();
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
  const [reports, setReports] = useState<StoredAttentionReport[] | null>(null);
  const [isReportsLoading, setIsReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const userUid = user && 'uid' in user ? user.uid : undefined;
  const [pendingReports, setPendingReports] = useState(() => getPendingAttentionReports(userUid));
  // The sidebar's "Iniciar clase" only opens this in-dashboard panel (sidebar/navbar stay put);
  // it navigates away to the standalone device-selection prejoin only once a room name is
  // confirmed (see handleQuickStartCreate below).
  const [isQuickStartOpen, setIsQuickStartOpen] = useState(false);
  const data = mockDashboardData;
  const professorName = profile?.displayName || user?.displayName || data.professorName;
  const professorInitials = getProfessorInitials(professorName);

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

  const loadReports = useCallback(() => {
    if (!fetchAttentionReports) return;
    setIsReportsLoading(true);
    setReportsError(null);
    fetchAttentionReports()
      .then(setReports)
      .catch(err => {
        console.error('TeacherDashboard: could not fetch attention reports', err);
        setReportsError(err.message || 'No pudimos consultar el historial de clases.');
      })
      .finally(() => setIsReportsLoading(false));
  }, [fetchAttentionReports]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const retryPendingReports = useCallback(() => {
    if (!saveAttentionReport) return;
    const reportsToRetry = getPendingAttentionReports(userUid);
    if (reportsToRetry.length === 0) return;
    Promise.all(
      reportsToRetry.map(report =>
        saveAttentionReport(report)
          .then(() => {
            removePendingAttentionReport(userUid, report.roomSid);
            return true;
          })
          .catch(error => {
            console.error('attention-report-persistence: retry failed', { roomSid: report.roomSid, error });
            return false;
          })
      )
    ).then(results => {
      if (results.some(Boolean)) setPendingReports(getPendingAttentionReports(userUid));
    });
  }, [saveAttentionReport, userUid]);

  // Auto-retry once on mount if reports were queued from a failed/unload save, and
  // again whenever the browser regains connectivity — the manual "Reintentar
  // guardado" button (below) stays as the visible fallback either way.
  useEffect(() => {
    retryPendingReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.addEventListener('online', retryPendingReports);
    return () => window.removeEventListener('online', retryPendingReports);
  }, [retryPendingReports]);

  const handleSignOut = () => {
    clearPendingAttentionReports(userUid);
    return signOut ? signOut() : Promise.resolve();
  };

  const hasRealClasses = Boolean(fetchClasses && createClass && deleteClass && startClass);
  const hasRealStats = Boolean(fetchAttentionReports);

  const sessions: UpcomingSession[] = hasRealClasses
    ? buildUpcomingSessions(realClasses, Date.now())
    : data.upcomingSessions;
  const dateLabel = hasRealClasses
    ? capitalizeFirst(
        new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      )
    : data.upcomingSessionsDateLabel;

  const stats: DashboardStat[] = hasRealStats
    ? (() => {
        const { sessionsThisWeek, activeStudents, avgAttentionPercent } = buildReportStats(reports || [], Date.now());
        const totalHoursTaught = computeTotalHoursTaught(reports || []);
        return [
          { ...data.stats[0], value: `${sessionsThisWeek}` },
          { ...data.stats[1], value: `${activeStudents}` },
          { ...data.stats[2], value: `${avgAttentionPercent}%` },
          { ...data.stats[3], value: `${totalHoursTaught}h` },
        ];
      })()
    : data.stats;

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

  const confirmCancelClass = () => {
    if (!cancelDialogSession) return;
    cancelClass(cancelDialogSession);
    setIsCancelDialogOpen(false);
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
        'Ya hay una sesión activa con este nombre de sala. Esperá a que termine o cambiá el título de la clase.'
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

  const handleQuickStartCreate = (session: { roomName: string; name: string; title: string }) => {
    setIsQuickStartOpen(false);

    if (!hasRealClasses) {
      onStartClass(session);
      return;
    }

    createClass!({
      title: session.title,
      scheduledAtMs: Date.now(),
      studentCount: 0,
      durationMinutes: 60,
      idempotencyKey: createIdempotencyKey(),
      roomName: session.roomName,
    })
      .then(created =>
        startClass!(created.id, created.roomName).then(() => {
          setRealClasses(current => [created, ...current]);
          onStartClass({ roomName: created.roomName, name: session.name, classId: created.id });
        })
      )
      .catch(err => {
        // Fail open: a Firestore hiccup here must never block the teacher from
        // starting class — same tolerance as rejoinSession/pending-report retry.
        console.error('TeacherDashboard: could not persist quick-started class', err);
        onStartClass(session);
      });
  };

  return (
    <div className={classes.root} data-testid="teacher-dashboard-root">
      <DashboardHeader
        professorName={professorName}
        professorInitials={professorInitials}
        professorPhotoURL={profile?.avatarUrl || user?.photoURL || undefined}
      />
      <div className={classes.body}>
        <DashboardSidebar
          activeTab={showProfile ? undefined : activeTab}
          // Clicking any sidebar tab while the quick-start panel is open also leaves it —
          // it has no back link of its own, since the sidebar navigation already covers that.
          onTabChange={tab => {
            setIsQuickStartOpen(false);
            onTabChange?.(tab);
          }}
          onStartBlankClass={() => setIsQuickStartOpen(true)}
          onSignOut={handleSignOut}
        />
        <div className={classes.content}>
          {pendingReports.length > 0 && (
            <div className={classes.pendingReports} data-testid="dashboard-pending-reports">
              No pudimos guardar {pendingReports.length === 1 ? 'un reporte' : `${pendingReports.length} reportes`} al
              cerrar la clase. Todavía no se enviaron. Puedes reintentar ahora.
              <Button onClick={retryPendingReports} data-testid="dashboard-retry-pending-reports">
                Reintentar guardado
              </Button>
            </div>
          )}
          {isQuickStartOpen && <QuickStartClassPanel professorName={professorName} onCreate={handleQuickStartCreate} />}
          {!isQuickStartOpen && showProfile && <TeacherProfilePage />}
          {!isQuickStartOpen && !showProfile && activeTab === 'clases' && (
            <ClassesTab
              // All four stats are now real, computed from attention reports (see
              // reportStats.ts): sessions-week/active-students/avg-attention are
              // scoped to this week, hours-taught sums durationMs across every report.
              stats={stats}
              dateLabel={dateLabel}
              sessions={sessions}
              professorName={professorName}
              onStartClass={handleStartClass}
              onCreateClass={handleCreateClass}
              onCancelClass={handleCancelClass}
              cancellingClassId={cancellingClassId}
              cancelError={cancelError}
              onRetryCancel={() => cancelRetrySessionRef.current && cancelClass(cancelRetrySessionRef.current)}
              expiredClassesCount={expiredClasses.length}
              onCancelExpiredClasses={handleCancelExpiredClasses}
              isCancellingExpired={isCancellingExpired}
              cancelExpiredError={cancelExpiredError}
              statsAreMock={!hasRealStats}
              sessionsAreMock={!hasRealClasses}
              startClassError={startClassError}
              isStartingClass={isStartingClass}
            />
          )}
          {!isQuickStartOpen && !showProfile && activeTab === 'historial' && (
            <HistoryTab
              reports={reports}
              isLoading={isReportsLoading}
              error={reportsError}
              onRetry={loadReports}
              onOpenReport={report => {
                window.open(`/report/${encodeURIComponent(report.roomSid)}`, '_blank', 'noopener');
              }}
              onRequestRecording={requestRecordingArtifact}
              onCheckRecordingStatus={fetchRecordingArtifactStatus}
              onGetRecordingDownloadUrl={fetchRecordingDownloadUrl}
            />
          )}
          {!isQuickStartOpen && !showProfile && activeTab === 'recursos' && <ResourcesTab classes={realClasses} />}
          {!isQuickStartOpen && !showProfile && activeTab === 'calendario' && (
            <CalendarTab
              classes={fetchClasses ? realClasses : null}
              isLoading={isClassesLoading}
              error={classesError}
              onRetry={loadClasses}
              onStartClass={classRecord => startScheduledClass(classRecord.id, classRecord.roomName)}
              onCancelClass={handleCancelClass}
              cancellingClassId={cancellingClassId}
              cancelError={cancelError}
              onRetryCancel={() => cancelRetrySessionRef.current && cancelClass(cancelRetrySessionRef.current)}
              expiredClassIds={expiredClassIds}
            />
          )}
        </div>
      </div>
      <ConfirmDialog
        open={isCancelDialogOpen}
        title="Cancelar clase"
        message={`¿Cancelar "${cancelDialogSession?.title}"? Esta acción no se puede deshacer.`}
        confirmLabel="Cancelar clase"
        cancelLabel="Volver"
        isConfirming={cancellingClassId === cancelDialogSession?.id}
        onConfirm={confirmCancelClass}
        onCancel={() => setIsCancelDialogOpen(false)}
      />
      <ConfirmDialog
        open={isCancelExpiredDialogOpen}
        title="Cancelar clases vencidas"
        message={`¿Cancelar ${
          expiredClasses.length === 1 ? 'la clase vencida' : `las ${expiredClasses.length} clases vencidas`
        }? Esta acción no se puede deshacer.`}
        confirmLabel="Cancelar"
        cancelLabel="Volver"
        isConfirming={isCancellingExpired}
        onConfirm={confirmCancelExpiredClasses}
        onCancel={() => setIsCancelExpiredDialogOpen(false)}
      />
    </div>
  );
}
