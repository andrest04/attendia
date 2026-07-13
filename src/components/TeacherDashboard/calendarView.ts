import { ClassRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';

export interface CalendarDay {
  day: number;
  classes: ClassRecord[];
}

export function monthStart(month: Date): Date {
  return new Date(month.getFullYear(), month.getMonth(), 1);
}

export function buildCalendarDays(classes: ClassRecord[], month: Date): CalendarDay[] {
  const start = monthStart(month);
  const nextMonth = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const byDay = new Map<number, ClassRecord[]>();
  classes.forEach(classRecord => {
    if (classRecord.scheduledAtMs === null || classRecord.status === 'completed') return;
    const scheduled = new Date(classRecord.scheduledAtMs);
    if (scheduled >= start && scheduled < nextMonth) {
      const day = scheduled.getDate();
      byDay.set(day, [...(byDay.get(day) || []), classRecord]);
    }
  });
  return Array.from({ length: new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate() }, (_, index) => {
    const day = index + 1;
    return {
      day,
      classes: (byDay.get(day) || []).slice().sort((a, b) => (a.scheduledAtMs || 0) - (b.scheduledAtMs || 0)),
    };
  });
}

export function mondayLeadingBlanks(month: Date): number {
  return (monthStart(month).getDay() + 6) % 7;
}

export function calendarSummary(classes: ClassRecord[], month: Date) {
  const days = buildCalendarDays(classes, month);
  const scheduled = days.reduce<ClassRecord[]>((all, day) => all.concat(day.classes), []);
  const totalMinutes = scheduled.reduce((total, classRecord) => total + classRecord.durationMinutes, 0);
  return {
    scheduledSessions: scheduled.length,
    expectedStudents: scheduled.reduce((total, classRecord) => total + classRecord.studentCount, 0),
    classHours: `${Math.round(totalMinutes / 60)}h`,
  };
}
