import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom';

import { CssBaseline } from '@material-ui/core';
import { MuiThemeProvider } from '@material-ui/core/styles';

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

// Standalone pages (outside the room) are code-split so their weight — recharts,
// page-only UI — stays out of the main bundle. VideoApp stays eager: it is the
// core path and must never wait on a network round-trip.
const LoginPage = lazy(() => import('./components/LoginPage/LoginPage'));
const SecurityPage = lazy(() => import('./components/SecurityPage/SecurityPage'));
const ClassHistoryPage = lazy(() => import('./components/ClassHistoryPage/ClassHistoryPage'));
const ManualPage = lazy(() => import('./components/ManualPage/ManualPage'));
const ReportPage = lazy(() => import('./components/ReportPage/ReportPage'));

const VideoApp = () => {
  const { error, setError } = useAppState();
  const connectionOptions = useConnectionOptions();

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
            >
              <App />
            </SnackbarProvider>
          </AttentionProvider>
        </ChatProvider>
      </ParticipantProvider>
    </VideoProvider>
  );
};

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
              {/* Attention report — plain route, opened in a new tab from the in-room
                "Ver reporte" action; renders a localStorage snapshot, no SDK providers. */}
              <Route path="/report">
                <ReportPage />
              </Route>
              {/* Teacher class history — needs auth (PrivateRoute) but NOT the SDK
                providers, which live inside VideoApp, so this stays lightweight. */}
              <PrivateRoute path="/history">
                <ClassHistoryPage />
              </PrivateRoute>
              <Redirect to="/" />
            </Switch>
          </Suspense>
        </AppStateProvider>
      </Router>
    </UnsupportedBrowserWarning>
  </MuiThemeProvider>
);

ReactDOM.render(<ReactApp />, document.getElementById('root'));
