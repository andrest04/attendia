import React, { useState } from 'react';
import clsx from 'clsx';
import { Button, CircularProgress } from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import PeopleAltIcon from '@material-ui/icons/PeopleAlt';
import { ClassRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { buildCalendarDays, calendarSummary, mondayLeadingBlanks, monthStart } from './calendarView';

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    padding: theme.spacing(4),
    display: 'grid',
    gridTemplateColumns: '1fr 320px',
    gap: theme.spacing(4),
    [theme.breakpoints.down('sm')]: { padding: theme.spacing(2), gridTemplateColumns: '1fr' },
  },
  calendarCard: {
    backgroundColor: theme.palette.background.paper,
    border: '1px solid #e2ecf9',
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(3),
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing(2.5) },
  title: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '1.125rem',
    color: theme.palette.text.primary,
  },
  subtitle: { fontSize: '0.8125rem', color: theme.palette.text.secondary },
  navButtons: { display: 'flex', alignItems: 'center', gap: theme.spacing(1) },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '1px solid #e2ecf9',
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.secondary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  todayButton: {
    height: 32,
    padding: theme.spacing(0, 1.5),
    borderRadius: 16,
    border: '1px solid #e2ecf9',
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.secondary,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  weekRow: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: theme.spacing(1) },
  weekLabel: { textAlign: 'center', fontSize: '0.6875rem', fontWeight: 700, color: theme.palette.text.secondary },
  daysGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gridAutoRows: 'minmax(48px, auto)',
    gap: theme.spacing(0.5),
  },
  dayCell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: theme.shape.borderRadius,
    cursor: 'pointer',
    fontSize: '0.8125rem',
    color: theme.palette.text.primary,
    border: 0,
    background: 'transparent',
  },
  dayCellEmpty: { cursor: 'default' },
  dayCellSelected: { backgroundColor: '#0f1e45', color: '#ffffff' },
  dots: { display: 'flex', gap: 2 },
  dot: { width: 4, height: 4, borderRadius: '50%', backgroundColor: theme.palette.primary.main },
  dotSelected: { backgroundColor: '#ffffff' },
  sidePanel: { display: 'flex', flexDirection: 'column', gap: theme.spacing(2) },
  sideTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '1rem',
    color: theme.palette.text.primary,
  },
  sideSubtitle: { fontSize: '0.8125rem', color: theme.palette.text.secondary, marginBottom: theme.spacing(1) },
  sessionCard: {
    backgroundColor: theme.palette.background.paper,
    border: '1px solid #e2ecf9',
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2),
  },
  sessionTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '0.875rem',
    color: theme.palette.text.primary,
    marginBottom: theme.spacing(0.5),
  },
  sessionMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1.5),
  },
  metaItem: { display: 'flex', alignItems: 'center', gap: 4 },
  startButton: {
    width: '100%',
    padding: theme.spacing(1),
    borderRadius: theme.shape.borderRadius,
    border: 'none',
    cursor: 'pointer',
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.8125rem',
  },
  summaryCard: {
    backgroundColor: '#0f1e45',
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2.5),
    color: '#ffffff',
  },
  summaryTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '0.75rem',
    letterSpacing: '0.06em',
    marginBottom: theme.spacing(1.5),
    opacity: 0.8,
  },
  summaryRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '0.8125rem',
    padding: theme.spacing(0.75, 0),
  },
  state: { padding: theme.spacing(3), color: theme.palette.text.secondary },
}));

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface Props {
  classes: ClassRecord[] | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onStartClass: (classRecord: ClassRecord) => void;
}

