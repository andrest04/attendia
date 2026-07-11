import React, { useCallback, useEffect, useRef, useState } from 'react';
import Button from '@material-ui/core/Button';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { useAppState } from '../../state';
import { DashboardStat, DashboardTabId, UpcomingSession } from './types';
import { mockDashboardData } from './mockDashboardData';
import DashboardHeader from './DashboardHeader';
import DashboardSidebar from './DashboardSidebar';
import ClassesTab from './ClassesTab';
import HistoryTab from './HistoryTab';
import ResourcesTab from './ResourcesTab';
import CalendarTab from './CalendarTab';
import TeacherProfilePage from '../TeacherProfilePage/TeacherProfilePage';
import { ClassRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { StoredAttentionReport } from '../../components/AttentionProvider/reportTypes';
import { buildUpcomingSessions, findExpiredClasses } from './classSessionsView';
import { buildReportStats } from './reportStats';
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
  /** Real navigation: the sidebar's "Iniciar clase" button goes straight to the blank prejoin flow. */
  onStartBlankClass: () => void;
  /** The protected /profile route reuses this dashboard shell instead of a standalone page. */
  showProfile?: boolean;
  onReturnToClasses?: () => void;
  /** Route-derived active tab (see dashboardTabPath) — App.tsx owns the URL, not this component. */
  activeTab?: DashboardTabId;
  onTabChange?: (tab: DashboardTabId) => void;
}

// Up to 2 uppercase initials from a full name (first + last word), matching the
// avatar convention used elsewhere in the app (e.g. professorShellHelpers.getInitials).
function getProfessorInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
 * cancel) and for three of its four stat cards (sessions-week/active-students/
 * avg-attention, computed from this week's attention reports — see
 * reportStats.ts); its "hours-taught" card and the Historial/Calendario tabs
 * remain visual-only stubs backed by mockDashboardData.
 *
 * The professor's identity (header name/initials/photo, and the name fed into
 * onStartClass) is the one exception: it is real, not mocked. It must match the
 * signed-in user — the same profile > user displayName priority PreJoinScreens
 * uses — since it also becomes the Twilio room identity when starting a class.
 */
export default function TeacherDashboard({
  onStartClass,
  onStartBlankClass,
  showProfile = false,
  onReturnToClasses,
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
  } = useAppState();
  const [realClasses, setRealClasses] = useState<ClassRecord[]>([]);
  const [isClassesLoading, setIsClassesLoading] = useState(false);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [cancellingClassId, setCancellingClassId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const cancelRetrySessionRef = useRef<UpcomingSession | null>(null);
  const [isCancellingExpired, setIsCancellingExpired] = useState(false);
  const [cancelExpiredError, setCancelExpiredError] = useState<string | null>(null);
  const [reports, setReports] = useState<StoredAttentionReport[] | null>(null);
  const [isReportsLoading, setIsReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const userUid = user && 'uid' in user ? user.uid : undefined;
  const [pendingReports, setPendingReports] = useState(() => getPendingAttentionReports(userUid));
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

  const retryPendingReports = () => {
    if (!saveAttentionReport) return;
    Promise.all(
      pendingReports.map(report =>
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
  };

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
        return [
          { ...data.stats[0], value: `${sessionsThisWeek}` },
          { ...data.stats[1], value: `${activeStudents}` },
          { ...data.stats[2], value: `${avgAttentionPercent}%` },
          // hours-taught stays mocked verbatim — see the comment on ClassesTab below.
          data.stats[3],
        ];
      })()
    : data.stats;

  const handleCreateClass = hasRealClasses
    ? (input: { title: string; scheduledAtMs: number; studentCount: number; idempotencyKey: string }) =>
        createClass!(input).then(created => {
          setRealClasses(current => [created, ...current]);
        })
    : undefined;

  const cancelClass = (session: UpcomingSession) => {
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
    ? (session: UpcomingSession) => {
        if (!window.confirm(`¿Cancelar "${session.title}"? Esta acción no se puede deshacer.`)) return;
        cancelClass(session);
      }
    : undefined;

  const expiredClasses = hasRealClasses ? findExpiredClasses(realClasses, Date.now()) : [];

  const handleCancelExpiredClasses = hasRealClasses
    ? () => {
        if (expiredClasses.length === 0) return;
        if (
          !window.confirm(
            `¿Cancelar ${
              expiredClasses.length === 1 ? 'la clase vencida' : `las ${expiredClasses.length} clases vencidas`
            }? Esta acción no se puede deshacer.`
          )
        )
          return;
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
              failedCount === 1
                ? 'No pudimos cancelar 1 clase vencida.'
                : `No pudimos cancelar ${failedCount} clases vencidas.`
            );
          }
          setIsCancellingExpired(false);
        });
      }
    : undefined;

  const startScheduledClass = (classId: string, roomName: string) => {
    startClass!(classId, roomName)
      .then(() => onStartClass({ roomName, name: professorName, classId }))
      .catch(err => setClassesError(err.message || 'No pudimos iniciar la clase programada.'));
  };

  const handleStartClass = (session: { roomName: string; name: string; classId?: string }) => {
    if (session.classId) {
      startScheduledClass(session.classId, session.roomName);
      return;
    }
    onStartClass(session);
  };

  return (
    <div className={classes.root} data-testid="teacher-dashboard-root">
      <DashboardHeader
        professorName={professorName}
        professorInitials={professorInitials}
        professorPhotoURL={profile?.avatarDataUrl || user?.photoURL || undefined}
      />
      <div className={classes.body}>
        <DashboardSidebar
          activeTab={showProfile ? undefined : activeTab}
          onTabChange={tab => onTabChange?.(tab)}
          onStartBlankClass={onStartBlankClass}
          onSignOut={handleSignOut}
        />
        <div className={classes.content}>
          {pendingReports.length > 0 && (
            <div className={classes.pendingReports} data-testid="dashboard-pending-reports">
              No pudimos guardar {pendingReports.length === 1 ? 'un reporte' : `${pendingReports.length} reportes`} al
              cerrar la clase. Todavía no se enviaron. Podés reintentar ahora.
              <Button onClick={retryPendingReports} data-testid="dashboard-retry-pending-reports">
                Reintentar guardado
              </Button>
            </div>
          )}
          {showProfile && <TeacherProfilePage onReturnToClasses={onReturnToClasses} />}
          {!showProfile && activeTab === 'clases' && (
            <ClassesTab
              // sessions-week/active-students/avg-attention are now real, computed
              // from this week's attention reports (see reportStats.ts). hours-taught
              // stays mocked on purpose: there is no session-duration data anywhere in
              // the app (the attention report schema has no start/duration field, and
              // the live timeline is a capped rolling window, not total session
              // length) — this is intentional, not an oversight.
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
            />
          )}
          {!showProfile && activeTab === 'historial' && (
            <HistoryTab
              reports={reports}
              isLoading={isReportsLoading}
              error={reportsError}
              onRetry={loadReports}
              onOpenReport={report => {
                window.open(`/report/${encodeURIComponent(report.roomSid)}`, '_blank', 'noopener');
              }}
            />
          )}
          {!showProfile && activeTab === 'recursos' && <ResourcesTab classes={realClasses} />}
          {!showProfile && activeTab === 'calendario' && (
            <CalendarTab
              classes={fetchClasses ? realClasses : null}
              isLoading={isClassesLoading}
              error={classesError}
              onRetry={loadClasses}
              onStartClass={classRecord => startScheduledClass(classRecord.id, classRecord.roomName)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
