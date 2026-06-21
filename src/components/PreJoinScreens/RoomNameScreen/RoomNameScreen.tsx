import React, { ChangeEvent, useState } from 'react';
import { Typography, makeStyles, TextField, Button, InputLabel, Theme, Box, CircularProgress } from '@material-ui/core';
import SecurityIcon from '@material-ui/icons/Security';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import { useAppState } from '../../../state';
import {
  ClassSessionAccess,
  ClassSessionDraft,
  ClassSessionRole,
  isClassSessionDraftReady,
} from '../classSessionTypes';

const useStyles = makeStyles((theme: Theme) => ({
  // ── Single-card wrapper ───────────────────────────────────────────────────────
  singleCardLayout: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },

  // ── Individual card ──────────────────────────────────────────────────────────
  // Vertical spacing is fluid (clamp + vh) so the card compresses continuously
  // with the viewport height and the lobby fits on screen without scrolling.
  card: {
    display: 'flex',
    flexDirection: 'column',
    padding: 'clamp(10px, 2vh, 24px) 33px',
    position: 'relative',
    // Scroll instead of clipping: when the "Sesión creada" block or the room-closed
    // alert grows the card past a short viewport, the primary button must stay reachable.
    overflowY: 'auto',
  },
  cardBorderTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  cardBorderTopTeacher: {
    background: 'linear-gradient(90deg, #1d6eed 0%, #4d96ff 100%)',
  },
  cardBorderTopStudent: {
    background: 'linear-gradient(90deg, #ffb800 0%, #ffd54f 100%)',
  },

  // ── Card header ───────────────────────────────────────────────────────────────
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    paddingTop: 'clamp(2px, 0.8vh, 8px)',
    marginBottom: 0,
  },
  cardIconWrapTeacher: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#e3edfb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardIconWrapStudent: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#fff8e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitleBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  cardTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 19,
    color: '#1d2f6f',
    lineHeight: '25.65px',
    margin: 0,
  },
  cardSubtitle: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400,
    fontSize: 12,
    color: '#64748b',
    lineHeight: '18px',
  },

  // ── Tag badge (EP01...) ────────────────────────────────────────────────────────
  tagBadge: {
    display: 'inline-block',
    fontSize: 10,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 500,
    color: '#94a3b8',
    border: '1px solid #e2ecf9',
    borderRadius: 20,
    backgroundColor: '#f0f5ff',
    padding: '4px 10px',
    marginTop: 8,
    alignSelf: 'flex-start',
    lineHeight: '15px',
  },

  // ── Field label ────────────────────────────────────────────────────────────────
  fieldLabel: {
    display: 'block',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: 12,
    color: '#1d2f6f',
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
    lineHeight: '18px',
    marginBottom: 6,
    paddingBottom: 0,
  },
  fieldHelper: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400,
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: '16.5px',
    marginTop: 5,
  },

  // ── Text input ─────────────────────────────────────────────────────────────────
  textInput: {
    '& .MuiOutlinedInput-root': {
      borderRadius: 10,
      backgroundColor: '#f8faff',
      '& fieldset': {
        borderColor: '#e2ecf9',
        borderWidth: '1.5px',
      },
      '&:hover fieldset': {
        borderColor: '#1d6eed',
      },
      '&.Mui-focused fieldset': {
        borderColor: '#1d6eed',
        borderWidth: '1.5px',
      },
    },
    '& .MuiInputBase-input': {
      fontFamily: 'Poppins, Inter, sans-serif',
      fontWeight: 400,
      fontSize: 13,
      color: '#353535',
      padding: 'clamp(8px, 1.3vh, 12.5px) 15.5px',
    },
  },

  // ── Primary buttons ────────────────────────────────────────────────────────────
  teacherPrimaryButton: {
    width: '100%',
    height: 49,
    borderRadius: 12,
    background: 'linear-gradient(171.53deg, #1d6eed 0%, #1557c8 100%)',
    boxShadow: '0px 4px 7px rgba(29,110,237,0.35)',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: '0.14px',
    color: '#ffffff',
    textTransform: 'none',
    '&:hover': {
      background: 'linear-gradient(171.53deg, #1557c8 0%, #1040a0 100%)',
      boxShadow: '0px 6px 10px rgba(29,110,237,0.4)',
    },
    '&:disabled': {
      background: '#e2ecf9',
      boxShadow: 'none',
      color: '#94a3b8',
    },
  },
  studentPrimaryButton: {
    width: '100%',
    height: 49,
    borderRadius: 12,
    backgroundColor: '#1d2f6f',
    boxShadow: '0px 4px 7px rgba(29,47,111,0.30)',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: '0.14px',
    color: '#ffffff',
    textTransform: 'none',
    '&:hover': {
      backgroundColor: '#152356',
      boxShadow: '0px 6px 10px rgba(29,47,111,0.4)',
    },
    '&:disabled': {
      backgroundColor: '#e2ecf9',
      boxShadow: 'none',
      color: '#94a3b8',
    },
  },

  // ── Privacy notice box ─────────────────────────────────────────────────────────
  privacyBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#f8faff',
    border: '1.5px solid rgba(29,110,237,0.15)',
    borderRadius: 12,
    padding: 'clamp(9px, 1.5vh, 15.5px) 17.5px',
    marginBottom: 'clamp(6px, 1.4vh, 15px)',
  },
  privacyIconWrap: {
    paddingTop: 2,
    flexShrink: 0,
  },
  privacyTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: 12,
    color: '#1d2f6f',
    lineHeight: '18px',
    marginBottom: 3,
  },
  privacyBody: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400,
    fontSize: 11,
    color: '#64748b',
    lineHeight: '17.05px',
    '& strong': {
      fontWeight: 700,
    },
  },

  // ── Room closed alert ──────────────────────────────────────────────────────────
  roomClosedAlert: {
    marginBottom: theme.spacing(2),
    padding: theme.spacing(1.5),
    borderRadius: theme.spacing(1),
    backgroundColor: '#FDECEA',
    border: '1px solid #F5C6CB',
    color: '#B71C1C',
  },

  // ── Session created card ───────────────────────────────────────────────────────
  createdCard: {
    border: '1px solid #C8E6C9',
    backgroundColor: '#F1F8E9',
    borderRadius: theme.spacing(1),
    padding: theme.spacing(2),
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  createdHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: 4,
  },
  createdHeaderIcon: {
    color: '#2E7D32',
  },
  createdTitle: {
    fontWeight: 600,
    color: '#2E7D32',
  },
  createdHint: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2),
  },
  createdRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.5),
  },
  createdValueBlock: {
    minWidth: 0,
    flex: 1,
  },
  createdLabel: {
    color: theme.palette.text.secondary,
    display: 'block',
  },

  // ── Role-switch link ───────────────────────────────────────────────────────────
  roleSwitchRow: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: 'clamp(6px, 1.1vh, 12px)',
    paddingBottom: 'clamp(4px, 1vh, 10px)',
  },
  roleSwitchLink: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 500,
    fontSize: 13,
    color: '#1d6eed',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
    lineHeight: '19.5px',
    '&:hover': {
      color: '#1040a0',
    },
  },

  // ── Spacing helpers ────────────────────────────────────────────────────────────
  fieldBlock: {
    marginTop: 'clamp(8px, 1.5vh, 16px)',
    width: '100%',
  },
  fieldBlockInner: {
    marginTop: 'clamp(6px, 1.3vh, 14px)',
    width: '100%',
  },
  buttonArea: {
    marginTop: 'auto',
    paddingTop: 'clamp(8px, 1.6vh, 16px)',
  },
}));

