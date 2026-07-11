import React from 'react';
import { styled, Theme } from '@material-ui/core/styles';
import { useMediaQuery, useTheme } from '@material-ui/core';

import MenuBar from './components/MenuBar/MenuBar';
import MobileTopMenuBar from './components/MobileTopMenuBar/MobileTopMenuBar';
import PreJoinScreens from './components/PreJoinScreens/PreJoinScreens';
import ReconnectingNotification from './components/ReconnectingNotification/ReconnectingNotification';
import RecordingNotifications from './components/RecordingNotifications/RecordingNotifications';
import Room from './components/Room/Room';
import SessionEndedScreen from './components/SessionEndedScreen/SessionEndedScreen';
import TeacherDashboard from './components/TeacherDashboard';
import useDashboardHandoff from './components/TeacherDashboard/useDashboardHandoff';
import useInitialRole from './components/TeacherDashboard/useInitialRole';

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

  return (
    <Container style={{ height }}>
      {sessionEndedByProfessor ? (
        <SessionEndedScreen />
      ) : dashboardActive ? (
        <TeacherDashboard onStartClass={handleStartClass} onStartBlankClass={handleStartBlankClass} />
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
