import React, { ChangeEvent, useState } from 'react';
import {
  Typography,
  makeStyles,
  TextField,
  Grid,
  Button,
  InputLabel,
  Theme,
  FormControl,
  FormLabel,
  Box,
  CircularProgress,
} from '@material-ui/core';
import PersonIcon from '@material-ui/icons/Person';
import SecurityIcon from '@material-ui/icons/Security';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { useAppState } from '../../../state';
import {
  ClassSessionAccess,
  ClassSessionDraft,
  ClassSessionRole,
  MonitoringSensitivity,
  isClassSessionDraftReady,
} from '../classSessionTypes';

const useStyles = makeStyles((theme: Theme) => ({
  gutterBottom: {
    marginBottom: '1em',
  },
  inputContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    margin: '1.5em 0 3.5em',
    '& div:not(:last-child)': {
      marginRight: '1em',
    },
    [theme.breakpoints.down('sm')]: {
      margin: '1.5em 0 2em',
    },
  },
  textFieldContainer: {
    width: '100%',
  },
  continueButton: {
    [theme.breakpoints.down('sm')]: {
      width: '100%',
    },
  },
  controlCard: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.spacing(1.5),
    padding: theme.spacing(2),
  },
  controlHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
  },
  controlMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  },
  helperText: {
    color: theme.palette.text.secondary,
  },
  switchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  recordingToggleButton: {
    width: 40,
    height: 22,
    borderRadius: 11,
    border: 0,
    cursor: 'pointer',
    position: 'relative',
    padding: 0,
    backgroundColor: '#424242',
  },
  recordingToggleKnob: {
    width: 16,
    height: 16,
    borderRadius: '50%',
    backgroundColor: '#FFFFFF',
    position: 'absolute',
    top: 3,
    transition: 'left 120ms ease, right 120ms ease',
  },
  recordingToggleKnobOn: {
    right: 4,
  },
  recordingToggleKnobOff: {
    left: 4,
  },
  switchState: {
    minWidth: 56,
    textAlign: 'right',
    fontSize: 11,
    color: '#9E9E9E',
  },
  sensitivitySliderBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(2),
  },
  sensitivitySliderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1.5),
  },
  sliderEndLabel: {
    color: '#9E9E9E',
    fontSize: 10,
    minWidth: 28,
  },
  sliderTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    position: 'relative',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#424242',
    borderRadius: 3,
  },
  sliderThumb: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    backgroundColor: '#424242',
    border: '2px solid #FFFFFF',
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
  },
  nativeRangeInput: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: 22,
    margin: 0,
    opacity: 0,
    cursor: 'pointer',
  },
  sensitivityStateLabel: {
    color: '#9E9E9E',
    fontSize: 10,
    marginTop: theme.spacing(0.5),
  },
  studentIntro: {
    marginBottom: theme.spacing(2),
  },
  studentCard: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  studentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  studentHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#424242',
    color: '#FFFFFF',
  },
  studentHeaderCaption: {
    fontSize: 11,
    color: '#9E9E9E',
    lineHeight: 1.4,
  },
  studentTag: {
    display: 'inline-block',
    fontSize: 10,
    color: '#9E9E9E',
    border: '1px solid #E0E0E0',
    borderRadius: 3,
    backgroundColor: '#F5F5F5',
    padding: '4px 10px',
    marginBottom: theme.spacing(3),
    alignSelf: 'flex-start',
  },
  studentFields: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  studentPrivacyRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
  },
  studentActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  studentRoomClosed: {
    marginBottom: theme.spacing(2),
    padding: theme.spacing(1.5),
    borderRadius: theme.spacing(1),
    backgroundColor: '#FDECEA',
    border: '1px solid #F5C6CB',
    color: '#B71C1C',
  },
  createdCard: {
    border: '1px solid #C8E6C9',
    backgroundColor: '#F1F8E9',
    borderRadius: theme.spacing(1),
    padding: theme.spacing(2),
  },
  createdHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
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
  studentPrimaryButton: {
    width: '100%',
  },
  studentBackButton: {
    alignSelf: 'flex-start',
    paddingLeft: 0,
  },
  studentPrivacyNotice: {
    marginBottom: theme.spacing(3),
    padding: theme.spacing(1.5),
    border: `1px dashed ${theme.palette.divider}`,
    borderRadius: theme.spacing(1),
    backgroundColor: theme.palette.action.hover,
    width: '100%',
  },
  studentPrivacyTitle: {
    fontWeight: 500,
  },
  studentPrivacyText: {
    color: theme.palette.text.secondary,
  },
  studentPrivacyLink: {
    display: 'inline-block',
    marginTop: theme.spacing(0.75),
    color: theme.palette.primary.main,
    fontWeight: 500,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
}));

const sensitivityToValue: Record<MonitoringSensitivity, number> = {
  low: 0,
  medium: 50,
  high: 100,
};

