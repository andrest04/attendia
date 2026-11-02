import { formatLongDateWithWeekday, formatShortDate, formatTime } from '../../i18n/format';
import { getLocale } from '../../i18n/locale';
import { t as translateSource } from '../../i18n/translate';
import { ClassRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { resolveClassAction } from './classAction';
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
 * unit-testable. A started class is no longer upcoming: it belongs to the
 * in-progress or finished section, whatever its scheduled time says.
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
        classRecord.status !== 'started' &&
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

/** The newest schedule wins; a record without a date is the oldest and a tie goes to the greatest id. */
function isMoreRecentlyScheduled(candidate: ClassRecord, current: ClassRecord): boolean {
  const candidateMs = candidate.scheduledAtMs ?? -Infinity;
  const currentMs = current.scheduledAtMs ?? -Infinity;
  return candidateMs === currentMs ? candidate.id > current.id : candidateMs > currentMs;
}

/** Latest `checkRoomOpen` result per room name; a room missing here has not been probed yet. */
export type RoomOpenStatus = Record<string, boolean | null>;

/** Started classes are never cleaned up once their room closes, so the Finished section stops here. */
export const MAX_FINISHED_SESSIONS = 6;

/** All of a room's started records enter the same room, so each room is represented by one of them. */
function latestStartedRecordPerRoom(classes: ClassRecord[]): ClassRecord[] {
  const recordByRoom = new Map<string, ClassRecord>();

  classes
    .filter(classRecord => classRecord.status === 'started')
    .forEach(classRecord => {
      const current = recordByRoom.get(classRecord.roomName);
      if (!current || isMoreRecentlyScheduled(classRecord, current)) {
        recordByRoom.set(classRecord.roomName, classRecord);
      }
    });

  return Array.from(recordByRoom.values());
}

function isRoomClosed(classRecord: ClassRecord, roomStatus: RoomOpenStatus): boolean {
  return resolveClassAction(classRecord.status, roomStatus[classRecord.roomName]) === 'closed-restart';
}

function toStartedSession(classRecord: ClassRecord, dayLabel: string): UpcomingSession {
  return {
    id: classRecord.id,
    title: classRecord.title,
    code: classRecord.roomName,
    roomName: classRecord.roomName,
    classId: classRecord.id,
    studentCount: classRecord.studentCount,
    time: '',
    dayLabel,
    relativeLabel: '',
    highlighted: false,
  };
}

/**
 * Started classes whose room may still be running: open, not yet probed or inconclusive. One card
 * per room. A scheduled class sharing the room is a distinct session and hides nothing here.
 */
export function buildInProgressSessions(
  classes: ClassRecord[],
  roomStatus: RoomOpenStatus,
  dayLabel: string
): UpcomingSession[] {
  return latestStartedRecordPerRoom(classes)
    .filter(classRecord => !isRoomClosed(classRecord, roomStatus))
    .map(classRecord => toStartedSession(classRecord, dayLabel));
}

/** Started classes whose room is confirmed closed: one card per room, most recent first, capped. */
export function buildFinishedSessions(
  classes: ClassRecord[],
  roomStatus: RoomOpenStatus,
  dayLabel: string
): UpcomingSession[] {
  return latestStartedRecordPerRoom(classes)
    .filter(classRecord => isRoomClosed(classRecord, roomStatus))
    .sort((a, b) => (isMoreRecentlyScheduled(a, b) ? -1 : 1))
    .slice(0, MAX_FINISHED_SESSIONS)
    .map(classRecord => toStartedSession(classRecord, dayLabel));
}

/** A class still scheduled under this title, for the heads-up before creating another one. */
export function findDuplicateScheduledClass(classes: ClassRecord[], title: string): ClassRecord | undefined {
  const normalizedTitle = title.trim().toLowerCase();
  if (!normalizedTitle) return undefined;
  return classes.find(
    classRecord => classRecord.status === 'scheduled' && classRecord.title.trim().toLowerCase() === normalizedTitle
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
