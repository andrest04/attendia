import React, { useState } from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { useAppState } from '../../state';
import { DashboardTabId } from './types';
import { mockDashboardData } from './mockDashboardData';
import DashboardHeader from './DashboardHeader';
import DashboardSidebar from './DashboardSidebar';
import ClassesTab from './ClassesTab';
import HistoryTab from './HistoryTab';
import ResourcesTab from './ResourcesTab';
import CalendarTab from './CalendarTab';

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

/**
 * "Panel Docente" — the teacher landing dashboard shown before PreJoinScreens.
 * Owns the active-tab state and composes the shared header/sidebar with one of
 * the four tabs. All content besides the highlighted "Iniciar sesión" CTA and the
 * sidebar's "Iniciar clase" button is a visual-only stub, backed by mockDashboardData.
 */
export default function TeacherDashboard({ onStartClass, onStartBlankClass }: Props) {
  const classes = useStyles();
  const { signOut } = useAppState();
  const [activeTab, setActiveTab] = useState<DashboardTabId>('clases');
  const data = mockDashboardData;

  return (
    <div className={classes.root} data-testid="teacher-dashboard-root">
      <DashboardHeader professorName={data.professorName} professorInitials={data.professorInitials} />
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
              stats={data.stats}
              dateLabel={data.upcomingSessionsDateLabel}
              sessions={data.upcomingSessions}
              professorName={data.professorName}
              onStartClass={onStartClass}
            />
          )}
          {activeTab === 'historial' && <HistoryTab rows={data.historyRows} />}
          {activeTab === 'recursos' && <ResourcesTab groups={data.resourceGroups} />}
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
