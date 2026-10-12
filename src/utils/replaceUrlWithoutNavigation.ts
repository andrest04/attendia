/**
 * Rewrites the address bar without navigating or adding a history entry, so a later refresh lands
 * on a URL the router can match (e.g. /room/:name for auto-rejoin).
 *
 * Does nothing where the URL cannot be trusted to route: when the app is deployed as a Twilio
 * function (`twil.io` origins have no client-side routing) and inside Storybook.
 */
export function replaceUrlWithoutNavigation(url: string): void {
  const isStorybook = Boolean((window as { STORYBOOK_ENV?: unknown }).STORYBOOK_ENV);
  if (window.location.origin.includes('twil.io') || isStorybook) return;
  window.history.replaceState(null, '', url);
}