interface RoomNameScreenProps {
  name: string;
  roomName: string;
  teacherDisplayName: string;
  classSessionDraft: ClassSessionDraft;
  classSessionAccess: ClassSessionAccess | null;
  studentJoinCode: string;
  isCheckingRoom?: boolean;
  roomClosedError?: boolean;
  setName: (name: string) => void;
  setStudentJoinCode: (joinCode: string) => void;
  setClassSessionDraft: (updater: (draft: ClassSessionDraft) => ClassSessionDraft) => void;
  onSelectRole: (role: ClassSessionRole) => void;
  onCreateClassSession: () => void;
  onContinueToDeviceSelection: () => void;
  // Dedicated handler for the student card's join button. Ensures the student flow (room-open
  // check, URL update) always runs even when the draft role is currently 'teacher'.
  onContinueAsStudent?: () => void;
}

export default function RoomNameScreen({
  name,
  roomName,
  teacherDisplayName,
  classSessionDraft,
  classSessionAccess,
  studentJoinCode,
  isCheckingRoom = false,
  roomClosedError = false,
  setName,
  setStudentJoinCode,
  setClassSessionDraft,
  onSelectRole,
  onCreateClassSession,
  onContinueToDeviceSelection,
  onContinueAsStudent,
}: RoomNameScreenProps) {
  const classes = useStyles();
  const { user } = useAppState();
  const [copied, setCopied] = useState(false);

  // Active role is tracked locally and seeded from the draft role supplied by the parent.
  // The role-switch link toggles between teacher and student views without needing a round-trip.
  const [activeRole, setActiveRole] = useState<ClassSessionRole>(classSessionDraft.role);

  const handleCopy = (value: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value);
    }
    setCopied(true);
  };

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  };

  const handleSessionNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setClassSessionDraft(draft => ({ ...draft, sessionName: value }));
  };

  const handleSwitchRole = (newRole: ClassSessionRole) => {
    setActiveRole(newRole);
    onSelectRole(newRole);
  };

  const hasUsername = !window.location.search.includes('customIdentity=true') && user?.displayName;
  const canCreateTeacherSession = isClassSessionDraftReady(classSessionDraft);
  const canContinueStudent = Boolean(name.trim() && studentJoinCode.trim());
  void roomName;

  return (
    <div className={classes.singleCardLayout}>
      {activeRole === 'teacher' ? (
        /* ── Profesor card ──────────────────────────────────────────────────────── */
        // <form> so pressing Enter in any field implicitly submits → clicks the
        // primary submit button. onSubmit only prevents the native page reload.
        <form className={classes.card} onSubmit={event => event.preventDefault()}>
          {/* Blue top border */}
          <div className={`${classes.cardBorderTop} ${classes.cardBorderTopTeacher}`} />

          {/* Card header */}
          <div className={classes.cardHeader}>
            <div className={classes.cardIconWrapTeacher}>
              {/* Book / classroom icon */}
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M3 5.5A2.5 2.5 0 0 1 5.5 3h11A2.5 2.5 0 0 1 19 5.5v11A2.5 2.5 0 0 1 16.5 19H5.5A2.5 2.5 0 0 1 3 16.5V5.5Z"
                  stroke="#1d6eed"
                  strokeWidth="1.5"
                  fill="none"
                />
                <path d="M7 8h8M7 11h5" stroke="#1d6eed" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className={classes.cardTitleBlock}>
              <p className={classes.cardTitle}>Profesor</p>
              <p className={classes.cardSubtitle}>Crear nueva sala de clase</p>
            </div>
          </div>

          <span className={classes.tagBadge}>Gestión de Sala</span>

          {/* Session name field */}
          <div className={classes.fieldBlock}>
            <InputLabel shrink htmlFor="input-session-name" className={classes.fieldLabel}>
              Nombre de la sala
            </InputLabel>
            <TextField
              id="input-session-name"
              variant="outlined"
              fullWidth
              size="small"
              placeholder="Ej: Matemáticas — Grupo A"
              value={classSessionDraft.sessionName}
              onChange={handleSessionNameChange}
              className={classes.textInput}
            />
          </div>

          {/* Optional teacher name field (shown when no logged-in user or customIdentity) */}
          {!hasUsername && (
            <div className={classes.fieldBlockInner}>
              <InputLabel shrink htmlFor="input-user-name" className={classes.fieldLabel}>
                Tu nombre
              </InputLabel>
              <TextField
                id="input-user-name"
                variant="outlined"
                fullWidth
                size="small"
                value={name}
                onChange={handleNameChange}
                className={classes.textInput}
              />
            </div>
          )}

          {/* Session created info */}
          {classSessionAccess && (
            <Box className={classes.createdCard}>
              <div className={classes.createdHeader}>
                <CheckCircleIcon className={classes.createdHeaderIcon} fontSize="small" />
                <Typography variant="subtitle1" className={classes.createdTitle}>
                  Sesión creada
                </Typography>
              </div>
              <Typography variant="body2" className={classes.createdHint}>
                Compartí el código o el link con tus estudiantes.
              </Typography>

              <div className={classes.createdRow}>
                <div className={classes.createdValueBlock}>
                  <Typography variant="caption" className={classes.createdLabel}>
                    Identidad visible en sala
                  </Typography>
                  <Typography variant="body2">{teacherDisplayName}</Typography>
                </div>
              </div>

              <div className={classes.createdRow}>
                <div className={classes.createdValueBlock}>
                  <Typography variant="caption" className={classes.createdLabel}>
                    Nombre de la sala
                  </Typography>
                  <Typography variant="body2" noWrap title={classSessionAccess.joinCode}>
                    {classSessionAccess.joinCode}
                  </Typography>
                </div>
                <Button
                  type="button"
                  size="small"
                  startIcon={<FileCopyOutlinedIcon fontSize="small" />}
                  onClick={() => handleCopy(classSessionAccess.joinCode)}
                >
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </Box>
          )}

          {/* Primary button area */}
          <div className={classes.buttonArea}>
            {!classSessionAccess ? (
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={!canCreateTeacherSession}
                onClick={onCreateClassSession}
                className={classes.teacherPrimaryButton}
              >
                Crear sala →
              </Button>
            ) : (
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                onClick={onContinueToDeviceSelection}
                className={classes.teacherPrimaryButton}
              >
                Continuar a verificación
              </Button>
            )}
          </div>
        </form>
      ) : (
        /* ── Estudiante card ────────────────────────────────────────────────────── */
        // <form> so Enter in the join-code or name field submits → clicks "Unirme".
        <form className={classes.card} onSubmit={event => event.preventDefault()}>
          {/* Amber top border */}
          <div className={`${classes.cardBorderTop} ${classes.cardBorderTopStudent}`} />

          {/* Card header */}
          <div className={classes.cardHeader}>
            <div className={classes.cardIconWrapStudent}>
              {/* Person / student icon */}
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="11" cy="7.5" r="3.5" stroke="#ffb800" strokeWidth="1.5" />
                <path
                  d="M4 18c0-3.314 3.134-6 7-6s7 2.686 7 6"
                  stroke="#ffb800"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className={classes.cardTitleBlock}>
              <p className={classes.cardTitle}>Estudiante</p>
              <p className={classes.cardSubtitle}>Unirme a sala existente</p>
            </div>
          </div>

          <span className={classes.tagBadge}>Acceso de Estudiante</span>

          {/* Join code field */}
          <div className={classes.fieldBlock}>
            <InputLabel shrink htmlFor="input-join-code" className={classes.fieldLabel}>
              Código o enlace de sala
            </InputLabel>
            <TextField
              id="input-join-code"
              variant="outlined"
              fullWidth
              size="small"
              placeholder="Ingresar código de sesión"
              value={studentJoinCode}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setStudentJoinCode(event.target.value)}
              className={classes.textInput}
            />
          </div>

          {/* Student name field */}
          <div className={classes.fieldBlockInner}>
            <InputLabel shrink htmlFor="input-student-name" className={classes.fieldLabel}>
              Tu nombre o alias
            </InputLabel>
            <TextField
              id="input-student-name"
              variant="outlined"
              fullWidth
              size="small"
              placeholder="Ej: Ana García"
              value={name}
              onChange={handleNameChange}
              className={classes.textInput}
            />
            <span className={classes.fieldHelper}>No requiere crear una cuenta</span>
          </div>

          {/* Privacy notice */}
          <div className={classes.fieldBlockInner}>
            <div className={classes.privacyBox}>
              <span className={classes.privacyIconWrap}>
                <SecurityIcon fontSize="small" style={{ color: '#1d6eed', display: 'block' }} />
              </span>
              <div>
                <p className={classes.privacyTitle}>Aviso de privacidad</p>
                <p className={classes.privacyBody}>
                  Al unirte aceptas el procesamiento <strong>local</strong> de imagen para análisis de atención. No se
                  almacenan datos faciales.
                </p>
              </div>
            </div>
          </div>

          {/* Room closed error */}
          {roomClosedError && (
            <Box className={classes.roomClosedAlert} role="alert">
              <Typography variant="body2">
                La sala todavía no está abierta. Pedile al docente que inicie la sesión antes de entrar.
              </Typography>
            </Box>
          )}

          {/* Primary button area */}
          <div className={classes.buttonArea}>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={!canContinueStudent || isCheckingRoom}
              onClick={() => {
                if (onContinueAsStudent) {
                  onContinueAsStudent();
                } else {
                  onSelectRole('student');
                  onContinueToDeviceSelection();
                }
              }}
              className={classes.studentPrimaryButton}
              startIcon={isCheckingRoom ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {isCheckingRoom ? 'Verificando sala…' : 'Unirme a la sala →'}
            </Button>
          </div>
        </form>
      )}

      {/* ── Role-switch link ─────────────────────────────────────────────────────── */}
      <div className={classes.roleSwitchRow}>
        {activeRole === 'teacher' ? (
          <button
            type="button"
            className={classes.roleSwitchLink}
            onClick={() => handleSwitchRole('student')}
            data-testid="switch-to-student"
          >
            Unirse como estudiante
          </button>
        ) : (
          <button
            type="button"
            className={classes.roleSwitchLink}
            onClick={() => handleSwitchRole('teacher')}
            data-testid="switch-to-teacher"
          >
            Volver a crear sesión
          </button>
        )}
      </div>
    </div>
  );
}
