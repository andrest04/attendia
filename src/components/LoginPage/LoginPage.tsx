import React, { ChangeEvent, useState, FormEvent } from 'react';
import { useAppState } from '../../state';

import Button from '@material-ui/core/Button';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import { ReactComponent as GoogleLogo } from './google-logo.svg';
import { Theme } from '@material-ui/core';
import IntroContainer from '../IntroContainer/IntroContainer';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import MenuBookIcon from '@material-ui/icons/MenuBook';
import PersonIcon from '@material-ui/icons/Person';

import { makeStyles } from '@material-ui/core/styles';
import { useLocation, useHistory, Link } from 'react-router-dom';

type PreJoinRole = 'teacher' | 'student';

const useStyles = makeStyles((theme: Theme) => ({
  // Inner padded wrapper. IntroContainer's contentCard is a flush, overflow:hidden
  // shell — every other consumer (RoomNameScreen, DeviceSelectionScreen) wraps its
  // content in its own padded container. Without this, the role cards, inputs and
  // links sit flush against the card edges.
  formBody: {
    padding: 'clamp(24px, 3vh, 32px) clamp(24px, 3vw, 32px)',
  },
  // ── Role cards ──────────────────────────────────────────────────────────────
  roleCards: {
    display: 'flex',
    gap: 24,
    marginBottom: 28,
    [theme.breakpoints.down('xs')]: {
      flexDirection: 'column',
    },
  },
  roleCard: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    borderRadius: 12,
    border: '1.5px solid #e2ecf9',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    '&:hover': {
      borderColor: '#1d6eed',
    },
  },
  roleCardSelected: {
    borderColor: '#1d6eed',
    boxShadow: '0 0 0 2px rgba(29,110,237,0.15)',
  },
  roleAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  roleAvatarProfesor: {
    backgroundColor: '#e3edfb',
  },
  roleAvatarEstudiante: {
    backgroundColor: '#fff8e1',
  },
  roleLabel: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontSize: 14,
    fontWeight: 600,
    color: '#1d2f6f',
    lineHeight: 1.2,
  },
  roleCaption: {
    fontFamily: 'Inter, sans-serif',
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  roleHint: {
    display: 'block',
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400,
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: '18px',
    marginBottom: 24,
  },

  // ── Auth form elements ───────────────────────────────────────────────────────
  formTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: 19,
    color: '#1d2f6f',
    lineHeight: '25.65px',
    margin: 0,
  },
  formSubtitle: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 400,
    fontSize: 12,
    color: '#64748b',
    lineHeight: '18px',
    marginTop: 4,
    marginBottom: 20,
  },
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
  },
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
      padding: '12.5px 15.5px',
    },
  },
  googleButton: {
    width: '100%',
    height: 49,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    border: '1.5px solid #e2ecf9',
    color: '#1d2f6f',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: 14,
    textTransform: 'none',
    boxShadow: 'none',
    marginTop: 4,
    '&:hover': {
      backgroundColor: '#f8faff',
      borderColor: '#1d6eed',
      boxShadow: 'none',
    },
  },
  errorMessage: {
    display: 'flex',
    alignItems: 'center',
    fontFamily: 'Inter, sans-serif',
    fontSize: 12,
    color: '#d32f2f',
    margin: '8px 0 0',
    '& svg': {
      fontSize: 16,
      marginRight: 6,
    },
  },
  primaryButton: {
    width: '100%',
    height: 49,
    borderRadius: 12,
    marginTop: 20,
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
  securityLink: {
    display: 'block',
    marginTop: '2em',
    textAlign: 'right',
    fontFamily: 'Inter, sans-serif',
    fontSize: 11,
    color: '#94a3b8',
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
}));

