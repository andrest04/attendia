import React, { useRef, useState } from 'react';
import clsx from 'clsx';
import { createTheme, makeStyles, MuiThemeProvider, Theme } from '@material-ui/core/styles';
import AddIcon from '@material-ui/icons/Add';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import PeopleAltIcon from '@material-ui/icons/PeopleAlt';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import DeleteIcon from '@material-ui/icons/Delete';
import EventBusyIcon from '@material-ui/icons/EventBusy';
import { MuiPickersUtilsProvider, KeyboardDatePicker, KeyboardTimePicker } from '@material-ui/pickers';
import DateFnsUtils from '@date-io/date-fns';
import esLocale from 'date-fns/locale/es';
import { DashboardStat, UpcomingSession } from './types';
import { statCardIcon } from './dashboardHelpers';
import { toClassSessionDisplayName, toClassSessionRoomName } from '../PreJoinScreens/classSessionTypes';
import { MuiPickersOverrides } from '@material-ui/pickers/typings/overrides';
import { StyleRules } from '@material-ui/core/styles/withStyles';
import baseTheme from '../../theme';

// @material-ui/pickers ships its overridable class keys separately from core's `Overrides` type;
// this augmentation is required for `theme.overrides.MuiPickers*` below to type-check.
// `MuiPickersToolbarText` is missing from the shipped `MuiPickersOverrides` (v3.3.11 typings gap).
declare module '@material-ui/core/styles/overrides' {
  interface ComponentNameToClassKey extends MuiPickersOverrides {
    MuiPickersToolbarText?: Partial<StyleRules<'toolbarTxt' | 'toolbarBtnSelected'>>;
  }
}

