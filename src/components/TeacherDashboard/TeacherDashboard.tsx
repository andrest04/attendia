import React, { useMemo, useState } from 'react';
import Button from '@material-ui/core/Button';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { useAppState } from '../../state';
import { DashboardTabId } from './types';
import { mockDashboardData } from './mockDashboardData';
import DashboardHeader from './DashboardHeader';
import DashboardSidebar from './DashboardSidebar';
import NotificationDropdown from './NotificationDropdown';
import useTeacherNotifications from './useTeacherNotifications';
import useTeacherClasses from './useTeacherClasses';
import useTeacherReports from './useTeacherReports';
import ClassesTab, { createIdempotencyKey } from './ClassesTab';
import HistoryTab from './HistoryTab';
import ResourcesTab from './ResourcesTab';
import CalendarTab from './CalendarTab';
import ConfirmDialog from './ConfirmDialog';
import QuickStartClassPanel from './QuickStartClassPanel';
import TeacherProfilePage from '../TeacherProfilePage/TeacherProfilePage';
import { ReportFailureClaim, TeacherNotification } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { getProfessorInitials, resolveProfilePhotoURL } from '../../utils/professorIdentity/professorIdentity';
import { dashboardTabPath } from './dashboardHelpers';
import { clearPendingAttentionReports, getPendingAttentionReports } from '../AttentionReport/pendingAttentionReports';

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
    // The app theme maps `sm` to 960px. DashboardSidebar becomes a horizontal top
    // strip below it, so content keeps the full viewport width.
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
    minWidth: 0,
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
  onNotificationNavigate?: (path: string) => void;
}

function notificationDestinationPath(notification: TeacherNotification): string {
  if (notification.destination.kind === 'classes') return dashboardTabPath.clases;
  if (notification.destination.kind === 'recording') {
    return `/recording/${encodeURIComponent(notification.destination.roomSid)}`;
  }
  return dashboardTabPath.historial;
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
  onNotificationNavigate,
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
    fetchNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    reconcileNotifications,
  } = useAppState();
  const userUid = user && 'uid' in user ? user.uid : undefined;
  const [pendingReports, setPendingReports] = useState(() => getPendingAttentionReports(userUid));
  const notificationApi = useMemo(
    () => ({
      fetchNotifications: (cursor?: string) => fetchNotifications!(cursor),
      markNotificationRead: (id: string) => markNotificationRead!(id),
      markAllNotificationsRead: (key: string) => markAllNotificationsRead!(key),
      clearNotifications: (key: string) => clearNotifications!(key),
      reconcileNotifications: (scope: 'all' | 'recordings', claims?: ReportFailureClaim[]) =>
        reconcileNotifications!(scope, claims),
    }),
    [fetchNotifications, markNotificationRead, markAllNotificationsRead, clearNotifications, reconcileNotifications]
  );
  const pendingFailureClaims = useMemo(
    () =>
      pendingReports.map(report => ({
        reportId: report.roomSid,
        failureEpisodeId: report.failureEpisodeId,
        firstFailedAtMs: report.firstFailedAtMs,
      })),
    [pendingReports]
  );
  const notifications = useTeacherNotifications(notificationApi, undefined, pendingFailureClaims, {
    enabled: Boolean(
      userUid &&
        fetchNotifications &&
        markNotificationRead &&
        markAllNotificationsRead &&
        clearNotifications &&
        reconcileNotifications
    ),
    userKey: userUid || null,
  });
  // The sidebar's "Iniciar clase" only opens this in-dashboard panel (sidebar/navbar stay put);
  // it navigates away to the standalone device-selection prejoin only once a room name is
  // confirmed (see handleQuickStartCreate below).
  const [isQuickStartOpen, setIsQuickStartOpen] = useState(false);
  const data = mockDashboardData;
  const professorName = profile?.displayName || user?.displayName || data.professorName;
  const professorInitials = getProfessorInitials(professorName);

  const {
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
    handleCreateClass,
    handleCancelClass,
    handleDeleteClassFromResources,
    confirmCancelClass,
    retryCancelClass,
    handleCancelExpiredClasses,
    confirmCancelExpiredClasses,
    startScheduledClass,
    handleStartClass,
  } = useTeacherClasses({
    fetchClasses,
    createClass,
    deleteClass,
    startClass,
    professorName,
    onStartClass,
    refreshNotifications: notifications.refresh,
  });

  // retryPendingReports/pendingReports below are threaded across two hooks
  // (useTeacherReports needs to call notifications.refresh() on a successful
  // retry, but notifications itself needs pendingFailureClaims built from
  // pendingReports state above) — pendingReports/setPendingReports therefore
  // stay declared here rather than inside useTeacherReports.
  const {
    reports,
    isReportsLoading,
    reportsError,
    loadReports,
    retryPendingReports,
    hasRealStats,
    stats,
  } = useTeacherReports({
    fetchAttentionReports,
    saveAttentionReport,
    userUid,
    setPendingReports,
    notifications,
  });

  const handleSignOut = () => {
    clearPendingAttentionReports(userUid);
    return signOut ? signOut() : Promise.resolve();
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
        professorPhotoURL={resolveProfilePhotoURL(profile?.avatarUrl, profile?.avatarRemoved, user?.photoURL)}
        onLogoClick={onTabChange ? () => onTabChange('clases') : undefined}
        notificationUnreadCount={notifications.unreadCount}
        notificationContent={close => (
          <NotificationDropdown
            {...notifications}
            onNotificationClick={notification =>
              notifications
                .markRead(notification.notificationId)
                .then(() => {
                  onNotificationNavigate?.(notificationDestinationPath(notification));
                  close();
                })
                .catch(() => undefined)
            }
            onLoadMore={notifications.loadMore}
            onMarkAllRead={notifications.markAllRead}
            onClearAll={notifications.clearAll}
          />
        )}
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
              existingClasses={realClasses}
              professorName={professorName}
              onStartClass={handleStartClass}
              onCreateClass={handleCreateClass}
              onCancelClass={handleCancelClass}
              cancellingClassId={cancellingClassId}
              cancelError={cancelError}
              onRetryCancel={retryCancelClass}
              expiredClassesCount={expiredClasses.length}
              expiredSessions={expiredSessions}
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
            />
          )}
          {!isQuickStartOpen && !showProfile && activeTab === 'recursos' && (
            <ResourcesTab
              classes={realClasses}
              expiredClassIds={expiredClassIds}
              onDeleteClass={handleDeleteClassFromResources}
            />
          )}
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
              onRetryCancel={retryCancelClass}
              expiredClassIds={expiredClassIds}
            />
          )}
        </div>
      </div>
      <ConfirmDialog
        open={cancelDialog.isOpen}
        title="Cancelar clase"
        message={`¿Cancelar "${cancelDialog.target?.title}"? Esta acción no se puede deshacer.`}
        confirmLabel="Cancelar clase"
        cancelLabel="Volver"
        isConfirming={cancellingClassId === cancelDialog.target?.id}
        onConfirm={confirmCancelClass}
        onCancel={cancelDialog.close}
      />
      <ConfirmDialog
        open={cancelExpiredDialog.isOpen}
        title="Cancelar clases vencidas"
        message={`¿Cancelar ${
          expiredClasses.length === 1 ? 'la clase vencida' : `las ${expiredClasses.length} clases vencidas`
        }? Esta acción no se puede deshacer.`}
        confirmLabel="Cancelar"
        cancelLabel="Volver"
        isConfirming={isCancellingExpired}
        onConfirm={confirmCancelExpiredClasses}
        onCancel={cancelExpiredDialog.close}
      />
    </div>
  );
}
