/**
 * "Back" behavior for standalone pages (/manual, /security) that can be reached
 * two ways:
 *
 * - In-tab navigation (a prior history entry exists) — go back normally.
 * - A fresh tab opened via window.open from the live room (single history
 *   entry) — "back" means closing the tab, so the user lands on the still-open
 *   room tab instead of being bounced to the lobby.
 *
 * Browsers only honor window.close() for tabs whose session history has a
 * single entry (which includes script-opened tabs); when it is refused — e.g.
 * the URL was typed directly into a tab with prior history — fall back to the
 * lobby after a short delay.
 */
export default function goBackFromStandalonePage(fallbackUrl = '/login'): void {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  window.close();
  window.setTimeout(() => {
    if (!window.closed) {
      window.location.assign(fallbackUrl);
    }
  }, 200);
}
