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
import MeetingRoomIcon from '@material-ui/icons/MeetingRoom';
import { MuiPickersUtilsProvider, KeyboardDatePicker, KeyboardTimePicker } from '@material-ui/pickers';
import DateFnsUtils from '@date-io/date-fns';
import esLocale from 'date-fns/locale/es';
import { DashboardStat, UpcomingSession } from './types';
import { statCardIcon } from './dashboardHelpers';
import { toClassSessionDisplayName, toClassSessionRoomName } from '../../classSession/classSessionTypes';
import { validateNewClass } from './newClassValidation';
import { resolveClassAction, ClassAction } from './classAction';
import { ClassRecord } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { MuiPickersOverrides } from '@material-ui/pickers/typings/overrides';
import { StyleRules } from '@material-ui/core/styles/withStyles';
import baseTheme from '../../theme';
import { dateLocale } from '../../i18n/locale';
import { t } from '../../i18n/translate';

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
  sessionCardExpired: {
    filter: 'grayscale(1)',
    opacity: 0.75,
  },
  expiredCancelButton: {
    transition: 'background-color 0.15s ease, border-color 0.15s ease',
    '&:hover:not(:disabled)': {
      backgroundColor: '#f1f5f9',
      borderColor: '#cbd5e1',
    },
    '&:disabled': {
      cursor: 'default',
    },
  },
  expiredSection: {
    marginTop: theme.spacing(3),
  },
  expiredSectionTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '1rem',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2),
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
  newClassDuplicateWarning: {
    marginTop: theme.spacing(1.5),
    fontFamily: 'Inter, sans-serif',
    fontSize: '0.8125rem',
    color: '#92620a',
    backgroundColor: '#fff8e6',
    border: '1px solid #f0c36d',
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1, 1.5),
  },
}));

// "15 jul" — same day/month-short convention as the rest of the dashboard
// (ResourcesTab's formatDateLabel, CalendarTab's day labels).
function formatDuplicateDateLabel(ms: number | null): string {
  if (ms === null) return 'sin fecha';
  return new Date(ms).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });
}

