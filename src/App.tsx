import React from 'react';
import { styled, Theme } from '@material-ui/core/styles';
import { useMediaQuery, useTheme } from '@material-ui/core';
import { useHistory, useLocation } from 'react-router-dom';

import MenuBar from './components/MenuBar/MenuBar';
import MobileTopMenuBar from './components/MobileTopMenuBar/MobileTopMenuBar';
import PreJoinScreens from './components/PreJoinScreens/PreJoinScreens';
import ReconnectingNotification from './components/ReconnectingNotification/ReconnectingNotification';
import RecordingNotifications from './components/RecordingNotifications/RecordingNotifications';
import Room from './components/Room/Room';
import SessionEndedScreen from './components/SessionEndedScreen/SessionEndedScreen';
import TeacherDashboard from './components/TeacherDashboard';
import useDashboardHandoff from './components/TeacherDashboard/useDashboardHandoff';
import useDashboardRouteSync from './components/TeacherDashboard/useDashboardRouteSync';
import useInitialRole from './components/TeacherDashboard/useInitialRole';
import { dashboardTabPath } from './components/TeacherDashboard/dashboardHelpers';
import { DashboardTabId } from './components/TeacherDashboard/types';

import useHeight from './hooks/useHeight/useHeight';
import useRoomState from './hooks/useRoomState/useRoomState';
import { useAppState } from './state';

const Container = styled('div')({
  display: 'grid',
  gridTemplateRows: '1fr auto',
});

const Main = styled('main')(({ theme }: { theme: Theme }) => ({
  overflow: 'hidden',
  // On desktop the room shells render their own in-layout toolbar, so no footer space is reserved.
  // The legacy fixed MenuBar only renders on mobile, so we keep the footer padding there.
  background: 'black',
  [theme.breakpoints.down('sm')]: {
    paddingBottom: `${theme.mobileFooterHeight + theme.mobileTopBarHeight}px`, // Leave some space for the mobile header and footer
  },
}));

export default function App() {
  const roomState = useRoomState();
  const { sessionEndedByProfessor } = useAppState();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const history = useHistory();
  const location = useLocation();

  // Here we would like the height of the main container to be the height of the viewport.
  // On some mobile browsers, 'height: 100vh' sets the height equal to that of the screen,
  // not the viewport. This looks bad when the mobile browsers location bar is open.
  // We will dynamically set the height with 'window.innerHeight', which means that this
  // will look good on mobile browsers even after the location bar opens or closes.
  const height = useHeight();

  // The teacher landing dashboard ("Panel Docente") is shown before the prejoin lobby, only
  // for teachers. Picking a class (or the sidebar's blank "Iniciar clase") drops into the
  // existing prejoin flow; it comes back once that class's room disconnects (see
  // useDashboardHandoff), so it's a "between classes" landing page, not a one-shot screen.
  const initialRole = useInitialRole();
  const {
    dashboardActive,
    pendingSession,
    handleStartClass,
    handleStartBlankClass,
    handleReturnToDashboard,
  } = useDashboardHandoff(initialRole, roomState);
  useDashboardRouteSync(dashboardActive);
  const isProfileRoute = location.pathname === '/profile';
  const activeTabFromRoute = (Object.keys(dashboardTabPath) as DashboardTabId[]).find(
    tab => dashboardTabPath[tab] === location.pathname
  );
  const isDashboardTabRoute = activeTabFromRoute !== undefined;
  const activeTab: DashboardTabId = activeTabFromRoute ?? 'clases';
  const navigateToDashboardTab = (tab: DashboardTabId) => history.push(dashboardTabPath[tab]);
  // Starting a class must also leave whichever /dashboard/* tab route is active — otherwise
  // isDashboardTabRoute stays true and keeps TeacherDashboard mounted despite dashboardActive
  // flipping to false, so the click appears to do nothing.
  const startClass = (session: { roomName: string; name: string; classId?: string }) => {
    handleStartClass(session);
    if (isDashboardTabRoute) history.push('/');
  };
  const startBlankClass = () => {
    handleStartBlankClass();
    if (isDashboardTabRoute) history.push('/');
  };

  return (
    <Container style={{ height }}>
      {sessionEndedByProfessor ? (
        <SessionEndedScreen />
      ) : dashboardActive || isProfileRoute || isDashboardTabRoute ? (
        <TeacherDashboard
          onStartClass={startClass}
          onStartBlankClass={startBlankClass}
          showProfile={isProfileRoute}
          activeTab={activeTab}
          onTabChange={navigateToDashboardTab}
        />
      ) : roomState === 'disconnected' ? (
        <PreJoinScreens
          initialClassSession={pendingSession ?? undefined}
          // Only teachers have a dashboard to go back to; students never see the affordance.
          onReturnToDashboard={initialRole === 'teacher' ? handleReturnToDashboard : undefined}
        />
      ) : (
        <Main>
          <ReconnectingNotification />
          <RecordingNotifications />
          <MobileTopMenuBar />
          <Room />
          {isMobile && <MenuBar />}
        </Main>
      )}
    </Container>
  );
}
