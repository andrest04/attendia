import { dashboardTabPath } from './components/TeacherDashboard/dashboardHelpers';

/**
 * Every URL of the app in one place. Route patterns (what `<Route path>` matches) and the builders
 * that fill them in (what `history.push` / `window.open` receive) used to be string literals
 * scattered over the router, the pages and the dashboard, each free to drift from the others.
 */
export const routes = {
  home: '/',
  login: '/login',
  security: '/security',
  manual: '/manual',
  history: '/history',
  profile: '/profile',
  /** A class room by name; also the deep link students join through. */
  room: '/room/:URLRoomName',
  report: '/report/:roomSid',
  recording: '/recording/:roomSid',
  resourceViewer: `${dashboardTabPath.recursos}/:resourceId/ver`,
};

/** Builders for the parameterized routes above. */
export const routePath = {
  report: (roomSid: string) => `/report/${encodeURIComponent(roomSid)}`,
  recording: (roomSid: string) => `/recording/${encodeURIComponent(roomSid)}`,
  resourceViewer: (resourceId: string) => `${dashboardTabPath.recursos}/${resourceId}/ver`,
};

/**
 * Routes that render the whole room app (SDK providers + App). App.tsx derives which screen to show
 * from the pathname — landing/lobby, the dashboard tab, the profile — so they share ONE route and
 * the providers stay mounted while navigating between them.
 */
export const videoAppPaths = [routes.home, routes.profile, ...Object.values(dashboardTabPath)];
