import React, { useEffect, useState } from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { useAppState } from '../../state';
import { DashboardTabId, UpcomingSession } from './types';
import { mockDashboardData } from './mockDashboardData';
import DashboardHeader from './DashboardHeader';
import DashboardSidebar from './DashboardSidebar';
import ClassesTab from './ClassesTab';
import HistoryTab from './HistoryTab';
import ResourcesTab from './ResourcesTab';
import CalendarTab from './CalendarTab';
import { ClassRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { buildUpcomingSessions } from './classSessionsView';

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
  content: {
    flex: 1,
    overflowY: 'auto',
  },
}));

interface Props {
  /** Real navigation: starts the highlighted upcoming class immediately. */
  onStartClass: (session: { roomName: string; name: string }) => void;
  /** Real navigation: the sidebar's "Iniciar clase" button goes straight to the blank prejoin flow. */
  onStartBlankClass: () => void;
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
 * the four tabs. Besides the highlighted "Iniciar sesión" CTA and the sidebar's
 * "Iniciar clase" button, only "Recursos" is real (self-fetching from useAppState,
 * firebase-mode only) — Clases/Historial/Calendario remain visual-only stubs
 * backed by mockDashboardData.
 *
 * The professor's identity (header name/initials/photo, and the name fed into
 * onStartClass) is the one exception: it is real, not mocked. It must match the
 * signed-in user — the same profile > user displayName priority PreJoinScreens
 * uses — since it also becomes the Twilio room identity when starting a class.
 */
export default function TeacherDashboard({ onStartClass, onStartBlankClass }: Props) {
  const classes = useStyles();
  const { signOut, user, profile, fetchClasses, createClass, deleteClass } = useAppState();
  const [activeTab, setActiveTab] = useState<DashboardTabId>('clases');
  const [realClasses, setRealClasses] = useState<ClassRecord[]>([]);
  const data = mockDashboardData;
  const professorName = profile?.displayName || user?.displayName || data.professorName;
  const professorInitials = getProfessorInitials(professorName);

  useEffect(() => {
    if (!fetchClasses) return;
    // No loading/error UI here on purpose: unlike ResourcesTab (which owns its
    // whole tab), ClassesTab is a thin presentational component fed by props, so a
    // failed background fetch just leaves the grid empty instead of blocking render.
    let isMounted = true;
    fetchClasses()
      .then(fetched => {
        if (isMounted) setRealClasses(fetched);
      })
      .catch(err => console.error('TeacherDashboard: could not fetch classes', err));
    return () => {
      isMounted = false;
    };
  }, [fetchClasses]);

  const hasRealClasses = Boolean(fetchClasses && createClass && deleteClass);

  const sessions: UpcomingSession[] = hasRealClasses
    ? buildUpcomingSessions(realClasses, Date.now())
    : data.upcomingSessions;
  const dateLabel = hasRealClasses
    ? capitalizeFirst(
        new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      )
    : data.upcomingSessionsDateLabel;

  const handleCreateClass = hasRealClasses
    ? (input: { title: string; scheduledAtMs: number; studentCount: number }) =>
        createClass!(input).then(created => {
          setRealClasses(current => [created, ...current]);
        })
    : undefined;

  const handleCancelClass = hasRealClasses
    ? (session: UpcomingSession) => {
        if (!window.confirm(`¿Cancelar "${session.title}"? Esta acción no se puede deshacer.`)) return;
        deleteClass!(session.id).then(() => {
          setRealClasses(current => current.filter(c => c.id !== session.id));
        });
      }
    : undefined;

  return (
    <div className={classes.root} data-testid="teacher-dashboard-root">
      <DashboardHeader
        professorName={professorName}
        professorInitials={professorInitials}
        professorPhotoURL={user?.photoURL || undefined}
      />
      <div className={classes.body}>
        <DashboardSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onStartBlankClass={onStartBlankClass}
          onSignOut={signOut}
        />
        <div className={classes.content}>
          {activeTab === 'clases' && (
            <ClassesTab
              // Stat cards stay mocked — they need history/attention data this pass
              // doesn't touch. Deferred, not forgotten.
              stats={data.stats}
              dateLabel={dateLabel}
              sessions={sessions}
              professorName={professorName}
              onStartClass={onStartClass}
              onCreateClass={handleCreateClass}
              onCancelClass={handleCancelClass}
            />
          )}
          {activeTab === 'historial' && <HistoryTab rows={data.historyRows} />}
          {activeTab === 'recursos' && <ResourcesTab />}
          {activeTab === 'calendario' && (
            <CalendarTab
              monthLabel={data.calendarMonthLabel}
              days={data.calendarDays}
              selectedDay={data.selectedDay}
              sessionsForSelectedDay={data.calendarSessionsForSelectedDay}
              summary={data.calendarSummary}
            />
          )}
        </div>
      </div>
    </div>
  );
}