function valueToSensitivity(value: number): MonitoringSensitivity {
  if (value <= 25) return 'low';
  if (value >= 75) return 'high';
  return 'medium';
}

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
}: RoomNameScreenProps) {
  const classes = useStyles();
  const { user } = useAppState();
  const [copied, setCopied] = useState(false);

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

  const handleRecordingChange = (_event: ChangeEvent<HTMLInputElement>, checked: boolean) => {
    setClassSessionDraft(draft => ({ ...draft, recordingEnabled: checked }));
  };

  const handleSensitivityChange = (_event: unknown, value: number | number[]) => {
    const nextValue = Array.isArray(value) ? value[0] : value;
    setClassSessionDraft(draft => ({ ...draft, monitoringSensitivity: valueToSensitivity(nextValue) }));
  };

  const hasUsername = !window.location.search.includes('customIdentity=true') && user?.displayName;
  const canCreateTeacherSession = isClassSessionDraftReady(classSessionDraft);
  const isStudentFlow = classSessionDraft.role === 'student';
  const canContinueStudent = Boolean(name.trim() && studentJoinCode.trim());
  const sensitivityValue = sensitivityToValue[classSessionDraft.monitoringSensitivity];
  void roomName;

  if (isStudentFlow) {
    return (
      <div className={classes.studentCard}>
        <div className={classes.studentHeader}>
          <div className={classes.studentHeaderIcon}>
            <PersonIcon fontSize="small" />
          </div>

          <div>
            <Typography variant="h5">Estudiante</Typography>
            <Typography className={classes.studentHeaderCaption}>Unirme a sala existente</Typography>
          </div>
        </div>

        <span className={classes.studentTag}>EP01 · Flujo de acceso estudiante</span>

        <Typography variant="body1" className={classes.studentIntro}>
          Accede con el nombre de la sala que te compartió tu docente.
        </Typography>

        <div className={classes.studentFields}>
          <div className={classes.textFieldContainer}>
            <InputLabel shrink htmlFor="input-join-code">
              Nombre de la sala
            </InputLabel>
            <TextField
              id="input-join-code"
              variant="outlined"
              fullWidth
              size="small"
              placeholder="Ej: fisica-101"
              value={studentJoinCode}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setStudentJoinCode(event.target.value)}
            />
          </div>
          <div className={classes.textFieldContainer}>
            <InputLabel shrink htmlFor="input-student-name">
              Tu nombre o alias
            </InputLabel>
            <TextField
              id="input-student-name"
              variant="outlined"
              fullWidth
              size="small"
              placeholder="Ej: María González"
              value={name}
              onChange={handleNameChange}
            />
          </div>
        </div>

        <Box className={classes.studentPrivacyNotice}>
          <div className={classes.studentPrivacyRow}>
            <SecurityIcon fontSize="small" color="action" />
            <div>
              <Typography variant="subtitle2" className={classes.studentPrivacyTitle}>
                Aviso de privacidad
              </Typography>
              <Typography variant="body2" className={classes.studentPrivacyText}>
                Al unirte aceptas el procesamiento local de imagen para análisis de atención. No se almacenan datos
                faciales.
              </Typography>
              <RouterLink to="/security" className={classes.studentPrivacyLink}>
                Política de privacidad →
              </RouterLink>
            </div>
          </div>
        </Box>

        {roomClosedError && (
          <Box className={classes.studentRoomClosed} role="alert">
            <Typography variant="body2">
              La sala todavía no está abierta. Pedile al docente que inicie la sesión antes de entrar.
            </Typography>
          </Box>
        )}

        <div className={classes.studentActions}>
          <Button
            variant="contained"
            color="primary"
            className={classes.studentPrimaryButton}
            fullWidth
            disabled={!canContinueStudent || isCheckingRoom}
            onClick={onContinueToDeviceSelection}
            startIcon={isCheckingRoom ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isCheckingRoom ? 'Verificando sala…' : 'Unirme a la sala'}
          </Button>
          <Button variant="text" className={classes.studentBackButton} onClick={() => onSelectRole('teacher')}>
            Volver a crear sesión
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Typography variant="h5" className={classes.gutterBottom}>
        Crear sesión de clase
      </Typography>
      <Typography variant="body1">
        Configura la sesión docente y, una vez creada, comparte el código o link con estudiantes.
      </Typography>
      <div className={classes.inputContainer}>
        {!hasUsername && (
          <div className={classes.textFieldContainer}>
            <InputLabel shrink htmlFor="input-user-name">
              Tu nombre
            </InputLabel>
            <TextField
              id="input-user-name"
              variant="outlined"
              fullWidth
              size="small"
              value={name}
              onChange={handleNameChange}
            />
          </div>
        )}
        <div className={classes.textFieldContainer}>
          <InputLabel shrink htmlFor="input-session-name">
            Nombre de la sesión
          </InputLabel>
          <TextField
            id="input-session-name"
            variant="outlined"
            fullWidth
            size="small"
            value={classSessionDraft.sessionName}
            onChange={handleSessionNameChange}
          />
        </div>
      </div>
      <Box mb={2}>
        <FormControl component="fieldset" fullWidth>
          <Box className={classes.controlCard}>
            <div className={classes.controlHeader}>
              <div className={classes.controlMeta}>
                <FormLabel component="legend">¿Grabar sesión?</FormLabel>
                <Typography variant="body2" className={classes.helperText}>
                  Activa la grabación automática de la clase.
                </Typography>
              </div>
              <div className={classes.switchRow}>
                <button
                  type="button"
                  className={classes.recordingToggleButton}
                  role="switch"
                  aria-checked={Boolean(classSessionDraft.recordingEnabled)}
                  aria-label="Grabar sesión"
                  data-testid="recording-toggle"
                  onClick={() =>
                    handleRecordingChange({} as ChangeEvent<HTMLInputElement>, !classSessionDraft.recordingEnabled)
                  }
                >
                  <span
                    className={`${classes.recordingToggleKnob} ${
                      classSessionDraft.recordingEnabled
                        ? classes.recordingToggleKnobOn
                        : classes.recordingToggleKnobOff
                    }`}
                  />
                </button>
                <Typography variant="body2" className={classes.switchState}>
                  {classSessionDraft.recordingEnabled ? 'Activo' : 'Inactivo'}
                </Typography>
              </div>
            </div>
          </Box>
        </FormControl>
      </Box>
      <Box mb={3}>
        <FormControl component="fieldset" fullWidth>
          <Box className={classes.controlCard}>
            <div className={classes.controlMeta}>
              <div className={classes.controlHeader}>
                <FormLabel component="legend">Sensibilidad de monitoreo</FormLabel>
                <Typography variant="body2">
                  {classSessionDraft.monitoringSensitivity === 'low'
                    ? 'Baja'
                    : classSessionDraft.monitoringSensitivity === 'high'
                    ? 'Alta'
                    : 'Media'}
                </Typography>
              </div>
              <Typography variant="body2" className={classes.helperText}>
                Ajusta el umbral de alertas de monitoreo.
              </Typography>
            </div>
            <div className={classes.sensitivitySliderBlock}>
              <div className={classes.sensitivitySliderRow}>
                <span className={classes.sliderEndLabel}>Baja</span>
                <div className={classes.sliderTrack} data-testid="sensitivity-track">
                  <div className={classes.sliderFill} style={{ width: `${sensitivityValue}%` }} />
                  <div className={classes.sliderThumb} style={{ left: `${sensitivityValue}%` }} />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={50}
                    value={sensitivityValue}
                    className={classes.nativeRangeInput}
                    aria-label="Sensibilidad de monitoreo"
                    data-testid="sensitivity-range"
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      handleSensitivityChange(event, Number(event.target.value))
                    }
                  />
                </div>
                <span className={classes.sliderEndLabel}>Alta</span>
              </div>
              <Typography className={classes.sensitivityStateLabel}>
                {classSessionDraft.monitoringSensitivity === 'low'
                  ? 'Baja'
                  : classSessionDraft.monitoringSensitivity === 'high'
                  ? 'Alta'
                  : 'Media'}
              </Typography>
            </div>
          </Box>
        </FormControl>
      </Box>
      <Grid container justifyContent="flex-end">
        <Button
          variant="contained"
          color="primary"
          onClick={onCreateClassSession}
          disabled={!canCreateTeacherSession || Boolean(classSessionAccess)}
        >
          {classSessionAccess ? 'Sesión creada' : 'Crear sesión'}
        </Button>
      </Grid>
      {!classSessionAccess && (
        <Grid container justifyContent="flex-end" style={{ marginTop: 12 }}>
          <Button variant="text" color="default" onClick={() => onSelectRole('student')}>
            Unirse como estudiante
          </Button>
        </Grid>
      )}

      {classSessionAccess && (
        <Box className={classes.createdCard} mt={3} mb={2}>
          <div className={classes.createdHeader}>
            <CheckCircleIcon className={classes.createdHeaderIcon} fontSize="small" />
            <Typography variant="subtitle1" className={classes.createdTitle}>
              Sesión creada
            </Typography>
          </div>
          <Typography variant="body2" className={classes.createdHint}>
            Compartí el código o el link con tus estudiantes. La sala queda abierta cuando entres a verificación.
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
              <Typography variant="body2">{classSessionAccess.joinCode}</Typography>
            </div>
            <Button
              size="small"
              startIcon={<FileCopyOutlinedIcon fontSize="small" />}
              onClick={() => handleCopy(classSessionAccess.joinCode)}
            >
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>

          <Grid container justifyContent="flex-end" style={{ marginTop: 16 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={onContinueToDeviceSelection}
              className={classes.continueButton}
            >
              Continuar a verificación
            </Button>
          </Grid>
        </Box>
      )}
    </>
  );
}
