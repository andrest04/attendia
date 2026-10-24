import { routePath, routes, videoAppPaths } from './routes';
import { dashboardTabPath } from './components/TeacherDashboard/dashboardHelpers';

describe('routePath', () => {
  it('encodes the room sid in report and recording urls', () => {
    expect(routePath.report('RM1/ ?')).toBe('/report/RM1%2F%20%3F');
    expect(routePath.recording('RM1/ ?')).toBe('/recording/RM1%2F%20%3F');
  });

  it('builds the resource viewer url under the resources tab', () => {
    expect(routePath.resourceViewer('file-a')).toBe('/dashboard/recursos/file-a/ver');
  });

  it('builds urls that the matching route patterns accept', () => {
    // The pattern and the builder must stay in step: same prefix, same shape.
    expect(routes.report.replace(':roomSid', 'RM1')).toBe(routePath.report('RM1'));
    expect(routes.recording.replace(':roomSid', 'RM1')).toBe(routePath.recording('RM1'));
    expect(routes.resourceViewer.replace(':resourceId', 'file-a')).toBe(routePath.resourceViewer('file-a'));
  });
});

describe('videoAppPaths', () => {
  it('covers the lobby, the profile and every dashboard tab', () => {
    expect(videoAppPaths).toEqual(expect.arrayContaining(['/', '/profile', ...Object.values(dashboardTabPath)]));
  });

  it('covers the quick-start route, which lives under /dashboard but is not a tab', () => {
    expect(routes.dashboardQuickStart).toBe('/dashboard/iniciar-clase');
    expect(videoAppPaths).toContain(routes.dashboardQuickStart);
    expect(Object.values(dashboardTabPath)).not.toContain(routes.dashboardQuickStart);
  });

  it('does not claim the standalone pages that live outside the room app', () => {
    [routes.login, routes.security, routes.manual, routes.history, routes.resourceViewer].forEach(path =>
      expect(videoAppPaths).not.toContain(path)
    );
  });
});
