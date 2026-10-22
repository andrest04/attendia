import React, { useState } from 'react';
import clsx from 'clsx';
import { Button, CircularProgress } from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import PeopleAltIcon from '@material-ui/icons/PeopleAlt';
import DeleteIcon from '@material-ui/icons/Delete';
import { useTranslation } from 'react-i18next';
import { ClassRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { formatDate, formatDayMonth, formatLongDate, formatTime, weekdayName } from '../../i18n/format';
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
    transition: theme.transitions.create(['transform', 'background-color'], { duration: 120 }),
    '&:active': { transform: 'scale(0.88)', backgroundColor: '#e2ecf9' },
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
    transition: theme.transitions.create(['transform', 'background-color', 'color', 'border-color'], {
      duration: 120,
    }),
    '&:active': { transform: 'scale(0.92)' },
  },
  todayButtonActive: {
    backgroundColor: '#0f1e45',
    borderColor: '#0f1e45',
    color: '#ffffff',
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
    transition: theme.transitions.create('background-color', { duration: 120 }),
    '&:hover': { backgroundColor: '#eef2f9' },
  },
  dayCellEmpty: { cursor: 'default' },
  dayCellSelected: { backgroundColor: '#0f1e45', color: '#ffffff', '&:hover': { backgroundColor: '#0f1e45' } },
  dayCellMuted: { color: theme.palette.text.disabled, cursor: 'default' },
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
  sessionCardExpired: {
    border: '2px solid #94a3b8',
    backgroundColor: '#f1f5f9',
  },
  badgeExpired: {
    display: 'inline-block',
    fontSize: '0.6875rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    color: '#475569',
    marginBottom: theme.spacing(1),
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
  sessionActions: {
    display: 'flex',
    gap: theme.spacing(1),
  },
  startButton: {
    flex: 1,
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
  cancelButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1),
    borderRadius: theme.shape.borderRadius,
    border: '1px solid #e2ecf9',
    cursor: 'pointer',
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.8125rem',
    '&:disabled': {
      opacity: 0.6,
      cursor: 'default',
    },
  },
  cancelError: {
    marginTop: theme.spacing(1),
    fontFamily: 'Inter, sans-serif',
    fontSize: '0.8125rem',
    color: theme.palette.error.main,
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

// Monday first, as the grid is (0 = Sunday).
const WEEKDAY_INDEXES = [1, 2, 3, 4, 5, 6, 0];

interface Props {
  classes: ClassRecord[] | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onStartClass: (classRecord: ClassRecord) => void;
  /** Firebase-mode only: cancels (hard-deletes) a real scheduled class. Undefined
   * elsewhere — the cancel button then stays hidden, same convention as ClassesTab. */
  onCancelClass?: (session: { id: string; title: string }) => void;
  cancellingClassId?: string | null;
  cancelError?: string | null;
  onRetryCancel?: () => void;
  /** Ids of scheduled classes whose grace period elapsed without being started —
   * rendered with a gray outline instead of disappearing (see findExpiredClasses). */
  expiredClassIds?: Set<string>;
}

export default function CalendarTab({
  classes: classRecords,
  isLoading,
  error,
  onRetry,
  onStartClass,
  onCancelClass,
  cancellingClassId,
  cancelError,
  onRetryCancel,
  expiredClassIds,
}: Props) {
  const styles = useStyles();
  const { t, i18n } = useTranslation('calendar');
  const language = i18n.language;
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
  const monthLabel = formatDate(visibleMonth, { month: 'long', year: 'numeric' }, language);
  const formatClassTime = (value: number | null) =>
    value === null ? t('timeUnavailable') : formatTime(value, language);
  const dateOfDay = (day: number) => new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);

  const effectiveDay = selectedDay > days.length ? 1 : selectedDay;
  const effectiveSelected = days.find(day => day.day === effectiveDay) || days[0];

  const today = new Date();
  const isViewingToday =
    visibleMonth.getFullYear() === today.getFullYear() &&
    visibleMonth.getMonth() === today.getMonth() &&
    effectiveDay === today.getDate();

  if (isLoading)
    return (
      <div className={styles.state} data-testid="dashboard-calendar-loading">
        <CircularProgress size={24} /> {t('loading')}
      </div>
    );
  if (error)
    return (
      <div className={styles.state} data-testid="dashboard-calendar-error">
        {error}
        <div>
          <Button onClick={onRetry}>{t('retry')}</Button>
        </div>
      </div>
    );
  if (classRecords === null)
    return (
      <div className={styles.state} data-testid="dashboard-calendar-unavailable">
        {t('unavailable')}
      </div>
    );

  const leadingCount = mondayLeadingBlanks(visibleMonth);
  const prevMonthLastDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 0).getDate();
  const leadingDays = Array.from({ length: leadingCount }, (_, index) => prevMonthLastDay - leadingCount + 1 + index);
  const trailingCount = (7 - ((leadingCount + days.length) % 7)) % 7;
  const trailingDays = Array.from({ length: trailingCount }, (_, index) => index + 1);
  return (
    <div className={styles.root} data-testid="dashboard-calendar-tab">
      <div className={styles.calendarCard}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>{monthLabel}</div>
            <div className={styles.subtitle}>{t('scheduledClasses')}</div>
          </div>
          <div className={styles.navButtons}>
            <button
              type="button"
              className={clsx(styles.todayButton, { [styles.todayButtonActive]: isViewingToday })}
              onClick={goToToday}
              data-testid="dashboard-calendar-today"
            >
              {t('today')}
            </button>
            <button
              type="button"
              aria-label={t('previousMonth')}
              className={styles.navButton}
              onClick={() => changeMonth(-1)}
              data-testid="dashboard-calendar-prev-month"
            >
              <ChevronLeftIcon style={{ fontSize: 18 }} />
            </button>
            <button
              type="button"
              aria-label={t('nextMonth')}
              className={styles.navButton}
              onClick={() => changeMonth(1)}
              data-testid="dashboard-calendar-next-month"
            >
              <ChevronRightIcon style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>
        <div className={styles.weekRow}>
          {WEEKDAY_INDEXES.map(index => (
            <span key={index} className={styles.weekLabel}>
              {weekdayName(index, 'narrow', language)}
            </span>
          ))}
        </div>
        <div className={styles.daysGrid} data-testid="dashboard-calendar-grid">
          {leadingDays.map(day => (
            <div key={`prev-${day}`} className={clsx(styles.dayCell, styles.dayCellMuted)}>
              {day}
            </div>
          ))}
          {days.map(day => (
            <button
              key={day.day}
              type="button"
              aria-label={formatLongDate(dateOfDay(day.day), language)}
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
          ))}
          {trailingDays.map(day => (
            <div key={`next-${day}`} className={clsx(styles.dayCell, styles.dayCellMuted)}>
              {day}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.sidePanel}>
        <div>
          <div className={styles.sideTitle}>{formatDayMonth(dateOfDay(effectiveDay), language)}</div>
          <div className={styles.sideSubtitle}>
            {(() => {
              const count = effectiveSelected ? effectiveSelected.classes.length : 0;
              return count === 0 ? t('noClasses') : t('classCount', { count });
            })()}
          </div>
          {effectiveSelected &&
            effectiveSelected.classes.map(classRecord => (
              <div
                key={classRecord.id}
                className={clsx(styles.sessionCard, {
                  [styles.sessionCardExpired]: expiredClassIds?.has(classRecord.id),
                })}
                style={{ marginBottom: 12 }}
                data-testid={`dashboard-calendar-session-${classRecord.id}`}
              >
                {expiredClassIds?.has(classRecord.id) && (
                  <span
                    className={styles.badgeExpired}
                    data-testid={`dashboard-calendar-expired-badge-${classRecord.id}`}
                  >
                    {t('expired')}
                  </span>
                )}
                <div className={styles.sessionTitle}>{classRecord.title}</div>
                <div className={styles.sessionMeta}>
                  <span className={styles.metaItem}>
                    <AccessTimeIcon style={{ fontSize: 14 }} />
                    {formatClassTime(classRecord.scheduledAtMs)}
                  </span>
                  <span className={styles.metaItem}>
                    <PeopleAltIcon style={{ fontSize: 14 }} />
                    {t('studentCount', { count: classRecord.studentCount })}
                  </span>
                </div>
                <div className={styles.sessionActions}>
                  <button
                    type="button"
                    className={styles.startButton}
                    onClick={() => onStartClass(classRecord)}
                    data-testid={`dashboard-calendar-start-${classRecord.id}`}
                  >
                    {t('start')}
                  </button>
                  {onCancelClass && (
                    <button
                      type="button"
                      className={styles.cancelButton}
                      onClick={() => onCancelClass(classRecord)}
                      disabled={cancellingClassId === classRecord.id}
                      data-testid={`dashboard-calendar-cancel-${classRecord.id}`}
                    >
                      <DeleteIcon style={{ fontSize: 16 }} />
                      {cancellingClassId === classRecord.id ? t('cancelling') : t('cancel')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          {cancelError && (
            <div className={styles.cancelError} data-testid="dashboard-calendar-cancel-error">
              {cancelError}{' '}
              <button type="button" onClick={onRetryCancel} data-testid="dashboard-calendar-retry-cancel-button">
                {t('retryCancel')}
              </button>
            </div>
          )}
        </div>
        <div className={styles.summaryCard} data-testid="dashboard-calendar-summary">
          <div className={styles.summaryTitle}>{t('summaryTitle', { month: monthLabel.toUpperCase() })}</div>
          <div className={styles.summaryRow}>
            <span>{t('summary.scheduledClasses')}</span>
            <span>{summary.scheduledSessions}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>{t('summary.expectedStudents')}</span>
            <span>{summary.expectedStudents}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>{t('summary.classHours')}</span>
            <span>{summary.classHours}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