export default function LoginPage() {
  const classes = useStyles();
  const { signIn, user, isAuthReady } = useAppState();
  const history = useHistory();
  const location = useLocation<{ from: Location }>();
  const [passcode, setPasscode] = useState('');
  const [authError, setAuthError] = useState<Error | null>(null);
  const [selectedRole, setSelectedRole] = useState<PreJoinRole>('teacher');

  const isAuthEnabled = Boolean(process.env.REACT_APP_SET_AUTH);

  const login = () => {
    setAuthError(null);
    signIn?.(passcode)
      .then(() => {
        const from = location?.state?.from as
          | { pathname?: string; search?: string; hash?: string; state?: any }
          | undefined;

        if (from) {
          history.replace({
            ...from,
            state: {
              ...(from.state || {}),
              preJoinRole: selectedRole,
            },
          });
          return;
        }

        history.replace({ pathname: '/', state: { preJoinRole: selectedRole } });
      })
      .catch(err => setAuthError(err));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    login();
  };

  if (user || !isAuthEnabled) {
    history.replace('/');
  }

  if (!isAuthReady) {
    return null;
  }

  return (
    <IntroContainer>
      <div className={classes.formBody}>
        <div className={classes.roleCards}>
          <div
            data-testid="role-card-profesor"
            className={`${classes.roleCard} ${selectedRole === 'teacher' ? classes.roleCardSelected : ''}`}
            onClick={() => setSelectedRole('teacher')}
            role="button"
            tabIndex={0}
            aria-pressed={selectedRole === 'teacher'}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedRole('teacher');
              }
            }}
          >
            <div className={`${classes.roleAvatar} ${classes.roleAvatarProfesor}`}>
              <MenuBookIcon style={{ fontSize: 18, color: '#1d6eed' }} />
            </div>
            <div>
              <div className={classes.roleLabel}>Profesor</div>
              <div className={classes.roleCaption}>Crear nueva sala de clase</div>
            </div>
          </div>

          <div
            data-testid="role-card-estudiante"
            className={`${classes.roleCard} ${selectedRole === 'student' ? classes.roleCardSelected : ''}`}
            onClick={() => setSelectedRole('student')}
            role="button"
            tabIndex={0}
            aria-pressed={selectedRole === 'student'}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedRole('student');
              }
            }}
          >
            <div className={`${classes.roleAvatar} ${classes.roleAvatarEstudiante}`}>
              <PersonIcon style={{ fontSize: 18, color: '#d97706' }} />
            </div>
            <div>
              <div className={classes.roleLabel}>Estudiante</div>
              <div className={classes.roleCaption}>Unirme a sala existente</div>
            </div>
          </div>
        </div>
        <Typography variant="caption" className={classes.roleHint}>
          Elige tu rol para iniciar el flujo correspondiente.
        </Typography>

        {process.env.REACT_APP_SET_AUTH === 'firebase' && (
          <>
            <Typography variant="h5" className={classes.formTitle}>
              Iniciar sesión para unirte
            </Typography>
            <Typography className={classes.formSubtitle}>Inicia sesión con tu cuenta Google de Twilio.</Typography>
            <Button variant="contained" className={classes.googleButton} onClick={login} startIcon={<GoogleLogo />}>
              Iniciar sesión con Google
            </Button>
          </>
        )}

        {process.env.REACT_APP_SET_AUTH === 'passcode' && (
          <>
            <Typography variant="h5" className={classes.formTitle}>
              Ingresa el código de acceso
            </Typography>
            <Typography className={classes.formSubtitle}>
              Usa el código que recibiste para acceder a la plataforma.
            </Typography>
            <form onSubmit={handleSubmit}>
              <label htmlFor="input-passcode" className={classes.fieldLabel}>
                Código de acceso
              </label>
              <TextField
                id="input-passcode"
                fullWidth
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPasscode(e.target.value)}
                type="password"
                variant="outlined"
                className={classes.textInput}
              />
              {authError && (
                <Typography variant="caption" className={classes.errorMessage}>
                  <ErrorOutlineIcon />
                  {authError.message}
                </Typography>
              )}
              <Button variant="contained" type="submit" disabled={!passcode.length} className={classes.primaryButton}>
                Ingresar
              </Button>
            </form>
          </>
        )}

        <Link to="/security" className={classes.securityLink}>
          Seguridad y Privacidad
        </Link>
      </div>
    </IntroContainer>
  );
}
