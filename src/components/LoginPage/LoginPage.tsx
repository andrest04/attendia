import React, { ChangeEvent, useState, FormEvent } from 'react';
import { useAppState } from '../../state';

import Button from '@material-ui/core/Button';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import Grid from '@material-ui/core/Grid';
import { ReactComponent as GoogleLogo } from './google-logo.svg';
import { InputLabel, Theme } from '@material-ui/core';
import IntroContainer from '../IntroContainer/IntroContainer';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import MenuBookIcon from '@material-ui/icons/MenuBook';
import PersonIcon from '@material-ui/icons/Person';

import { makeStyles } from '@material-ui/core/styles';
import { useLocation, useHistory, Link } from 'react-router-dom';

type PreJoinRole = 'teacher' | 'student';

const useStyles = makeStyles((theme: Theme) => ({
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
    borderRadius: 8,
    border: '2px solid #E0E0E0',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    '&:hover': {
      borderColor: '#027AC5',
    },
  },
  roleCardSelected: {
    borderColor: '#027AC5',
    boxShadow: '0 0 0 2px rgba(2,122,197,0.15)',
  },
  roleAvatar: {
    width: 36,
    height: 36,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  roleAvatarProfesor: {
    backgroundColor: '#424242',
  },
  roleAvatarEstudiante: {
    backgroundColor: '#9E9E9E',
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: '#212121',
    lineHeight: 1.2,
  },
  roleCaption: {
    fontSize: 11,
    color: '#9E9E9E',
    marginTop: 2,
  },

  // ── Auth form elements ───────────────────────────────────────────────────────
  heading: {
    marginBottom: '0.5em',
  },
  subheading: {
    marginBottom: '1.2em',
    color: '#616161',
  },
  googleButton: {
    background: 'white',
    color: 'rgb(0, 94, 166)',
    borderRadius: '4px',
    border: '2px solid rgb(2, 122, 197)',
    margin: '1.2em 0 0.7em',
    textTransform: 'none',
    boxShadow: 'none',
    padding: '0.3em 1em',
    [theme.breakpoints.down('sm')]: {
      width: '100%',
    },
    '&:hover': {
      background: 'white',
      boxShadow: 'none',
    },
  },
  errorMessage: {
    color: 'red',
    display: 'flex',
    alignItems: 'center',
    margin: '1em 0 0.2em',
    '& svg': {
      marginRight: '0.4em',
    },
  },
  gutterBottom: {
    marginBottom: '1em',
  },
  passcodeContainer: {
    minHeight: '120px',
  },
  submitButton: {
    [theme.breakpoints.down('sm')]: {
      width: '100%',
    },
  },
  securityLink: {
    display: 'block',
    marginTop: '2em',
    textAlign: 'right',
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
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
            <MenuBookIcon style={{ fontSize: 18, color: '#FFFFFF' }} />
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
            <PersonIcon style={{ fontSize: 18, color: '#FFFFFF' }} />
          </div>
          <div>
            <div className={classes.roleLabel}>Estudiante</div>
            <div className={classes.roleCaption}>Unirme a sala existente</div>
          </div>
        </div>
      </div>
      <Typography variant="caption" className={classes.subheading}>
        Elige tu rol para iniciar el flujo correspondiente.
      </Typography>

      {process.env.REACT_APP_SET_AUTH === 'firebase' && (
        <>
          <Typography variant="h5" className={classes.heading}>
            Iniciar sesión para unirte
          </Typography>
          <Typography variant="body1" className={classes.subheading}>
            Inicia sesión con tu cuenta Google de Twilio
          </Typography>
          <Button variant="contained" className={classes.googleButton} onClick={login} startIcon={<GoogleLogo />}>
            Iniciar sesión con Google
          </Button>
        </>
      )}

      {process.env.REACT_APP_SET_AUTH === 'passcode' && (
        <>
          <Typography variant="h5" className={classes.heading}>
            Ingresa el código de acceso
          </Typography>
          <form onSubmit={handleSubmit}>
            <Grid container justifyContent="space-between">
              <div className={classes.passcodeContainer}>
                <InputLabel shrink htmlFor="input-passcode">
                  Código de acceso
                </InputLabel>
                <TextField
                  id="input-passcode"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPasscode(e.target.value)}
                  type="password"
                  variant="outlined"
                  size="small"
                />
                <div>
                  {authError && (
                    <Typography variant="caption" className={classes.errorMessage}>
                      <ErrorOutlineIcon />
                      {authError.message}
                    </Typography>
                  )}
                </div>
              </div>
            </Grid>
            <Grid container justifyContent="flex-end">
              <Button
                variant="contained"
                color="primary"
                type="submit"
                disabled={!passcode.length}
                className={classes.submitButton}
              >
                Ingresar
              </Button>
            </Grid>
          </form>
        </>
      )}

      <Link to="/security" className={classes.securityLink}>
        Seguridad y privacidad
      </Link>
    </IntroContainer>
  );
}
