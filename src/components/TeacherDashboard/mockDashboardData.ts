import { DashboardData } from './types';

/**
 * Deterministic mock data for the Teacher Dashboard ("Panel Docente").
 *
 * Rules (deterministic: no Math.random / Date.now):
 * - NO Math.random(), NO Date.now() — every value is hard-coded so tests are stable.
 * - Replace this module with real /classes, /history and /calendar endpoints when
 *   a backend for the rest of the dashboard exists. "Recursos" is no longer mocked
 *   here — see ResourcesTab, which fetches real data from useAppState().fetchResources.
 */

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
};
