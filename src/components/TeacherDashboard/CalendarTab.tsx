import React from 'react';
import clsx from 'clsx';
import { makeStyles, Theme } from '@material-ui/core/styles';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import PeopleAltIcon from '@material-ui/icons/PeopleAlt';
import { CalendarDaySession, CalendarSessionCard, CalendarSummary } from './types';
import { getJulyWeekdayIndex } from './mockDashboardData';

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    padding: theme.spacing(4),
    display: 'grid',
    gridTemplateColumns: '1fr 320px',
    gap: theme.spacing(4),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2),
      gridTemplateColumns: '1fr',
    },
  },
  calendarCard: {
    backgroundColor: theme.palette.background.paper,
    border: '1px solid #e2ecf9',
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(3),
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(2.5),
  },
  title: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '1.125rem',
    color: theme.palette.text.primary,
  },
  subtitle: {
    fontSize: '0.8125rem',
    color: theme.palette.text.secondary,
  },
  navButtons: {
    display: 'flex',
    gap: theme.spacing(1),
  },
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
  weekRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    marginBottom: theme.spacing(1),
  },
  weekLabel: {
    textAlign: 'center',
    fontSize: '0.6875rem',
    fontWeight: 700,
    color: theme.palette.text.secondary,
  },
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
  },
  dayCellEmpty: {
    cursor: 'default',
  },
  dayCellSelected: {
    backgroundColor: '#0f1e45',
    color: '#ffffff',
  },
  dots: {
    display: 'flex',
    gap: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: '50%',
    backgroundColor: theme.palette.primary.main,
  },
  dotSelected: {
    backgroundColor: '#ffffff',
  },
  sidePanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  sideTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '1rem',
    color: theme.palette.text.primary,
  },
  sideSubtitle: {
    fontSize: '0.8125rem',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
  },
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
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
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
}));

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface Props {
  monthLabel: string;
  days: CalendarDaySession[];
  selectedDay: number;
  sessionsForSelectedDay: CalendarSessionCard[];
  summary: CalendarSummary;
}

/** "Calendario" tab: a static July 2026 month grid + the selected day's session panel. */
export default function CalendarTab({ monthLabel, days, selectedDay, sessionsForSelectedDay, summary }: Props) {
  const classes = useStyles();

  const leadingBlanks = getJulyWeekdayIndex(days[0]?.day ?? 1);
  const cells: Array<CalendarDaySession | null> = [...Array.from({ length: leadingBlanks }, () => null), ...days];

  return (
    <div className={classes.root} data-testid="dashboard-calendar-tab">
      <div className={classes.calendarCard}>
        <div className={classes.header}>
          <div>
            <div className={classes.title}>{monthLabel}</div>
            <div className={classes.subtitle}>Vista mensual</div>
          </div>
          <div className={classes.navButtons}>
            <button type="button" className={classes.navButton} data-testid="dashboard-calendar-prev-month">
              <ChevronLeftIcon style={{ fontSize: 18 }} />
            </button>
            <button type="button" className={classes.navButton} data-testid="dashboard-calendar-next-month">
              <ChevronRightIcon style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>

        <div className={classes.weekRow}>
          {WEEKDAY_LABELS.map(label => (
            <span key={label} className={classes.weekLabel}>
              {label}
            </span>
          ))}
        </div>

        <div className={classes.daysGrid} data-testid="dashboard-calendar-grid">
          {cells.map((cell, index) => {
            if (!cell) {
              return <div key={`blank-${index}`} className={clsx(classes.dayCell, classes.dayCellEmpty)} />;
            }
            const isSelected = cell.day === selectedDay;
            return (
              <div
                key={cell.day}
                className={clsx(classes.dayCell, { [classes.dayCellSelected]: isSelected })}
                data-testid={`dashboard-calendar-day-${cell.day}`}
                data-session-count={cell.sessionCount}
              >
                {cell.day}
                {cell.sessionCount > 0 && (
                  <span className={classes.dots}>
                    {Array.from({ length: cell.sessionCount }, (_, i) => (
                      <span
                        key={i}
                        className={clsx(classes.dot, { [classes.dotSelected]: isSelected })}
                        data-testid={`dashboard-calendar-day-${cell.day}-dot`}
                      />
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={classes.sidePanel}>
        <div>
          <div className={classes.sideTitle}>{selectedDay} de julio</div>
          <div className={classes.sideSubtitle}>{sessionsForSelectedDay.length} sesiones programadas</div>
          {sessionsForSelectedDay.map(session => (
            <div
              key={session.id}
              className={classes.sessionCard}
              style={{ marginBottom: 12 }}
              data-testid={`dashboard-calendar-session-${session.id}`}
            >
              <div className={classes.sessionTitle}>{session.title}</div>
              <div className={classes.sessionMeta}>
                <span className={classes.metaItem}>
                  <AccessTimeIcon style={{ fontSize: 14 }} />
                  {session.time}
                </span>
                <span className={classes.metaItem}>
                  <PeopleAltIcon style={{ fontSize: 14 }} />
                  {session.studentCount} alumnos
                </span>
              </div>
              <button type="button" className={classes.startButton} data-testid="dashboard-calendar-start-button">
                Iniciar →
              </button>
            </div>
          ))}
        </div>

        <div className={classes.summaryCard} data-testid="dashboard-calendar-summary">
          <div className={classes.summaryTitle}>JULIO · RESUMEN</div>
          <div className={classes.summaryRow}>
            <span>Sesiones programadas</span>
            <span>{summary.scheduledSessions}</span>
          </div>
          <div className={classes.summaryRow}>
            <span>Alumnos esperados</span>
            <span>{summary.expectedStudents}</span>
          </div>
          <div className={classes.summaryRow}>
            <span>Horas de clase</span>
            <span>{summary.classHours}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