function formatTime(value: number | null): string {
  return value === null
    ? 'Horario no disponible'
    : new Date(value).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function CalendarTab({ classes: classRecords, isLoading, error, onRetry, onStartClass }: Props) {
  const styles = useStyles();
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(new Date()));
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const days = buildCalendarDays(classRecords || [], visibleMonth);
  const summary = calendarSummary(classRecords || [], visibleMonth);

  const changeMonth = (offset: number) => {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1);
    setVisibleMonth(next);
    setSelectedDay(1);
  };
  const goToToday = () => {
    const today = new Date();
    setVisibleMonth(monthStart(today));
    setSelectedDay(today.getDate());
  };
  const monthLabel = visibleMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  const effectiveDay = selectedDay > days.length ? 1 : selectedDay;
  const effectiveSelected = days.find(day => day.day === effectiveDay) || days[0];

  if (isLoading)
    return (
      <div className={styles.state} data-testid="dashboard-calendar-loading">
        <CircularProgress size={24} /> Cargando calendario...
      </div>
    );
  if (error)
    return (
      <div className={styles.state} data-testid="dashboard-calendar-error">
        {error}
        <div>
          <Button onClick={onRetry}>Reintentar</Button>
        </div>
      </div>
    );
  if (classRecords === null)
    return (
      <div className={styles.state} data-testid="dashboard-calendar-unavailable">
        El calendario real requiere autenticación Firebase.
      </div>
    );

  const cells: Array<typeof days[0] | null> = [
    ...Array.from({ length: mondayLeadingBlanks(visibleMonth) }, () => null),
    ...days,
  ];
  return (
    <div className={styles.root} data-testid="dashboard-calendar-tab">
      <div className={styles.calendarCard}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>{monthLabel}</div>
            <div className={styles.subtitle}>Clases programadas</div>
          </div>
          <div className={styles.navButtons}>
            <button
              type="button"
              className={styles.todayButton}
              onClick={goToToday}
              data-testid="dashboard-calendar-today"
            >
              Hoy
            </button>
            <button
              type="button"
              aria-label="Mes anterior"
              className={styles.navButton}
              onClick={() => changeMonth(-1)}
              data-testid="dashboard-calendar-prev-month"
            >
              <ChevronLeftIcon style={{ fontSize: 18 }} />
            </button>
            <button
              type="button"
              aria-label="Mes siguiente"
              className={styles.navButton}
              onClick={() => changeMonth(1)}
              data-testid="dashboard-calendar-next-month"
            >
              <ChevronRightIcon style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>
        <div className={styles.weekRow}>
          {WEEKDAY_LABELS.map(label => (
            <span key={label} className={styles.weekLabel}>
              {label}
            </span>
          ))}
        </div>
        <div className={styles.daysGrid} data-testid="dashboard-calendar-grid">
          {cells.map((day, index) =>
            !day ? (
              <div key={`blank-${index}`} className={clsx(styles.dayCell, styles.dayCellEmpty)} />
            ) : (
              <button
                key={day.day}
                type="button"
                aria-label={`${day.day} de ${monthLabel}`}
                onClick={() => setSelectedDay(day.day)}
                className={clsx(styles.dayCell, { [styles.dayCellSelected]: day.day === effectiveDay })}
                data-testid={`dashboard-calendar-day-${day.day}`}
                data-session-count={day.classes.length}
              >
                {day.day}
                {day.classes.length > 0 && (
                  <span className={styles.dots}>
                    {day.classes.map(classRecord => (
                      <span
                        key={classRecord.id}
                        className={clsx(styles.dot, { [styles.dotSelected]: day.day === effectiveDay })}
                      />
                    ))}
                  </span>
                )}
              </button>
            )
          )}
        </div>
      </div>
      <div className={styles.sidePanel}>
        <div>
          <div className={styles.sideTitle}>
            {effectiveDay} de {visibleMonth.toLocaleDateString('es-AR', { month: 'long' })}
          </div>
          <div className={styles.sideSubtitle}>
            {effectiveSelected ? effectiveSelected.classes.length : 0} clases programadas
          </div>
          {effectiveSelected &&
            effectiveSelected.classes.map(classRecord => (
              <div
                key={classRecord.id}
                className={styles.sessionCard}
                style={{ marginBottom: 12 }}
                data-testid={`dashboard-calendar-session-${classRecord.id}`}
              >
                <div className={styles.sessionTitle}>{classRecord.title}</div>
                <div className={styles.sessionMeta}>
                  <span className={styles.metaItem}>
                    <AccessTimeIcon style={{ fontSize: 14 }} />
                    {formatTime(classRecord.scheduledAtMs)}
                  </span>
                  <span className={styles.metaItem}>
                    <PeopleAltIcon style={{ fontSize: 14 }} />
                    {classRecord.studentCount} alumnos
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.startButton}
                  onClick={() => onStartClass(classRecord)}
                  data-testid={`dashboard-calendar-start-${classRecord.id}`}
                >
                  Iniciar
                </button>
              </div>
            ))}
        </div>
        <div className={styles.summaryCard} data-testid="dashboard-calendar-summary">
          <div className={styles.summaryTitle}>{monthLabel.toUpperCase()} · RESUMEN</div>
          <div className={styles.summaryRow}>
            <span>Clases programadas</span>
            <span>{summary.scheduledSessions}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>Alumnos esperados</span>
            <span>{summary.expectedStudents}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>Horas de clase</span>
            <span>No disponible</span>
          </div>
        </div>
      </div>
    </div>
  );
}