interface Props {
  stats: DashboardStat[];
  dateLabel: string;
  sessions: UpcomingSession[];
  professorName: string;
  onStartClass: (session: { roomName: string; name: string; classId?: string }) => void;
  /** Firebase-mode only: every scheduled class the teacher currently has (any date,
   * any status), used only to warn about a same-titled class before creating a new
   * one — not a rendering source. Undefined/empty elsewhere skips the check. */
  existingClasses?: ClassRecord[];
  /** Firebase-mode only: creates a real scheduled class. Undefined elsewhere —
   * the "Nueva clase" button then keeps its stub (no-op) appearance. */
  onCreateClass?: (input: {
    title: string;
    scheduledAtMs: number;
    studentCount: number;
    durationMinutes: number;
    idempotencyKey: string;
    roomName: string;
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
  /** Same expired set as expiredClassesCount, in the same card shape as `sessions` —
   * rendered grayed out in their own "Sesiones vencidas" section below. */
  expiredSessions?: UpcomingSession[];
  onCancelExpiredClasses?: () => void;
  isCancellingExpired?: boolean;
  cancelExpiredError?: string | null;
  /** True when `stats`/`sessions` (respectively) came from mockDashboardData instead of a
   * real backend — each flag is independent since they can fall back separately. */
  statsAreMock?: boolean;
  sessionsAreMock?: boolean;
  /** Set when a pre-start collision check finds a live Twilio room already using this name. */
  startClassError?: string | null;
  /** True while the pre-start collision check is in flight. */
  isStartingClass?: boolean;
  /** Latest "is this room open?" probe per room name, for the teacher's started classes. */
  startedRoomStatus?: Record<string, boolean | null>;
  /** Re-checks the started rooms now (rate-limited upstream); the "Actualizar" control only shows with it. */
  onRefreshRooms?: () => void;
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
  existingClasses = [],
  professorName,
  onStartClass,
  onCreateClass,
  onCancelClass,
  cancellingClassId,
  cancelError,
  onRetryCancel,
  expiredClassesCount = 0,
  expiredSessions = [],
  onCancelExpiredClasses,
  isCancellingExpired,
  cancelExpiredError,
  statsAreMock = false,
  sessionsAreMock = false,
  startClassError,
  isStartingClass,
  startedRoomStatus = {},
  onRefreshRooms,
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

  // Non-blocking heads-up only: same title as another still-relevant class doesn't
  // collide (roomName is disambiguated per class doc, see server/classes.ts), but a
  // teacher who forgot they already scheduled "mate" for another day benefits from
  // knowing before confirming, rather than only discovering it later in Recursos.
  const trimmedTitleInput = titleInput.trim();
  const duplicateClass = trimmedTitleInput
    ? existingClasses.find(
        classRecord =>
          classRecord.status !== 'completed' &&
          classRecord.title.trim().toLowerCase() === trimmedTitleInput.toLowerCase()
      )
    : undefined;

  const handleStartClass = (session: UpcomingSession) => {
    onStartClass({
      roomName: session.roomName || toClassSessionRoomName(session.title),
      name: toClassSessionDisplayName(professorName, 'teacher'),
      classId: session.classId,
    });
  };

  const statusById = new Map(existingClasses.map(classRecord => [classRecord.id, classRecord.status]));
  const actionFor = (session: UpcomingSession): ClassAction =>
    resolveClassAction(statusById.get(session.id), startedRoomStatus[session.roomName || '']);
  // Started classes whose card is not in the upcoming grid (their scheduled time is long past)
  // still need their way back into the room.
  const inProgressSessions: UpcomingSession[] = existingClasses
    .filter(classRecord => classRecord.status === 'started' && !sessions.some(s => s.id === classRecord.id))
    .map(classRecord => ({
      id: classRecord.id,
      title: classRecord.title,
      code: classRecord.roomName,
      roomName: classRecord.roomName,
      classId: classRecord.id,
      studentCount: classRecord.studentCount,
      time: '',
      dayLabel: 'En curso',
      relativeLabel: '',
      highlighted: false,
    }));

  /** Actions for a started class; null when the plain "Iniciar sesión" flow applies. */
  const renderStartedAction = (session: UpcomingSession, action: ClassAction) => {
    if (action === 'rejoin') {
      return (
        <button
          type="button"
          className={classes.primaryButton}
          onClick={() => handleStartClass(session)}
          disabled={isStartingClass}
          data-testid="dashboard-rejoin-session-button"
        >
          <MeetingRoomIcon style={{ fontSize: 18 }} />
          {isStartingClass ? t('Verificando…') : t('Volver a entrar')}
        </button>
      );
    }
    if (action === 'closed-restart') {
      return (
        <>
          <div className={classes.newClassError} data-testid="dashboard-room-closed-note">
            {t('La sala ya se cerró. Puedes iniciarla de nuevo como una sesión nueva.')}
          </div>
          <button
            type="button"
            className={classes.secondaryButton}
            onClick={() => handleStartClass(session)}
            disabled={isStartingClass}
            data-testid="dashboard-restart-session-button"
          >
            <PlayArrowIcon style={{ fontSize: 16 }} />
            {isStartingClass ? t('Verificando…') : t('Iniciar de nuevo')}
          </button>
        </>
      );
    }
    if (action === 'checking') {
      return (
        <button
          type="button"
          className={classes.secondaryButton}
          disabled
          data-testid="dashboard-checking-session-button"
        >
          {t('Verificando sala…')}
        </button>
      );
    }
    return null;
  };

  const handleNewClassClick = () => {
    if (!onCreateClass) return;
    if (!isFormOpen) creationIdempotencyKeyRef.current = createIdempotencyKey();
    setIsFormOpen(!isFormOpen);
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

    const validation = validateNewClass(
      {
        title: titleInput,
        date: dateValue,
        time: timeValue,
        studentCount: studentCountInput,
        durationMinutes: durationMinutesInput,
      },
      Date.now()
    );
    if (!validation.ok) {
      setFormError(validation.message);
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    onCreateClass({
      ...validation.value,
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
            {t('Datos simulados')}
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
                <div className={classes.statLabel}>{t(stat.label)}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={classes.sectionHeader}>
        <div>
          <div className={classes.sectionTitle}>
            {t('Próximas sesiones')}
            {sessionsAreMock && (
              <span className={classes.mockTag} data-testid="dashboard-sessions-mock-tag">
                {t('Datos simulados')}
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
                ? t('Cancelando…')
                : expiredClassesCount === 1
                ? t('Cancelar vencida')
                : t('Cancelar {{count}} vencidas', { count: expiredClassesCount })}
            </button>
          )}
          <button
            type="button"
            className={classes.newClassButton}
            onClick={handleNewClassClick}
            data-testid="dashboard-new-class-button"
          >
            <AddIcon style={{ fontSize: 18 }} />
            {t('Nueva clase')}
          </button>
        </div>
      </div>

      {onCreateClass && isFormOpen && (
        <form className={classes.newClassForm} onSubmit={handleSubmitNewClass}>
          <div className={classes.newClassFormTitle}>{t('Nueva clase')}</div>
          <div className={classes.newClassFormSubtitle}>{t('Completa estos datos para programar la sesión.')}</div>

          <div className={classes.newClassFieldGrid}>
            <div className={classes.newClassField}>
              <label className={classes.newClassLabel} htmlFor="new-class-title">
                {t('Título de la clase')}
              </label>
              <input
                id="new-class-title"
                type="text"
                className={classes.newClassInput}
                placeholder={t('Ej: Matemáticas — Grupo A')}
                value={titleInput}
                onChange={e => setTitleInput(e.target.value)}
                data-testid="dashboard-new-class-title-input"
              />
            </div>

            <MuiPickersUtilsProvider utils={DateFnsUtils} locale={esLocale}>
              <div className={classes.newClassField}>
                <label className={classes.newClassLabel} htmlFor="new-class-date">
                  {t('Fecha')}
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
                  placeholder={t('dd/mm/aaaa')}
                  value={dateValue}
                  onChange={setDateValue}
                  InputProps={{ classes: { input: classes.newClassPickerInput } }}
                  data-testid="dashboard-new-class-date-input"
                />
              </div>

              <div className={classes.newClassField}>
                <label className={classes.newClassLabel} htmlFor="new-class-time">
                  {t('Hora')}
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
                {t('Alumnos esperados')}
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
                {t('Duración (minutos)')}
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
              {isSubmitting ? t('Creando…') : t('Crear clase')}
            </button>
            <button type="button" className={classes.newClassCancelButton} onClick={resetForm}>
              {t('Cancelar')}
            </button>
          </div>

          {!formError && duplicateClass && (
            <div className={classes.newClassDuplicateWarning} data-testid="dashboard-new-class-duplicate-warning">
              {t(
                'Ya tienes una clase "{{title}}" programada para el {{when}}. Puedes crear esta igual si es una sesión distinta.',
                { title: duplicateClass.title, when: formatDuplicateDateLabel(duplicateClass.scheduledAtMs) }
              )}
            </div>
          )}
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
            {renderStartedAction(session, actionFor(session)) ||
              (session.highlighted ? (
                <button
                  type="button"
                  className={classes.primaryButton}
                  onClick={() => handleStartClass(session)}
                  disabled={isStartingClass}
                  data-testid="dashboard-start-session-button"
                >
                  <PlayArrowIcon style={{ fontSize: 18 }} />
                  {isStartingClass ? t('Verificando…') : t('Iniciar sesión')}
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
                  {cancellingClassId === session.id ? t('Cancelando…') : t('Cancelar')}
                </button>
              ) : (
                <button type="button" className={classes.secondaryButton} data-testid="dashboard-view-details-button">
                  <OpenInNewIcon style={{ fontSize: 16 }} />
                  {t('Ver detalles')}
                </button>
              ))}
          </div>
        ))}
      </div>

      {inProgressSessions.length > 0 && (
        <div className={classes.expiredSection} data-testid="dashboard-in-progress-section">
          <div className={classes.expiredSectionTitle}>{t('Sesiones en curso')}</div>
          {onRefreshRooms && (
            <button
              type="button"
              className={classes.secondaryButton}
              onClick={onRefreshRooms}
              data-testid="dashboard-refresh-rooms-button"
            >
              {t('Actualizar')}
            </button>
          )}
          <div className={classes.sessionsGrid}>
            {inProgressSessions.map(session => (
              <div
                key={session.id}
                className={classes.sessionCard}
                data-testid={`dashboard-in-progress-card-${session.id}`}
              >
                <div className={classes.sessionTitle}>{session.title}</div>
                <div className={classes.sessionCode}>{session.code}</div>
                {renderStartedAction(session, actionFor(session)) || (
                  <button
                    type="button"
                    className={classes.primaryButton}
                    onClick={() => handleStartClass(session)}
                    disabled={isStartingClass}
                    data-testid="dashboard-start-session-button"
                  >
                    <PlayArrowIcon style={{ fontSize: 18 }} />
                    {isStartingClass ? t('Verificando…') : t('Iniciar sesión')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {expiredSessions.length > 0 && (
        <div className={classes.expiredSection} data-testid="dashboard-expired-sessions-section">
          <div className={classes.expiredSectionTitle}>{t('Sesiones vencidas')}</div>
          <div className={classes.sessionsGrid}>
            {expiredSessions.map(session => (
              <div
                key={session.id}
                className={clsx(classes.sessionCard, classes.sessionCardExpired)}
                data-testid={`dashboard-expired-session-card-${session.id}`}
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
                {onCancelClass && (
                  <button
                    type="button"
                    className={clsx(classes.secondaryButton, classes.expiredCancelButton)}
                    onClick={() => onCancelClass(session)}
                    disabled={cancellingClassId === session.id}
                    data-testid="dashboard-cancel-expired-session-button"
                  >
                    <DeleteIcon style={{ fontSize: 16 }} />
                    {cancellingClassId === session.id ? t('Cancelando…') : t('Cancelar')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {cancelError && (
        <div className={classes.newClassError} data-testid="dashboard-cancel-error">
          {cancelError}{' '}
          <button type="button" onClick={onRetryCancel} data-testid="dashboard-retry-cancel-button">
            {t('Reintentar cancelación')}
          </button>
        </div>
      )}
      {cancelExpiredError && (
        <div className={classes.newClassError} data-testid="dashboard-cancel-expired-error">
          {cancelExpiredError}
        </div>
      )}
      {startClassError && (
        <div className={classes.newClassError} data-testid="dashboard-start-error">
          {startClassError}
        </div>
      )}
    </div>
  );
}
