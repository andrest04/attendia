import { ClassRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { UpcomingSession } from './types';

// A class that started up to this long ago is still joinable/visible on the
// "Próximas sesiones" grid, instead of vanishing the instant its scheduled time
// passes (a professor running a couple minutes late shouldn't lose the card).
const GRACE_PERIOD_MS = 15 * 60 * 1000;

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isNextCalendarDay(a: Date, b: Date): boolean {
  const nextDay = new Date(b.getFullYear(), b.getMonth(), b.getDate() + 1);
  return (
    a.getFullYear() === nextDay.getFullYear() &&
    a.getMonth() === nextDay.getMonth() &&
    a.getDate() === nextDay.getDate()
  );
}

// Built manually (not toLocaleTimeString) so behavior doesn't depend on the
// ICU/locale data available in the test environment.
function formatTimeLabel(date: Date): string {
  const hours24 = date.getHours();
  const minutes = date.getMinutes();
  const period = hours24 < 12 ? 'am' : 'pm';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutesLabel = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours12}:${minutesLabel} ${period}`;
}

function formatDayLabel(sessionDate: Date, now: Date): string {
  if (isSameCalendarDay(sessionDate, now)) return 'Hoy';
  if (isNextCalendarDay(sessionDate, now)) return 'Mañana';
  return sessionDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function formatRelativeLabel(scheduledAtMs: number, nowMs: number, sessionDate: Date, now: Date): string {
  const diffMinutes = Math.round((scheduledAtMs - nowMs) / 60000);

  if (diffMinutes <= 0) return 'Ahora';
  if (diffMinutes < 60) return `En ${diffMinutes} min`;
  if (isSameCalendarDay(sessionDate, now)) return `En ${Math.floor(diffMinutes / 60)}h`;
  if (isNextCalendarDay(sessionDate, now)) return 'Mañana';
  return formatDayLabel(sessionDate, now);
}

/**
 * A scheduled (never started) class whose grace period has elapsed — the
 * "vencida" set the auto-cancel button clears. Started/completed classes are
 * never expired here: their lifecycle is "Terminar sesión", not this.
 */
export function findExpiredClasses(classes: ClassRecord[], nowMs: number): ClassRecord[] {
  return classes.filter(
    classRecord =>
      classRecord.scheduledAtMs !== null &&
      classRecord.status !== 'started' &&
      classRecord.status !== 'completed' &&
      classRecord.scheduledAtMs < nowMs - GRACE_PERIOD_MS
  );
}

function formatOverdueLabel(scheduledAtMs: number, nowMs: number): string {
  const diffMinutes = Math.max(0, Math.round((nowMs - scheduledAtMs) / 60000));
  if (diffMinutes < 60) return `Venció hace ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Venció hace ${diffHours}h`;
  return `Venció hace ${Math.floor(diffHours / 24)}d`;
}

/**
 * Same UpcomingSession shape as buildUpcomingSessions, but for the expired set
 * findExpiredClasses returns — lets ClassesTab render them with the same card,
 * grayed out, instead of only exposing them through the bulk-cancel count.
 */
export function buildExpiredSessions(classes: ClassRecord[], nowMs: number): UpcomingSession[] {
  const now = new Date(nowMs);

  const expired = classes
    .filter(
      (classRecord): classRecord is ClassRecord & { scheduledAtMs: number } =>
        classRecord.scheduledAtMs !== null &&
        classRecord.status !== 'started' &&
        classRecord.status !== 'completed' &&
        classRecord.scheduledAtMs < nowMs - GRACE_PERIOD_MS
    )
    .sort((a, b) => a.scheduledAtMs - b.scheduledAtMs);

  return expired.map(classRecord => {
    const sessionDate = new Date(classRecord.scheduledAtMs);
    return {
      id: classRecord.id,
      title: classRecord.title,
      code: classRecord.roomName,
      roomName: classRecord.roomName,
      classId: classRecord.id,
      studentCount: classRecord.studentCount,
      time: formatTimeLabel(sessionDate),
      dayLabel: formatDayLabel(sessionDate, now),
      relativeLabel: formatOverdueLabel(classRecord.scheduledAtMs, nowMs),
      highlighted: false,
    };
  });
}

/**
 * Pure transform from real ClassRecord[] + an injected clock into the
 * UpcomingSession[] shape ClassesTab renders. Never reads Date.now() itself —
 * same discipline as mockAttentionData.ts/attentionHeuristics.ts elsewhere in
 * this repo: callers inject "now" so the transform stays deterministic and
 * unit-testable.
 */
export function buildUpcomingSessions(classes: ClassRecord[], nowMs: number): UpcomingSession[] {
  const now = new Date(nowMs);

  const visible = classes
    .filter(
      (classRecord): classRecord is ClassRecord & { scheduledAtMs: number } =>
        classRecord.scheduledAtMs !== null &&
        classRecord.status !== 'completed' &&
        classRecord.scheduledAtMs >= nowMs - GRACE_PERIOD_MS
    )
    .sort((a, b) => a.scheduledAtMs - b.scheduledAtMs);

  return visible.map((classRecord, index) => {
    const sessionDate = new Date(classRecord.scheduledAtMs);
    return {
      id: classRecord.id,
      title: classRecord.title,
      code: classRecord.roomName,
      roomName: classRecord.roomName,
      classId: classRecord.id,
      studentCount: classRecord.studentCount,
      time: formatTimeLabel(sessionDate),
      dayLabel: formatDayLabel(sessionDate, now),
      relativeLabel: formatRelativeLabel(classRecord.scheduledAtMs, nowMs, sessionDate, now),
      highlighted: index === 0,
    };
  });
}