// Light clock-picker theme scoped to the time field, styled after Google Calendar/Meet's time dialog
// but using the app's own light palette instead of Meet's dark one.
// Extends the app's base theme so the picker still carries the app's required custom theme fields.
const meetTimePickerTheme = createTheme({
  ...baseTheme,
  overrides: {
    ...baseTheme.overrides,
    MuiDialog: {
      paper: {
        borderRadius: 16,
      },
    },
    MuiPickersToolbarText: {
      toolbarBtnSelected: {
        backgroundColor: baseTheme.palette.primary.main,
        padding: '2px 14px',
        borderRadius: 8,
        display: 'inline-block',
      },
    },
    MuiPickersClock: {
      clock: {
        backgroundColor: '#f0f5ff',
      },
    },
    MuiButton: {
      textPrimary: {
        color: baseTheme.palette.primary.main,
      },
    },
  },
});

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    padding: theme.spacing(4),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2),
    },
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: theme.spacing(2.5),
    marginBottom: theme.spacing(4),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    backgroundColor: theme.palette.background.paper,
    border: '1px solid #e2ecf9',
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2.5),
  },
  statIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ebf3ff',
    color: theme.palette.primary.main,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statValue: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 800,
    fontSize: '1.375rem',
    color: theme.palette.text.primary,
    lineHeight: 1.2,
  },
  statLabel: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(2.5),
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
  },
  sectionTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '1.125rem',
    color: theme.palette.text.primary,
  },
  sectionSubtitle: {
    fontSize: '0.8125rem',
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  // Same convention as HistoryTab's mockTag — a lightweight inline note, not a
  // new visual component, flagging data that fell back to mockDashboardData.
  mockTag: {
    display: 'inline-block',
    marginLeft: theme.spacing(1),
    fontSize: '0.6875rem',
    fontStyle: 'italic',
    color: theme.palette.text.secondary,
  },
  statsGridHeader: {
    marginBottom: theme.spacing(1),
  },
  newClassButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1, 2),
    borderRadius: theme.shape.borderRadius,
    border: 'none',
    cursor: 'pointer',
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.8125rem',
    flexShrink: 0,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexShrink: 0,
  },
  cancelExpiredButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1, 2),
    borderRadius: theme.shape.borderRadius,
    border: '1px solid #f0c36d',
    cursor: 'pointer',
    backgroundColor: '#fff8e6',
    color: theme.palette.text.primary,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.8125rem',
    flexShrink: 0,
    '&:disabled': {
      opacity: 0.6,
      cursor: 'default',
    },
  },
  sessionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: theme.spacing(2.5),
  },
  sessionCard: {
    backgroundColor: theme.palette.background.paper,
    border: '1px solid #e2ecf9',
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(2.5),
  },
  sessionCardHighlighted: {
    border: `2px solid ${theme.palette.primary.main}`,
  },
  sessionBadges: {
    display: 'flex',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  badgeToday: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 20,
    backgroundColor: '#d1fae5',
    color: '#065f46',
  },
  badgeRelative: {
    fontSize: '0.6875rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 20,
    backgroundColor: '#ebf3ff',
    color: theme.palette.primary.main,
  },
  sessionTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '1rem',
    color: theme.palette.text.primary,
  },
  sessionCode: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1.5),
  },
  sessionMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    fontSize: '0.8125rem',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2),
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  primaryButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.25),
    borderRadius: theme.shape.borderRadius,
    border: 'none',
    cursor: 'pointer',
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.875rem',
  },
  secondaryButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.25),
    borderRadius: theme.shape.borderRadius,
    border: '1px solid #e2ecf9',
    cursor: 'pointer',
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.875rem',
  },
  newClassForm: {
    backgroundColor: theme.palette.background.paper,
    border: '1px solid #e2ecf9',
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(3),
    marginBottom: theme.spacing(2.5),
  },
  newClassFormTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '0.9375rem',
    color: theme.palette.text.primary,
    marginBottom: theme.spacing(0.5),
  },
  newClassFormSubtitle: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2.5),
  },
  newClassFieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2.5),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: '1fr',
    },
  },
  newClassField: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  },
  newClassLabel: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.75rem',
    color: theme.palette.text.primary,
  },
  newClassHint: {
    fontSize: '0.6875rem',
    color: theme.palette.text.secondary,
  },
  newClassInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.shape.borderRadius,
    border: '1px solid #e2ecf9',
    fontFamily: 'Inter, sans-serif',
    fontSize: '0.8125rem',
    '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
      WebkitAppearance: 'none',
      margin: 0,
    },
    '&[type=number]': {
      MozAppearance: 'textfield',
    },
  },
  newClassPickerInput: {
    padding: theme.spacing(1, 1.5),
    fontFamily: 'Inter, sans-serif',
    fontSize: '0.8125rem',
    color: theme.palette.text.primary,
    '&::placeholder': {
      color: theme.palette.text.hint,
      opacity: 1,
    },
  },
  newClassActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  },
  newClassSubmitButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(1, 2),
    borderRadius: theme.shape.borderRadius,
    border: 'none',
    cursor: 'pointer',
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.8125rem',
    flexShrink: 0,
    '&:disabled': {
      opacity: 0.6,
      cursor: 'default',
    },
  },
  newClassCancelButton: {
    padding: theme.spacing(1, 2),
    borderRadius: theme.shape.borderRadius,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: theme.palette.text.secondary,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.8125rem',
  },
  newClassError: {
    marginTop: theme.spacing(1.5),
    fontFamily: 'Inter, sans-serif',
    fontSize: '0.8125rem',
    color: theme.palette.error.main,
  },
}));

interface Props {
  stats: DashboardStat[];
  dateLabel: string;
  sessions: UpcomingSession[];
  professorName: string;
  onStartClass: (session: { roomName: string; name: string; classId?: string }) => void;
  /** Firebase-mode only: creates a real scheduled class. Undefined elsewhere —
   * the "Nueva clase" button then keeps its stub (no-op) appearance. */
  onCreateClass?: (input: {
    title: string;
    scheduledAtMs: number;
    studentCount: number;
    durationMinutes: number;
    idempotencyKey: string;
  }) => Promise<void>;
  /** Firebase-mode only: cancels (hard-deletes) a real scheduled class. Undefined
   * elsewhere — the secondary button stays the "Ver detalles" stub. */
  onCancelClass?: (session: UpcomingSession) => void;
  cancellingClassId?: string | null;
  cancelError?: string | null;
  onRetryCancel?: () => void;
  /** Firebase-mode only: count of scheduled classes whose grace period elapsed
   * without being started — the "Cancelar vencidas" button only renders above 0. */
  expiredClassesCount?: number;
  onCancelExpiredClasses?: () => void;
  isCancellingExpired?: boolean;
  cancelExpiredError?: string | null;
  /** True when `stats`/`sessions` (respectively) came from mockDashboardData instead of a
   * real backend — each flag is independent since they can fall back separately. */
  statsAreMock?: boolean;
  sessionsAreMock?: boolean;
}

