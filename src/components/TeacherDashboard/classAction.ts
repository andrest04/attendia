export type ClassStatus = 'scheduled' | 'started' | 'completed';

/** What the dashboard offers for a class card. */
export type ClassAction =
  /** Plain "Iniciar sesión" (scheduled class, or an inconclusive room probe). */
  | 'start'
  /** "Volver a entrar": the class was started and its room is still open. */
  | 'rejoin'
  /** A started class whose room has not been probed yet. */
  | 'checking'
  /** A started class whose room closed: explain it and offer an explicit new session. */
  | 'closed-restart'
  /** Nothing to offer (completed). */
  | 'none';

/**
 * Pure decision for the per-class action. `roomOpen` is the latest `checkRoomOpen` result:
 * `undefined` = not probed yet, `null` = inconclusive (the token guard stays the real gate).
 */
export function resolveClassAction(status: ClassStatus | undefined, roomOpen: boolean | null | undefined): ClassAction {
  if (status === 'completed') return 'none';
  if (status !== 'started') return 'start';
  if (roomOpen === undefined) return 'checking';
  if (roomOpen === null) return 'start';
  return roomOpen ? 'rejoin' : 'closed-restart';
}
