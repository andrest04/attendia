import { formatLongDateWithWeekday, formatShortDate, formatTime } from '../../i18n/format';
import { getLocale } from '../../i18n/locale';
import { t as translateSource } from '../../i18n/translate';
import { ClassRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { DashboardData, UpcomingSession } from './types';

// A class that started up to this long ago is still joinable/visible on the
// "Próximas sesiones" grid, instead of vanishing the instant its scheduled time
// passes (a professor running a couple minutes late shouldn't lose the card).
const GRACE_PERIOD_MS = 15 * 60 * 1000;

/** Translation function and language the labels are built with; defaults to Spanish. */
export interface ViewLocale {
  t: (key: string, options?: { [option: string]: unknown }) => string;
  language: string;
}

const SOURCE_LABELS: { [key: string]: string } = {
  'classSessions:today': 'Hoy',
  'classSessions:tomorrow': 'Mañana',
  'classSessions:now': 'Ahora',
  'classSessions:inMinutes': 'En {{n}} min',
  'classSessions:inHours': 'En {{n}}h',
  'classSessions:overdueMinutes': 'Venció hace {{n}} min',
  'classSessions:overdueHours': 'Venció hace {{n}}h',
  'classSessions:overdueDays': 'Venció hace {{n}}d',
};

function defaultLocale(): ViewLocale {
  return {
    language: getLocale(),
    t: (key, options) => translateSource(SOURCE_LABELS[key] || key, { n: Number(options?.count || 0) }),
  };
}

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

function formatDayLabel(sessionDate: Date, now: Date, locale: ViewLocale): string {
  if (isSameCalendarDay(sessionDate, now)) return locale.t('classSessions:today');
  if (isNextCalendarDay(sessionDate, now)) return locale.t('classSessions:tomorrow');
  return formatShortDate(sessionDate, locale.language);
}

function formatRelativeLabel(
  scheduledAtMs: number,
  nowMs: number,
  sessionDate: Date,
  now: Date,
  locale: ViewLocale
): string {
  const diffMinutes = Math.round((scheduledAtMs - nowMs) / 60000);

  if (diffMinutes <= 0) return locale.t('classSessions:now');
  if (diffMinutes < 60) return locale.t('classSessions:inMinutes', { count: diffMinutes });
  if (isSameCalendarDay(sessionDate, now)) {
    return locale.t('classSessions:inHours', { count: Math.floor(diffMinutes / 60) });
  }
  if (isNextCalendarDay(sessionDate, now)) return locale.t('classSessions:tomorrow');
  return formatDayLabel(sessionDate, now, locale);
}

/**
 * A scheduled (never started) class whose grace period has elapsed — the
 * "vencida" set the auto-cancel button clears. Started/completed classes are
 * never expired here: their lifecycle is "Terminar sesión", not this.
 */
export function findExpiredClasses(classes: ClassRecord[], nowMs: number): ClassRecord[] {
  return classes.filter(classRecord => isExpired(classRecord, nowMs));
}

function isExpired(classRecord: ClassRecord, nowMs: number): boolean {
  return (
    classRecord.scheduledAtMs !== null &&
    classRecord.status !== 'started' &&
    classRecord.status !== 'completed' &&
    classRecord.scheduledAtMs < nowMs - GRACE_PERIOD_MS
  );
}

type ScheduledClass = ClassRecord & { scheduledAtMs: number };

/** The card both session lists render; only the labels and the highlight differ between them. */
function toUpcomingSession(
  classRecord: ScheduledClass,
  now: Date,
  locale: ViewLocale,
  labels: { relativeLabel: string; highlighted: boolean }
): UpcomingSession {
  const sessionDate = new Date(classRecord.scheduledAtMs);
  return {
    id: classRecord.id,
    title: classRecord.title,
    code: classRecord.roomName,
    roomName: classRecord.roomName,
    classId: classRecord.id,
    studentCount: classRecord.studentCount,
    time: formatTime(sessionDate, locale.language),
    dayLabel: formatDayLabel(sessionDate, now, locale),
    ...labels,
  };
}

function formatOverdueLabel(scheduledAtMs: number, nowMs: number, locale: ViewLocale): string {
  const diffMinutes = Math.max(0, Math.round((nowMs - scheduledAtMs) / 60000));
  if (diffMinutes < 60) return locale.t('classSessions:overdueMinutes', { count: diffMinutes });
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return locale.t('classSessions:overdueHours', { count: diffHours });
  return locale.t('classSessions:overdueDays', { count: Math.floor(diffHours / 24) });
}

/**
 * Same UpcomingSession shape as buildUpcomingSessions, but for the expired set
 * findExpiredClasses returns — lets ClassesTab render them with the same card,
 * grayed out, instead of only exposing them through the bulk-cancel count.
 */
export function buildExpiredSessions(
  classes: ClassRecord[],
  nowMs: number,
  locale: ViewLocale = defaultLocale()
): UpcomingSession[] {
  const now = new Date(nowMs);

  const expired = classes
    .filter((classRecord): classRecord is ScheduledClass => isExpired(classRecord, nowMs))
    .sort((a, b) => a.scheduledAtMs - b.scheduledAtMs);

  return expired.map(classRecord =>
    toUpcomingSession(classRecord, now, locale, {
      relativeLabel: formatOverdueLabel(classRecord.scheduledAtMs, nowMs, locale),
      highlighted: false,
    })
  );
}

/**
 * Pure transform from real ClassRecord[] + an injected clock into the
 * UpcomingSession[] shape ClassesTab renders. Never reads Date.now() itself —
 * same discipline as attentionHeuristics.ts elsewhere in
 * this repo: callers inject "now" so the transform stays deterministic and
 * unit-testable.
 */
export function buildUpcomingSessions(
  classes: ClassRecord[],
  nowMs: number,
  locale: ViewLocale = defaultLocale()
): UpcomingSession[] {
  const now = new Date(nowMs);

  const visible = classes
    .filter(
      (classRecord): classRecord is ScheduledClass =>
        classRecord.scheduledAtMs !== null &&
        classRecord.status !== 'completed' &&
        classRecord.scheduledAtMs >= nowMs - GRACE_PERIOD_MS
    )
    .sort((a, b) => a.scheduledAtMs - b.scheduledAtMs);

  return visible.map((classRecord, index) =>
    toUpcomingSession(classRecord, now, locale, {
      relativeLabel: formatRelativeLabel(
        classRecord.scheduledAtMs,
        nowMs,
        new Date(classRecord.scheduledAtMs),
        now,
        locale
      ),
      highlighted: index === 0,
    })
  );
}

/** What the "Clases" tab shows about the teacher's classes, whichever source they come from. */
export interface ClassesView {
  sessions: UpcomingSession[];
  /** The expired set as cards, grayed out in the tab. */
  expiredSessions: UpcomingSession[];
  /** The expired set as records, for the bulk-cancel action. */
  expiredClasses: ClassRecord[];
  dateLabel: string;
}

/** The view over the teacher's real classes (firebase mode). */
export function buildRealClassesView(
  classes: ClassRecord[],
  nowMs: number,
  locale: ViewLocale = defaultLocale()
): ClassesView {
  return {
    sessions: buildUpcomingSessions(classes, nowMs, locale),
    expiredSessions: buildExpiredSessions(classes, nowMs, locale),
    expiredClasses: findExpiredClasses(classes, nowMs),
    dateLabel: formatLongDateWithWeekday(nowMs, locale.language),
  };
}

/** The same view over the fixed mock data, for modes without the classes API. */
export function buildMockClassesView(data: DashboardData): ClassesView {
  return {
    sessions: data.upcomingSessions,
    expiredSessions: [],
    expiredClasses: [],
    dateLabel: data.upcomingSessionsDateLabel,
  };
}