export function createIdempotencyKey(): string {
  return `class-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

/** "Clases" tab: stat cards + the upcoming-sessions grid. The highlighted card's
 * "Iniciar sesión" is the only real CTA in the whole dashboard this pass. */
export default function ClassesTab({
  stats,
  dateLabel,
  sessions,
  professorName,
  onStartClass,
  onCreateClass,
  onCancelClass,
  cancellingClassId,
  cancelError,
  onRetryCancel,
  expiredClassesCount = 0,
  onCancelExpiredClasses,
  isCancellingExpired,
  cancelExpiredError,
  statsAreMock = false,
  sessionsAreMock = false,
}: Props) {
  const classes = useStyles();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [dateValue, setDateValue] = useState<Date | null>(null);
  const [timeValue, setTimeValue] = useState<Date | null>(null);
  const [studentCountInput, setStudentCountInput] = useState('0');
  const [durationMinutesInput, setDurationMinutesInput] = useState('60');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const creationIdempotencyKeyRef = useRef<string | null>(null);

  const handleStartClass = (session: UpcomingSession) => {
    onStartClass({
      roomName: session.roomName || toClassSessionRoomName(session.title),
      name: toClassSessionDisplayName(professorName, 'teacher'),
      classId: session.classId,
    });
  };

  const handleNewClassClick = () => {
    if (!onCreateClass) return;
    setIsFormOpen(current => {
      if (!current) creationIdempotencyKeyRef.current = createIdempotencyKey();
      return !current;
    });
    setFormError(null);
  };

  const resetForm = () => {
    setTitleInput('');
    setDateValue(null);
    setTimeValue(null);
    setStudentCountInput('0');
    setDurationMinutesInput('60');
    setIsFormOpen(false);
    setFormError(null);
    creationIdempotencyKeyRef.current = null;
  };

  const handleSubmitNewClass: React.FormEventHandler = event => {
    event.preventDefault();
    if (!onCreateClass) return;

    const title = titleInput.trim();
    if (!title) {
      setFormError('Indica un título para la clase.');
      return;
    }
    if (!dateValue || isNaN(dateValue.getTime()) || !timeValue || isNaN(timeValue.getTime())) {
      setFormError('Indica la fecha y la hora de la clase.');
      return;
    }
    const studentCount = Number(studentCountInput);
    if (!Number.isFinite(studentCount) || studentCount < 0) {
      setFormError('La cantidad de alumnos esperados no es válida.');
      return;
    }
    const durationMinutes = Number(durationMinutesInput);
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
      setFormError('La duración de la clase no es válida.');
      return;
    }
    const scheduledAtMs = new Date(
      dateValue.getFullYear(),
      dateValue.getMonth(),
      dateValue.getDate(),
      timeValue.getHours(),
      timeValue.getMinutes()
    ).getTime();
    if (!Number.isFinite(scheduledAtMs)) {
      setFormError('La fecha y hora indicadas no son válidas.');
      return;
    }
    if (scheduledAtMs < Date.now()) {
      setFormError('No puedes programar una clase en una fecha u hora pasada.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    onCreateClass({
      title,
      scheduledAtMs,
      studentCount,
      durationMinutes,
      idempotencyKey: creationIdempotencyKeyRef.current || createIdempotencyKey(),
    })
      .then(() => resetForm())
      .catch(err => setFormError(err.message))
      .finally(() => setIsSubmitting(false));
  };

  return (
    <div className={classes.root} data-testid="dashboard-classes-tab">
      {statsAreMock && (
        <div className={classes.statsGridHeader}>
          <span className={classes.mockTag} data-testid="dashboard-stats-mock-tag">
            Datos simulados
          </span>
        </div>
      )}
      <div className={classes.statsGrid}>
        {stats.map(stat => {
          const Icon = statCardIcon[stat.icon];
          return (
            <div key={stat.id} className={classes.statCard} data-testid={`dashboard-stat-${stat.id}`}>
              <span className={classes.statIconWrap}>
                <Icon style={{ fontSize: 22 }} />
              </span>
              <div>
                <div className={classes.statValue}>{stat.value}</div>
                <div className={classes.statLabel}>{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={classes.sectionHeader}>
        <div>
          <div className={classes.sectionTitle}>
            Próximas sesiones
            {sessionsAreMock && (
              <span className={classes.mockTag} data-testid="dashboard-sessions-mock-tag">
                Datos simulados
              </span>
            )}
          </div>
          <div className={classes.sectionSubtitle}>{dateLabel}</div>
        </div>
        <div className={classes.headerActions}>
          {onCancelExpiredClasses && expiredClassesCount > 0 && (
            <button
              type="button"
              className={classes.cancelExpiredButton}
              onClick={onCancelExpiredClasses}
              disabled={isCancellingExpired}
              data-testid="dashboard-cancel-expired-button"
            >
              <EventBusyIcon style={{ fontSize: 18 }} />
              {isCancellingExpired
                ? 'Cancelando…'
                : `Cancelar ${expiredClassesCount === 1 ? 'vencida' : `${expiredClassesCount} vencidas`}`}
            </button>
          )}
          <button
            type="button"
            className={classes.newClassButton}
            onClick={handleNewClassClick}
            data-testid="dashboard-new-class-button"
          >
            <AddIcon style={{ fontSize: 18 }} />
            Nueva clase
          </button>
        </div>
      </div>

      {onCreateClass && isFormOpen && (
        <form className={classes.newClassForm} onSubmit={handleSubmitNewClass}>
          <div className={classes.newClassFormTitle}>Nueva clase</div>
          <div className={classes.newClassFormSubtitle}>Completa estos datos para programar la sesión.</div>

          <div className={classes.newClassFieldGrid}>
            <div className={classes.newClassField}>
              <label className={classes.newClassLabel} htmlFor="new-class-title">
                Título de la clase
              </label>
              <input
                id="new-class-title"
                type="text"
                className={classes.newClassInput}
                placeholder="Ej: Matemáticas — Grupo A"
                value={titleInput}
                onChange={e => setTitleInput(e.target.value)}
                data-testid="dashboard-new-class-title-input"
              />
            </div>

            <MuiPickersUtilsProvider utils={DateFnsUtils} locale={esLocale}>
              <div className={classes.newClassField}>
                <label className={classes.newClassLabel} htmlFor="new-class-date">
                  Fecha
                </label>
                <KeyboardDatePicker
                  id="new-class-date"
                  autoOk
                  fullWidth
                  disableToolbar
                  disablePast
                  variant="inline"
                  inputVariant="outlined"
                  margin="none"
                  format="dd/MM/yyyy"
                  placeholder="dd/mm/aaaa"
                  value={dateValue}
                  onChange={setDateValue}
                  InputProps={{ classes: { input: classes.newClassPickerInput } }}
                  data-testid="dashboard-new-class-date-input"
                />
              </div>

              <div className={classes.newClassField}>
                <label className={classes.newClassLabel} htmlFor="new-class-time">
                  Hora
                </label>
                <MuiThemeProvider theme={meetTimePickerTheme}>
                  <KeyboardTimePicker
                    id="new-class-time"
                    autoOk
                    fullWidth
                    ampm
                    variant="inline"
                    inputVariant="outlined"
                    margin="none"
                    format="hh:mm a"
                    placeholder="hh:mm a"
                    value={timeValue}
                    onChange={setTimeValue}
                    InputProps={{ classes: { input: classes.newClassPickerInput } }}
                    keyboardIcon={<AccessTimeIcon style={{ color: '#64748b' }} />}
                    data-testid="dashboard-new-class-time-input"
                  />
                </MuiThemeProvider>
              </div>
            </MuiPickersUtilsProvider>

            <div className={classes.newClassField}>
              <label className={classes.newClassLabel} htmlFor="new-class-student-count">
                Alumnos esperados
              </label>
              <input
                id="new-class-student-count"
                type="number"
                min={0}
                className={classes.newClassInput}
                value={studentCountInput}
                onChange={e => setStudentCountInput(e.target.value)}
                data-testid="dashboard-new-class-student-count-input"
              />
            </div>

            <div className={classes.newClassField}>
              <label className={classes.newClassLabel} htmlFor="new-class-duration">
                Duración (minutos)
              </label>
              <input
                id="new-class-duration"
                type="number"
                min={1}
                max={480}
                className={classes.newClassInput}
                value={durationMinutesInput}
                onChange={e => setDurationMinutesInput(e.target.value)}
                data-testid="dashboard-new-class-duration-input"
              />
            </div>
          </div>

          <div className={classes.newClassActions}>
            <button
              type="submit"
              className={classes.newClassSubmitButton}
              disabled={isSubmitting}
              data-testid="dashboard-new-class-submit-button"
            >
              {isSubmitting ? 'Creando…' : 'Crear clase'}
            </button>
            <button type="button" className={classes.newClassCancelButton} onClick={resetForm}>
              Cancelar
            </button>
          </div>

          {formError && <div className={classes.newClassError}>{formError}</div>}
        </form>
      )}

      <div className={classes.sessionsGrid}>
        {sessions.map(session => (
          <div
            key={session.id}
            className={clsx(classes.sessionCard, { [classes.sessionCardHighlighted]: session.highlighted })}
            data-testid={`dashboard-session-card-${session.id}`}
          >
            <div className={classes.sessionBadges}>
              <span className={classes.badgeToday}>{session.dayLabel}</span>
              <span className={classes.badgeRelative}>{session.relativeLabel}</span>
            </div>
            <div className={classes.sessionTitle}>{session.title}</div>
            <div className={classes.sessionCode}>{session.code}</div>
            <div className={classes.sessionMeta}>
              <span className={classes.metaItem}>
                <AccessTimeIcon style={{ fontSize: 16 }} />
                {session.time}
              </span>
              <span className={classes.metaItem}>
                <PeopleAltIcon style={{ fontSize: 16 }} />
                {session.studentCount}
              </span>
            </div>
            {session.highlighted ? (
              <button
                type="button"
                className={classes.primaryButton}
                onClick={() => handleStartClass(session)}
                data-testid="dashboard-start-session-button"
              >
                <PlayArrowIcon style={{ fontSize: 18 }} />
                Iniciar sesión
              </button>
            ) : onCancelClass ? (
              <button
                type="button"
                className={classes.secondaryButton}
                onClick={() => onCancelClass(session)}
                disabled={cancellingClassId === session.id}
                data-testid="dashboard-cancel-session-button"
              >
                <DeleteIcon style={{ fontSize: 16 }} />
                {cancellingClassId === session.id ? 'Cancelando…' : 'Cancelar'}
              </button>
            ) : (
              <button type="button" className={classes.secondaryButton} data-testid="dashboard-view-details-button">
                <OpenInNewIcon style={{ fontSize: 16 }} />
                Ver detalles
              </button>
            )}
          </div>
        ))}
      </div>
      {cancelError && (
        <div className={classes.newClassError} data-testid="dashboard-cancel-error">
          {cancelError}{' '}
          <button type="button" onClick={onRetryCancel} data-testid="dashboard-retry-cancel-button">
            Reintentar cancelación
          </button>
        </div>
      )}
      {cancelExpiredError && (
        <div className={classes.newClassError} data-testid="dashboard-cancel-expired-error">
          {cancelExpiredError}
        </div>
      )}
    </div>
  );
}
