import React, { ChangeEvent, useEffect, useRef, useState, FormEvent } from 'react';
import { useAppState } from '../../state';

import Button from '@material-ui/core/Button';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import { ReactComponent as GoogleLogo } from './google-logo.svg';
import { Theme } from '@material-ui/core';
import IntroContainer from '../IntroContainer/IntroContainer';
import { routes, videoAppPaths } from '../../routes';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import MenuBookIcon from '@material-ui/icons/MenuBook';
import PersonIcon from '@material-ui/icons/Person';

import { makeStyles } from '@material-ui/core/styles';
import { useLocation, useHistory, Link } from 'react-router-dom';
import { t } from '../../i18n/translate';

type PreJoinRole = 'teacher' | 'student';

const SELF_REGISTER_ROLE_OPTIONS: { role: PreJoinRole; label: string; caption: string; testId: string }[] = [
  {
    role: 'teacher',
    label: 'Soy profesor',
    caption: 'Crear y dar clases',
    testId: 'role-option-profesor',
  },
  {
    role: 'student',
    label: 'Soy estudiante',
    caption: 'Unirme a clases existentes',
    testId: 'role-option-estudiante',
  },
];

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
  signedInAs: {
    fontFamily: 'Inter, sans-serif',
    fontSize: 13,
    color: '#64748b',
    marginBottom: 20,
  },
  signedInAsEmail: {
    fontWeight: 600,
    color: '#1d2f6f',
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
  fieldBlock: {
    marginBottom: 16,
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
  completionCancelButton: {
    display: 'flex',
    minHeight: 36,
    margin: '12px auto 0',
    padding: '6px 12px',
    borderRadius: 8,
    color: '#64748b',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: 12,
    textTransform: 'none',
    '&:hover': {
      backgroundColor: '#f1f5fb',
      color: '#1d2f6f',
    },
    '&.Mui-focusVisible': {
      outline: '2px solid #1d6eed',
      outlineOffset: 2,
    },
  },
  // ── Divider between the email form and the Google button ─────────────────────
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    margin: '20px 0 16px',
    '&::before, &::after': {
      content: '""',
      flex: 1,
      height: 1.5,
      backgroundColor: '#e2ecf9',
    },
  },
  dividerText: {
    fontFamily: 'Inter, sans-serif',
    fontSize: 12,
    color: '#94a3b8',
  },
  // ── Login/register view switch link ──────────────────────────────────────────
  switchRow: {
    marginTop: 24,
    textAlign: 'center',
    fontFamily: 'Inter, sans-serif',
    fontSize: 12,
    color: '#64748b',
  },
  switchLink: {
    background: 'none',
    border: 'none',
    padding: 0,
    marginLeft: 4,
    color: '#1d6eed',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: 12,
    cursor: 'pointer',
    textDecoration: 'underline',
    '&:hover': {
      color: '#1040a0',
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

// Friendly Spanish messages by Firebase auth error code. Anything unknown (including
// profile-endpoint failures) falls back to a generic Spanish message.
const INVALID_CREDENTIALS_MESSAGE = 'Correo o contraseña incorrectos. Revisa tus datos e intenta de nuevo.';
const FIREBASE_AUTH_ERROR_MESSAGES: { [code: string]: string } = {
  'auth/invalid-credential': INVALID_CREDENTIALS_MESSAGE,
  'auth/wrong-password': INVALID_CREDENTIALS_MESSAGE,
  'auth/user-not-found': INVALID_CREDENTIALS_MESSAGE,
  'auth/email-already-in-use': 'Ya existe una cuenta con este correo. Inicia sesión para continuar.',
  'auth/weak-password': 'La contraseña es demasiado débil. Usa al menos 6 caracteres.',
  'auth/invalid-email': 'El correo electrónico no es válido.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e intenta de nuevo.',
};
const GENERIC_AUTH_ERROR_MESSAGE = 'No pudimos completar la operación. Intenta de nuevo en unos segundos.';

export function getFirebaseAuthErrorMessage(error: any): string {
  const code: unknown = error?.code;
  const spanish = (typeof code === 'string' && FIREBASE_AUTH_ERROR_MESSAGES[code]) || GENERIC_AUTH_ERROR_MESSAGE;
  return t(spanish);
}

/** A labelled outlined text input, the field every auth form is made of. */
function AuthField({
  id,
  label,
  value,
  onChange,
  type,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const classes = useStyles();
  return (
    <div className={classes.fieldBlock}>
      <label htmlFor={id} className={classes.fieldLabel}>
        {label}
      </label>
      <TextField
        id={id}
        fullWidth
        type={type}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        variant="outlined"
        className={classes.textInput}
      />
    </div>
  );
}

/** The failure of the last auth action, under the fields it came from. */
function AuthErrorMessage({ error }: { error: Error | null }) {
  const classes = useStyles();
  if (!error) return null;
  return (
    <Typography variant="caption" className={classes.errorMessage}>
      <ErrorOutlineIcon />
      {error.message}
    </Typography>
  );
}

function RoleSelector({ value, onChange }: { value: PreJoinRole; onChange: (role: PreJoinRole) => void }) {
  const classes = useStyles();

  return (
    <div className={classes.roleCards} style={{ marginBottom: 16 }}>
      {SELF_REGISTER_ROLE_OPTIONS.map(option => (
        <div
          key={option.role}
          data-testid={option.testId}
          className={`${classes.roleCard} ${value === option.role ? classes.roleCardSelected : ''}`}
          onClick={() => onChange(option.role)}
          role="button"
          tabIndex={0}
          aria-pressed={value === option.role}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onChange(option.role);
            }
          }}
        >
          <div
            className={`${classes.roleAvatar} ${
              option.role === 'teacher' ? classes.roleAvatarProfesor : classes.roleAvatarEstudiante
            }`}
          >
            {option.role === 'teacher' ? (
              <MenuBookIcon style={{ fontSize: 18, color: '#1d6eed' }} />
            ) : (
              <PersonIcon style={{ fontSize: 18, color: '#d97706' }} />
            )}
          </div>
          <div>
            <div className={classes.roleLabel}>{t(option.label)}</div>
            <div className={classes.roleCaption}>{t(option.caption)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LoginPage() {
  const classes = useStyles();
  const { signIn, signInWithEmail, register, completeProfile, signOut, user, profile, isAuthReady } = useAppState();
  const history = useHistory();
  const location = useLocation<{ from: Location }>();
  const [authError, setAuthError] = useState<Error | null>(null);

  // Firebase-mode form state.
  const [view, setView] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [registerRole, setRegisterRole] = useState<PreJoinRole>('student');
  const [completionRole, setCompletionRole] = useState<PreJoinRole>('student');
  const [hasExitedCompletion, setHasExitedCompletion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    []
  );

  const runFirebaseAction = (action: Promise<void> | undefined, onSuccess?: () => void) => {
    setAuthError(null);
    setIsSubmitting(true);
    (action || Promise.resolve())
      .then(() => onSuccess?.())
      .catch(err => {
        if (isMountedRef.current) setAuthError(new Error(getFirebaseAuthErrorMessage(err)));
      })
      .finally(() => {
        if (isMountedRef.current) setIsSubmitting(false);
      });
  };

  const handleEmailLogin = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    runFirebaseAction(signInWithEmail?.(email, password));
  };

  const handleRegister = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    runFirebaseAction(register?.(fullName, email, password, registerRole));
  };

  const handleGoogleSignIn = () => {
    runFirebaseAction(signIn?.());
  };

  const handleCompleteProfile = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    runFirebaseAction(completeProfile?.(completionRole));
  };

  const handleAbandonCompletion = () => {
    if (signOut) {
      runFirebaseAction(signOut(), () => setHasExitedCompletion(true));
    }
  };

  const switchView = (nextView: 'login' | 'register') => {
    setAuthError(null);
    setView(nextView);
  };

  // The redirect waits for the profile: an authenticated user without one must
  // stay here to complete the role step first. The prejoin resolves the role
  // from the verified profile. Runs as an effect (not during render) so it
  // doesn't trigger a state update while LoginPage itself is still rendering.
  // A role-dependent landing screen (lobby, dashboard tab, profile) in `from` is left over from
  // the PREVIOUS session's sign-out, so it is not replayed: '/' resolves the right screen for
  // whoever just signed in (a student must not land on the teacher's dashboard).
  useEffect(() => {
    if (user && profile) {
      const from = location?.state?.from;
      const isLandingScreen = !from || videoAppPaths.indexOf(from.pathname) !== -1;
      history.replace(isLandingScreen ? routes.home : from);
    }
  }, [user, profile, location, history]);

  if (!isAuthReady) {
    return null;
  }

  // First-time Google users arrive authenticated but without a profile: only the
  // role is missing, so show the completion step instead of the auth forms.
  const showCompletionStep = Boolean(user) && !profile && !hasExitedCompletion;

  // Role currently highlighted on screen — drives IntroContainer's page tint
  // (blue for teacher, amber for student). The login view has no role cards, so
  // it keeps the default teacher palette.
  const activeRole: PreJoinRole = showCompletionStep ? completionRole : view === 'register' ? registerRole : 'teacher';

  // The form shown for each step of the sign-in flow.
  const step: 'completion' | 'login' | 'register' = showCompletionStep ? 'completion' : view;
  const stepViews: { [S in typeof step]: () => React.ReactNode } = {
    completion: () => (
      <>
        <Typography variant="h5" className={classes.formTitle}>
          {t('¿Cómo vas a usar Attendia?')}
        </Typography>
        <Typography className={classes.formSubtitle}>
          {t('Selecciona tu rol para terminar de configurar tu cuenta.')}
        </Typography>
        <Typography className={classes.signedInAs}>
          {t('Conectado como')} <span className={classes.signedInAsEmail}>{user?.displayName || user?.email}</span>
        </Typography>
        <form onSubmit={handleCompleteProfile}>
          <RoleSelector value={completionRole} onChange={setCompletionRole} />
          <AuthErrorMessage error={authError} />
          <Button variant="contained" type="submit" disabled={isSubmitting} className={classes.primaryButton}>
            {t('Confirmar y continuar')}
          </Button>
          <Button
            type="button"
            onClick={handleAbandonCompletion}
            disabled={isSubmitting}
            className={classes.completionCancelButton}
            aria-label={t('Cancelar la configuración y cerrar sesión')}
          >
            {t('Cancelar y cerrar sesión')}
          </Button>
        </form>
      </>
    ),
    login: () => (
      <>
        <Typography variant="h5" className={classes.formTitle}>
          {t('Iniciar sesión')}
        </Typography>
        <Typography className={classes.formSubtitle}>{t('Accede con tu cuenta para entrar a tus clases.')}</Typography>
        <form onSubmit={handleEmailLogin}>
          <AuthField id="input-email" label={t('Correo electrónico')} type="email" value={email} onChange={setEmail} />
          <AuthField
            id="input-password"
            label={t('Contraseña')}
            type="password"
            value={password}
            onChange={setPassword}
          />
          <AuthErrorMessage error={authError} />
          <Button
            variant="contained"
            type="submit"
            disabled={!email.length || !password.length || isSubmitting}
            className={classes.primaryButton}
          >
            {t('Iniciar sesión')}
          </Button>
        </form>
        <div className={classes.divider}>
          <span className={classes.dividerText}>{t('o')}</span>
        </div>
        <Button
          variant="contained"
          className={classes.googleButton}
          onClick={handleGoogleSignIn}
          disabled={isSubmitting}
          startIcon={<GoogleLogo />}
        >
          {t('Continuar con Google')}
        </Button>
        <div className={classes.switchRow}>
          {t('¿No tienes cuenta?')}
          <button type="button" className={classes.switchLink} onClick={() => switchView('register')}>
            {t('Crear cuenta')}
          </button>
        </div>
      </>
    ),
    register: () => (
      <>
        <Typography variant="h5" className={classes.formTitle}>
          {t('Crear cuenta')}
        </Typography>
        <Typography className={classes.formSubtitle}>
          {t('Regístrate para crear o unirte a clases en Attendia.')}
        </Typography>
        <form onSubmit={handleRegister}>
          <AuthField id="input-name" label={t('Nombre completo')} value={fullName} onChange={setFullName} />
          <AuthField
            id="input-register-email"
            label={t('Correo electrónico')}
            type="email"
            value={email}
            onChange={setEmail}
          />
          <AuthField
            id="input-register-password"
            label={t('Contraseña')}
            type="password"
            value={password}
            onChange={setPassword}
          />
          <RoleSelector value={registerRole} onChange={setRegisterRole} />
          <AuthErrorMessage error={authError} />
          <Button
            variant="contained"
            type="submit"
            disabled={!fullName.trim().length || !email.length || !password.length || isSubmitting}
            className={classes.primaryButton}
          >
            {t('Crear cuenta')}
          </Button>
        </form>
        <div className={classes.switchRow}>
          {t('¿Ya tienes cuenta?')}
          <button type="button" className={classes.switchLink} onClick={() => switchView('login')}>
            {t('Iniciar sesión')}
          </button>
        </div>
      </>
    ),
  };

  return (
    <IntroContainer homeRole={activeRole}>
      <div className={classes.formBody}>
        {stepViews[step]()}

        <Link to={routes.security} className={classes.securityLink}>
          {t('Seguridad y Privacidad')}
        </Link>
      </div>
    </IntroContainer>
  );
}
