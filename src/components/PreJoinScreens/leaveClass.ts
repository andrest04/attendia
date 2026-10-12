import { clearRejoinSession } from './rejoinSession';

/**
 * Leaving ON PURPOSE: drop the saved rejoin session, then disconnect.
 *
 * The order of intent matters — a deliberate "Salir" (or a session ended for everyone) must
 * not bring the user back on the next refresh, whereas a refresh itself disconnects via
 * 'beforeunload' without going through here, so that path keeps the session and reconnects.
 * Three exits used to repeat the pair by hand (the Salir button and both session-end paths).
 *
 * The room is optional: a refresh or a double click can already have disconnected it and
 * nulled the reference, and calling disconnect() on nothing must not throw.
 */
export function leaveClass(room: { disconnect(): void } | null | undefined): void {
  clearRejoinSession();
  room?.disconnect();
}
