import { useEffect } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { dashboardTabPath } from './dashboardHelpers';

/**
 * Normalizes a bare '/' into '/dashboard/clases' once the teacher dashboard is active, so the
 * URL is always the source of truth for the active tab instead of an implicit, unreflected
 * default. Uses history.replace (not push) since '/' was never a real navigation the user
 * chose — it shouldn't become a back-stack entry.
 *
 * Extracted from App.tsx (rather than an inline useEffect) so this is testable with
 * renderHook: App.tsx's own tests are shallow-rendered and never flush effects.
 */
export default function useDashboardRouteSync(dashboardActive: boolean): void {
  const history = useHistory();
  const location = useLocation();

  useEffect(() => {
    if (dashboardActive && location.pathname === '/') {
      history.replace(dashboardTabPath.clases);
    }
  }, [dashboardActive, location.pathname, history]);
}
