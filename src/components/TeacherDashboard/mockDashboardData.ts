import { DashboardData } from './types';

/**
 * Deterministic mock data for the Teacher Dashboard ("Panel Docente").
 *
 * Rules (same convention as AttentionProvider/mockAttentionData.ts):
 * - NO Math.random(), NO Date.now() — every value is hard-coded so tests are stable.
 * - The one date construction below, `new Date(2026, 6, day)`, is a FIXED calendar
 *   fact (July 2026's weekday alignment) rather than a read of the current time, so
 *   it is still fully deterministic across every run.
 * - Replace this module with real /classes, /history, /resources and /calendar
 *   endpoints when a backend for the dashboard exists.
 */

// Session-count dots shown per day in the Calendario tab grid. Days not listed have 0.
const JULY_2026_SESSION_COUNTS: Record<number, number> = {
  1: 1,
  3: 2,
  6: 1,
  8: 2,
  10: 1,
  13: 1,
  15: 2,
  17: 1,
  20: 1,
  22: 2,
  24: 1,
  27: 1,
  29: 2,
  31: 1,
};

/** 0 = Monday … 6 = Sunday, for a given day-of-month in July 2026. */
export function getJulyWeekdayIndex(day: number): number {
  const jsDay = new Date(2026, 6, day).getDay(); // 0 = Sunday … 6 = Saturday
  return (jsDay + 6) % 7;
}

export const mockDashboardData: DashboardData = {
  professorName: 'Prof. García',
  professorInitials: 'PG',

  stats: [
    { id: 'sessions-week', value: '4', label: 'Sesiones esta semana', icon: 'book' },
    { id: 'active-students', value: '115', label: 'Alumnos activos', icon: 'people' },
    { id: 'avg-attention', value: '72%', label: 'Atención promedio', icon: 'trending-up' },
    { id: 'hours-taught', value: '28h', label: 'Horas impartidas', icon: 'award' },
  ],

  upcomingSessionsDateLabel: 'Miércoles, 8 de julio de 2026',
  upcomingSessions: [
    {
      id: 'session-mat-a',
      title: 'Matemáticas — Grupo A',
      code: 'MAT-A',
      time: '10:00 am',
      studentCount: 28,
      dayLabel: 'Hoy',
      relativeLabel: 'En 5 min',
      highlighted: true,
    },
    {
      id: 'session-alg-l',
      title: 'Álgebra Lineal',
      code: 'ALG-L',
      time: '12:00 pm',
      studentCount: 32,
      dayLabel: 'Hoy',
      relativeLabel: 'En 2h',
      highlighted: false,
    },
    {
      id: 'session-cal-3',
      title: 'Cálculo III',
      code: 'CAL-3',
      time: '10:00 am',
      studentCount: 25,
      dayLabel: 'Mañana',
      relativeLabel: 'Mañana',
      highlighted: false,
    },
    {
      id: 'session-est-a',
      title: 'Estadística Avanzada',
      code: 'EST-A',
      time: '3:00 pm',
      studentCount: 30,
      dayLabel: 'Mañana',
      relativeLabel: 'Mañana',
      highlighted: false,
    },
  ],

  historyRows: [
    {
      id: 'hist-1',
      className: 'Matemáticas — Grupo A',
      date: '7 jul 2026',
      duration: '1h 05min',
      studentCount: 28,
      attentionPercent: 72,
      recordingStatus: 'lista',
      hasDownload: true,
    },
    {
      id: 'hist-2',
      className: 'Álgebra Lineal',
      date: '5 jul 2026',
      duration: '1h 28min',
      studentCount: 30,
      attentionPercent: 85,
      recordingStatus: 'lista',
      hasDownload: true,
    },
    {
      id: 'hist-3',
      className: 'Cálculo III',
      date: '4 jul 2026',
      duration: '58min',
      studentCount: 24,
      attentionPercent: 45,
      recordingStatus: 'no-disponible',
      hasDownload: false,
    },
    {
      id: 'hist-4',
      className: 'Estadística Avanzada',
      date: '3 jul 2026',
      duration: '1h 10min',
      studentCount: 29,
      attentionPercent: 78,
      recordingStatus: 'lista',
      hasDownload: true,
    },
    {
      id: 'hist-5',
      className: 'Matemáticas — Grupo B',
      date: '2 jul 2026',
      duration: '1h 02min',
      studentCount: 26,
      attentionPercent: 91,
      recordingStatus: 'lista',
      hasDownload: true,
    },
    {
      id: 'hist-6',
      className: 'Álgebra Lineal',
      date: '30 jun 2026',
      duration: '1h 35min',
      studentCount: 31,
      attentionPercent: 67,
      recordingStatus: 'lista',
      hasDownload: true,
    },
  ],

  resourceGroups: [
    {
      id: 'mat-a',
      label: 'Matemáticas — Grupo A',
      files: [
        { id: 'file-1', name: 'Guía de práctica — Unidad 3', kind: 'pdf', sizeLabel: '2.4 MB', dateLabel: '5 jul' },
        { id: 'file-2', name: 'Examen parcial 2026', kind: 'pdf', sizeLabel: '1.1 MB', dateLabel: '1 jul' },
        {
          id: 'file-3',
          name: 'Presentación — Derivadas',
          kind: 'presentation',
          sizeLabel: '8.7 MB',
          dateLabel: '28 jun',
        },
        { id: 'file-4', name: 'Grabación Sesión 12', kind: 'video', sizeLabel: '340 MB', dateLabel: '25 jun' },
      ],
    },
    { id: 'alg-l', label: 'Álgebra Lineal', files: [] },
    { id: 'cal-3', label: 'Cálculo III', files: [] },
  ],

  calendarMonthLabel: 'Julio 2026',
  calendarDays: Array.from({ length: 31 }, (_, i) => ({
    day: i + 1,
    sessionCount: JULY_2026_SESSION_COUNTS[i + 1] || 0,
  })),
  selectedDay: 8,
  calendarSessionsForSelectedDay: [
    { id: 'cal-session-1', title: 'Matemáticas — Gr. A', time: '10:00am', studentCount: 28 },
    { id: 'cal-session-2', title: 'Cálculo III', time: '10:00am', studentCount: 25 },
  ],
  calendarSummary: {
    scheduledSessions: 18,
    expectedStudents: 115,
    classHours: '22h',
  },
};
