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
  /** Present for Firebase-backed sessions so start preserves the server identity. */
  roomName?: string;
  classId?: string;
}

export type ResourceFileKind = 'pdf' | 'presentation' | 'word' | 'zip' | 'video';

export interface DashboardData {
  professorName: string;
  professorInitials: string;
  stats: DashboardStat[];

  upcomingSessionsDateLabel: string;
  upcomingSessions: UpcomingSession[];
}
