import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom';

import { CssBaseline } from '@material-ui/core';
import { makeStyles, MuiThemeProvider } from '@material-ui/core/styles';

import App from './App';
import AppStateProvider, { useAppState } from './state';
import { BrowserRouter as Router, Redirect, Route, Switch } from 'react-router-dom';
import ErrorDialog from './components/ErrorDialog/ErrorDialog';
import PrivateRoute from './components/PrivateRoute/PrivateRoute';
import theme from './theme';
import './types';
import { SnackbarProvider } from 'notistack';
import { ChatProvider } from './components/ChatProvider';
import { AttentionProvider } from './components/AttentionProvider';
import { ParticipantProvider } from './components/ParticipantProvider';
import { VideoProvider } from './components/VideoProvider';
import useConnectionOptions from './utils/useConnectionOptions/useConnectionOptions';
import UnsupportedBrowserWarning from './components/UnsupportedBrowserWarning/UnsupportedBrowserWarning';
import { dashboardTabPath } from './components/TeacherDashboard/dashboardHelpers';
import SnackbarCloseButton from './components/SnackbarCloseButton/SnackbarCloseButton';

// Standalone pages (outside the room) are code-split so their weight — recharts,
// page-only UI — stays out of the main bundle. VideoApp stays eager: it is the
// core path and must never wait on a network round-trip.
const LoginPage = lazy(() => import('./components/LoginPage/LoginPage'));
const SecurityPage = lazy(() => import('./components/SecurityPage/SecurityPage'));
const ClassHistoryPage = lazy(() => import('./components/ClassHistoryPage/ClassHistoryPage'));
const ManualPage = lazy(() => import('./components/ManualPage/ManualPage'));
const ReportPage = lazy(() => import('./components/ReportPage/ReportPage'));
const ResourceViewerPage = lazy(() => import('./components/ResourceViewerPage/ResourceViewerPage'));
const RecordingViewerPage = lazy(() => import('./components/RecordingViewerPage/RecordingViewerPage'));

// DashboardHeader (Panel Docente, including /profile) is a fixed 64px top bar; without
// this offset, top-right toasts render underneath it and cover the profile name/photo.
const useSnackbarStyles = makeStyles({
  containerAnchorOriginTopRight: {
    top: '76px !important',
  },
});

export const VideoApp = () => {
  const { error, setError } = useAppState();
  const connectionOptions = useConnectionOptions();
  const snackbarClasses = useSnackbarStyles();

  return (
    <VideoProvider options={connectionOptions} onError={setError}>
      <ErrorDialog dismissError={() => setError(null)} error={error} />
      <ParticipantProvider>
        <ChatProvider>
          <AttentionProvider>
            {/* In-room transient notifications (join/leave, raise-hand, turn, recording).
                maxSnack + autoHide keep it signal, not noise. */}
            <SnackbarProvider
              maxSnack={3}
              autoHideDuration={4000}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              dense
              classes={snackbarClasses}
              action={snackbarKey => <SnackbarCloseButton snackbarKey={snackbarKey} />}
            >
              <App />
            </SnackbarProvider>
          </AttentionProvider>
        </ChatProvider>
      </ParticipantProvider>
    </VideoProvider>
  );
};

export const AppRoutes = () => (
  <Switch>
    <PrivateRoute exact path="/">
      <VideoApp />
    </PrivateRoute>
    <PrivateRoute path="/room/:URLRoomName">
      <VideoApp />
    </PrivateRoute>
    <Route path="/login">
      <LoginPage />
    </Route>
    <Route path="/security">
      <SecurityPage />
    </Route>
    {/* Full user manual — plain route, opened in a new tab from the in-room tutorial. */}
    <Route path="/manual">
      <ManualPage />
    </Route>
    {/* A report is loaded from the authenticated teacher's Firestore slice,
                  never from browser storage shared with later users. */}
    <PrivateRoute exact path="/report/:roomSid">
      <ReportPage />
    </PrivateRoute>
    {/* Teacher class history — needs auth (PrivateRoute) but NOT the SDK
                providers, which live inside VideoApp, so this stays lightweight. */}
    <PrivateRoute path="/history">
      <ClassHistoryPage />
    </PrivateRoute>
    <PrivateRoute exact path="/profile">
      <VideoApp />
    </PrivateRoute>
    {/* Teacher dashboard tabs — real routes so the URL reflects the active tab
                  (bookmarks, refresh, browser back/forward). Same shape as /profile: all
                  render VideoApp, and App.tsx derives which tab to show from the pathname. */}
    <PrivateRoute exact path={dashboardTabPath.clases}>
      <VideoApp />
    </PrivateRoute>
    <PrivateRoute exact path={dashboardTabPath.historial}>
      <VideoApp />
    </PrivateRoute>
    <PrivateRoute exact path={dashboardTabPath.recursos}>
      <VideoApp />
    </PrivateRoute>
    {/* Document viewer, opened in a NEW TAB from the "Ver" button on Recursos — plain
                  standalone page (no SDK providers), same shape as /report. */}
    <PrivateRoute exact path={`${dashboardTabPath.recursos}/:resourceId/ver`}>
      <ResourceViewerPage />
    </PrivateRoute>
    {/* Recording player, opened in a NEW TAB from "Ver grabación" on Historial — plain
                  standalone page (no SDK providers), same shape as /report. */}
    <PrivateRoute exact path="/recording/:roomSid">
      <RecordingViewerPage />
    </PrivateRoute>
    <PrivateRoute exact path={dashboardTabPath.calendario}>
      <VideoApp />
    </PrivateRoute>
    <Redirect to="/" />
  </Switch>
);

export const ReactApp = () => (
  <MuiThemeProvider theme={theme}>
    <CssBaseline />
    <UnsupportedBrowserWarning>
      <Router>
        <AppStateProvider>
          {/* Single boundary for the lazy standalone pages. The fallback is
              intentionally empty: these pages own the full viewport, so there is
              no surrounding layout to jank while the chunk loads. */}
          <Suspense fallback={null}>
            <AppRoutes />
          </Suspense>
        </AppStateProvider>
      </Router>
    </UnsupportedBrowserWarning>
  </MuiThemeProvider>
);

ReactDOM.render(<ReactApp />, document.getElementById('root'));
