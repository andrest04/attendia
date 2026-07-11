export type DashboardTabId = 'clases' | 'historial' | 'recursos' | 'calendario';

export type DashboardStatIcon = 'book' | 'people' | 'trending-up' | 'award';

export interface DashboardStat {
  id: string;
  value: string;
  label: string;
  icon: DashboardStatIcon;
}

export interface UpcomingSession {
  id: string;
  title: string;
  code: string;
  time: string;
  studentCount: number;
  /** "Hoy" | "Mañana" — day-relative label shown on the card. */
  dayLabel: string;
  /** "En 5 min" | "En 2h" | "Mañana" — finer-grained relative label. */
  relativeLabel: string;
  /** True for the single "start now" card — the only card wired to real navigation. */
  highlighted: boolean;
}

export type RecordingStatus = 'lista' | 'no-disponible';

export interface HistoryRow {
  id: string;
  className: string;
  date: string;
  duration: string;
  studentCount: number;
  /** Attention percentage 0-100, colored via attentionLevelFromPercent. */
  attentionPercent: number;
  recordingStatus: RecordingStatus;
  hasDownload: boolean;
}

export type ResourceFileKind = 'pdf' | 'presentation' | 'video';

/** One day of the July 2026 grid. sessionCount 0 renders no dots. */
export interface CalendarDaySession {
  day: number;
  sessionCount: number;
}

export interface CalendarSessionCard {
  id: string;
  title: string;
  time: string;
  studentCount: number;
}

export interface CalendarSummary {
  scheduledSessions: number;
  expectedStudents: number;
  classHours: string;
}

export interface DashboardData {
  professorName: string;
  professorInitials: string;
  stats: DashboardStat[];

  upcomingSessionsDateLabel: string;
  upcomingSessions: UpcomingSession[];

  historyRows: HistoryRow[];

  calendarMonthLabel: string;
  /** Days 1-31 of July 2026, in order. */
  calendarDays: CalendarDaySession[];
  selectedDay: number;
  calendarSessionsForSelectedDay: CalendarSessionCard[];
  calendarSummary: CalendarSummary;
}
