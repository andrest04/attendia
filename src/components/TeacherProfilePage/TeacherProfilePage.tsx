import React, { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import {
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import PersonIcon from '@material-ui/icons/Person';
import { Link, Redirect } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useAppState } from '../../state';
import { getProfessorInitials, resolveProfilePhotoURL } from '../../utils/professorIdentity/professorIdentity';
import DashboardHeader from '../TeacherDashboard/DashboardHeader';
import AvatarCropModal from './AvatarCropModal';
import { t } from '../../i18n/translate';

const MAX_INPUT_AVATAR_BYTES = 2 * 1024 * 1024;

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
  },
  page: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: theme.spacing(4),
    backgroundColor: '#f6f9fd',
    [theme.breakpoints.down('sm')]: { padding: theme.spacing(3) },
  },
  container: { maxWidth: 1280, margin: '0 auto' },
  header: { marginBottom: theme.spacing(3) },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing(3),
    gridAutoRows: 'minmax(220px, auto)',
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  },
  panel: {
    minHeight: 220,
    height: '100%',
    boxSizing: 'border-box',
    padding: theme.spacing(3),
    display: 'grid',
    gap: theme.spacing(3),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
  },
  section: { display: 'grid', gap: theme.spacing(2) },
  avatarRow: { display: 'flex', alignItems: 'center', gap: theme.spacing(2), flexWrap: 'wrap' },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarPhoto: {
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  },
  button: { whiteSpace: 'nowrap' },
  studentRoomEntry: {
    marginTop: theme.spacing(2),
    backgroundColor: '#d97706',
    color: '#ffffff',
    '&:hover': { backgroundColor: '#b45309' },
  },
}));

// Any raster format the browser can decode into an <img> and draw to canvas works here —
// the crop step always re-encodes to JPEG (see avatarCropUtils), so the input format
// never reaches the server. SVG is excluded (vector, not a photo, and taints the canvas).
const ALLOWED_AVATAR_INPUT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];

function validateAvatarFile(file: File) {
  if (!ALLOWED_AVATAR_INPUT_MIME_TYPES.includes(file.type) || file.size > MAX_INPUT_AVATAR_BYTES) {
    throw new Error(t('Elige una imagen JPEG, PNG, WebP, GIF o BMP de hasta 2 MB.'));
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(t('No pudimos leer la imagen.')));
    reader.readAsDataURL(file);
  });
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

function errorMessage(error: any) {
  if (error?.code === 'auth/requires-recent-login') return t('Confirmar identidad e intentar nuevamente.');
  if (error?.code === 'auth/email-already-in-use') return t('Ese correo ya está vinculado a otra cuenta.');
  if (error?.code === 'auth/invalid-email') return t('Ese correo no es válido.');
  return error?.message || t('No pudimos completar el cambio. Intenta de nuevo.');
}

export default function TeacherProfilePage() {
  const classes = useStyles();
  const {
    user,
    profile,
    updateTeacherProfile,
    uploadAvatar,
    deleteAvatar,
    restoreProviderPhoto,
    changeEmail,
    changePassword,
    signOut,
  } = useAppState();
  const firebaseUser = user && 'email' in user ? user : null;
  const [name, setName] = useState(profile?.displayName || firebaseUser?.displayName || '');
  const [email, setEmail] = useState(firebaseUser?.email || profile?.email || '');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(profile?.avatarUrl);
  const [avatarRemoved, setAvatarRemoved] = useState<boolean>(Boolean(profile?.avatarRemoved));
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [savingAction, setSavingAction] = useState<
    'name' | 'email' | 'password' | 'avatar' | 'deleteAvatar' | 'restorePhoto' | null
  >(null);
  const isSaving = savingAction !== null;
  const [isEmailConfirmOpen, setIsEmailConfirmOpen] = useState(false);
  const [nameSubmitted, setNameSubmitted] = useState(false);
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [passwordSubmitted, setPasswordSubmitted] = useState(false);
  const [hasLinkedPassword, setHasLinkedPassword] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const hasPasswordProvider =
    hasLinkedPassword || Boolean(firebaseUser?.providerData.some(provider => provider.providerId === 'password'));

  useEffect(() => setName(profile?.displayName || firebaseUser?.displayName || ''), [
    profile?.displayName,
    firebaseUser?.displayName,
  ]);
  useEffect(() => setEmail(firebaseUser?.email || profile?.email || ''), [profile?.email, firebaseUser?.email]);
  useEffect(() => setAvatarUrl(profile?.avatarUrl), [profile?.avatarUrl]);
  useEffect(() => setAvatarRemoved(Boolean(profile?.avatarRemoved)), [profile?.avatarRemoved]);

  if (!firebaseUser || (profile?.role !== 'teacher' && profile?.role !== 'student')) return <Redirect to="/" />;

  const run = async (
    action: 'name' | 'email' | 'password' | 'avatar' | 'deleteAvatar' | 'restorePhoto',
    work: () => Promise<void>
  ) => {
    setSavingAction(action);
    try {
      await work();
    } catch (error) {
      enqueueSnackbar(errorMessage(error), { variant: 'error' });
    } finally {
      setSavingAction(null);
    }
  };

  const originalName = profile?.displayName || firebaseUser?.displayName || '';
  const isNameEmpty = !name.trim();
  const isNameUnchanged = name.trim() === originalName.trim();

  const saveName = (event: FormEvent) => {
    event.preventDefault();
    setNameSubmitted(true);
    if (isNameEmpty || isNameUnchanged) return;
    run('name', async () => {
      await updateTeacherProfile!({ displayName: name.trim() });
      enqueueSnackbar(t('Nombre actualizado.'), { variant: 'success' });
    });
  };

  const selectAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file after cancelling the crop
    if (!file) return;
    try {
      validateAvatarFile(file);
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : t('No pudimos validar la imagen. Intenta de nuevo.'), {
        variant: 'error',
      });
      return;
    }
    readFileAsDataUrl(file)
      .then(setCropImageSrc)
      .catch((error: Error) => enqueueSnackbar(error.message, { variant: 'error' }));
  };

  const cancelCrop = () => setCropImageSrc(null);

  const confirmCrop = (blob: Blob) => {
    setCropImageSrc(null);
    const compressedFile = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
    run('avatar', async () => {
      const updatedProfile = await uploadAvatar!(compressedFile);
      setAvatarUrl(updatedProfile.avatarUrl);
      setAvatarRemoved(Boolean(updatedProfile.avatarRemoved));
      enqueueSnackbar('Foto actualizada.', { variant: 'success' });
    });
  };

  const isEmailUnchanged = email.trim().toLowerCase() === (firebaseUser.email || '').trim().toLowerCase();
  const isEmailEmpty = !email.trim();
  const isEmailInvalid = !isEmailEmpty && !isValidEmail(email);
  const isEmailChangeLocked = !hasPasswordProvider;
  const isCurrentPasswordEmptyForEmail = hasPasswordProvider && !emailCurrentPassword;

  const saveEmail = (event: FormEvent) => {
    event.preventDefault();
    setEmailSubmitted(true);
    if (isEmailChangeLocked || isEmailUnchanged || isEmailEmpty || isEmailInvalid || isCurrentPasswordEmptyForEmail)
      return;
    setIsEmailConfirmOpen(true);
  };

  const confirmSaveEmail = () => {
    if (isEmailChangeLocked) return;
    setIsEmailConfirmOpen(false);
    return run('email', async () => {
      await changeEmail!(email, emailCurrentPassword || undefined);
      setEmailCurrentPassword('');
      enqueueSnackbar(t('Correo actualizado.'), { variant: 'success' });
    });
  };

  const isCurrentPasswordEmptyForPassword = hasPasswordProvider && !currentPassword;
  const isNewPasswordEmpty = !newPassword;
  const isNewPasswordInvalid = newPassword.length < 8;

  const savePassword = (event: FormEvent) => {
    event.preventDefault();
    setPasswordSubmitted(true);
    if (isCurrentPasswordEmptyForPassword || isNewPasswordInvalid) return;
    run('password', async () => {
      await changePassword!(currentPassword || undefined, newPassword);
      if (!hasPasswordProvider) setHasLinkedPassword(true);
      setCurrentPassword('');
      setNewPassword('');
      enqueueSnackbar(
        hasPasswordProvider ? t('Contraseña actualizada.') : t('Contraseña creada y vinculada a tu cuenta.'),
        {
          variant: 'success',
        }
      );
    });
  };

  const photo = resolveProfilePhotoURL(avatarUrl, avatarRemoved, firebaseUser.photoURL);
  const profileName = profile.displayName || firebaseUser.displayName || '';
  return (
    <div className={classes.root} data-testid="profile-page-shell">
      {profile.role === 'student' && (
        <DashboardHeader
          professorName={profileName}
          professorInitials={getProfessorInitials(profileName)}
          professorPhotoURL={photo}
          identityColor="student"
          showNotifications={false}
          extraMenuItems={
            <MenuItem onClick={() => signOut?.()} data-testid="student-profile-header-sign-out">
              {t('Cerrar sesión')}
            </MenuItem>
          }
        />
      )}
      <main className={classes.page} data-testid="teacher-profile-page">
        <Container maxWidth={false} className={classes.container}>
          <div className={classes.header}>
            <Typography variant="h4">Perfil {profile.role === 'student' ? t('estudiante') : t('docente')}</Typography>
            <Typography color="textSecondary">Administra tu identidad y acceso.</Typography>
            {profile.role === 'student' && (
              <Button
                className={classes.studentRoomEntry}
                component={Link}
                to={{ pathname: '/', state: { preJoinRole: 'student' } }}
                variant="contained"
                data-testid="student-room-entry"
              >
                Volver a ingresar a una sala
              </Button>
            )}
          </div>
          <div className={classes.layout} data-testid="teacher-profile-layout">
            <Paper className={classes.panel} elevation={0} data-testid="teacher-profile-photo">
              <section className={classes.section} aria-labelledby="photo-heading">
                <Typography id="photo-heading" variant="h6">
                  Foto
                </Typography>
                <div className={classes.avatarRow}>
                  <span
                    className={photo ? `${classes.avatar} ${classes.avatarPhoto}` : classes.avatar}
                    style={photo ? { backgroundImage: `url(${photo})` } : undefined}
                    data-testid="teacher-profile-avatar"
                  >
                    {!photo && <PersonIcon style={{ fontSize: 40 }} />}
                  </span>
                  <Button className={classes.button} component="label" variant="outlined" disabled={isSaving}>
                    {savingAction === 'avatar' ? <CircularProgress size={18} color="inherit" /> : 'Cambiar foto'}
                    <input
                      hidden
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
                      onChange={selectAvatar}
                      data-testid="profile-avatar-input"
                    />
                  </Button>
                  {photo ? (
                    <Button
                      className={classes.button}
                      disabled={isSaving}
                      onClick={() =>
                        run('deleteAvatar', async () => {
                          const updatedProfile = await deleteAvatar!();
                          setAvatarUrl(updatedProfile.avatarUrl);
                          setAvatarRemoved(Boolean(updatedProfile.avatarRemoved));
                          enqueueSnackbar('Foto eliminada.', { variant: 'success' });
                        })
                      }
                    >
                      {savingAction === 'deleteAvatar' ? (
                        <CircularProgress size={18} color="inherit" />
                      ) : (
                        t('Eliminar foto')
                      )}
                    </Button>
                  ) : (
                    avatarRemoved &&
                    firebaseUser.photoURL && (
                      <Button
                        className={classes.button}
                        disabled={isSaving}
                        onClick={() =>
                          run('restorePhoto', async () => {
                            const updatedProfile = await restoreProviderPhoto!();
                            setAvatarUrl(updatedProfile.avatarUrl);
                            setAvatarRemoved(Boolean(updatedProfile.avatarRemoved));
                            enqueueSnackbar('Foto restaurada.', { variant: 'success' });
                          })
                        }
                      >
                        {savingAction === 'restorePhoto' ? (
                          <CircularProgress size={18} color="inherit" />
                        ) : (
                          'Usar foto de Google'
                        )}
                      </Button>
                    )
                  )}
                </div>
              </section>
            </Paper>
            <Paper className={classes.panel} elevation={0} data-testid="teacher-profile-name">
              <form className={classes.section} onSubmit={saveName} noValidate>
                <Typography variant="h6">Nombre</Typography>
                <TextField
                  label={t('Nombre')}
                  value={name}
                  onChange={event => setName(event.target.value)}
                  required
                  inputProps={{ maxLength: 100 }}
                  error={nameSubmitted && isNameEmpty}
                  helperText={nameSubmitted && isNameEmpty ? t('Ingresa un nombre.') : ' '}
                />
                <Button
                  className={classes.button}
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={isSaving || isNameEmpty || isNameUnchanged}
                >
                  {savingAction === 'name' ? <CircularProgress size={18} color="inherit" /> : t('Guardar nombre')}
                </Button>
              </form>
            </Paper>
            <Paper className={classes.panel} elevation={0} data-testid="teacher-profile-email">
              <form className={classes.section} onSubmit={saveEmail} noValidate>
                <Typography variant="h6">Correo</Typography>
                <TextField
                  label={t('Nuevo correo')}
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  required
                  disabled={isEmailChangeLocked}
                  inputProps={{ 'aria-describedby': isEmailChangeLocked ? 'email-password-setup-hint' : undefined }}
                  error={(emailSubmitted && isEmailEmpty) || isEmailInvalid}
                  helperText={
                    isEmailChangeLocked
                      ? t('Crea una contraseña para habilitar el cambio de correo.')
                      : emailSubmitted && isEmailEmpty
                      ? t('Ingresa un correo.')
                      : isEmailInvalid
                      ? t('El formato del correo no es válido.')
                      : ' '
                  }
                />
                {isEmailChangeLocked && (
                  <Typography id="email-password-setup-hint" color="textSecondary" aria-live="polite">
                    {t('Tu cuenta usa Google. Primero crea una contraseña para cambiar el correo.')}
                  </Typography>
                )}
                {hasPasswordProvider && (
                  <TextField
                    label={t('Contraseña actual')}
                    type="password"
                    value={emailCurrentPassword}
                    onChange={event => setEmailCurrentPassword(event.target.value)}
                    required
                    error={emailSubmitted && isCurrentPasswordEmptyForEmail}
                    helperText={
                      emailSubmitted && isCurrentPasswordEmptyForEmail ? t('Ingresa tu contraseña actual.') : ' '
                    }
                  />
                )}
                <Button
                  className={classes.button}
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={
                    isSaving ||
                    isEmailChangeLocked ||
                    isEmailUnchanged ||
                    isEmailInvalid ||
                    isCurrentPasswordEmptyForEmail
                  }
                >
                  {savingAction === 'email' ? <CircularProgress size={18} color="inherit" /> : t('Guardar correo')}
                </Button>
              </form>
            </Paper>
            <Paper className={classes.panel} elevation={0} data-testid="teacher-profile-password">
              <form className={classes.section} onSubmit={savePassword} noValidate>
                <Typography variant="h6">{hasPasswordProvider ? t('Contraseña') : t('Crear contraseña')}</Typography>
                {hasPasswordProvider && (
                  <TextField
                    label={t('Contraseña actual')}
                    type="password"
                    value={currentPassword}
                    onChange={event => setCurrentPassword(event.target.value)}
                    required
                    error={passwordSubmitted && isCurrentPasswordEmptyForPassword}
                    helperText={
                      passwordSubmitted && isCurrentPasswordEmptyForPassword ? t('Ingresa tu contraseña actual.') : ' '
                    }
                  />
                )}
                <TextField
                  label={t('Nueva contraseña')}
                  type="password"
                  value={newPassword}
                  onChange={event => setNewPassword(event.target.value)}
                  required
                  inputProps={{ minLength: 8 }}
                  error={passwordSubmitted && isNewPasswordInvalid}
                  helperText={
                    passwordSubmitted && isNewPasswordInvalid
                      ? t('La nueva contraseña debe tener al menos 8 caracteres.')
                      : ' '
                  }
                />
                <Button
                  className={classes.button}
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={isSaving || isNewPasswordEmpty || isCurrentPasswordEmptyForPassword}
                >
                  {savingAction === 'password' ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : hasPasswordProvider ? (
                    t('Actualizar contraseña')
                  ) : (
                    t('Crear contraseña')
                  )}
                </Button>
              </form>
            </Paper>
          </div>
          <Dialog
            open={isEmailConfirmOpen}
            onClose={() => setIsEmailConfirmOpen(false)}
            data-testid="email-confirm-dialog"
          >
            <DialogTitle>{t('¿Confirmar el cambio de correo?')}</DialogTitle>
            <DialogContent>
              <DialogContentText>Nuevo correo:</DialogContentText>
              <DialogContentText>
                <strong>{email}</strong>
              </DialogContentText>
              <DialogContentText>
                {t(
                  'Se actualizará de inmediato, sin un paso de verificación previo. Este correo se utilizará para iniciar'
                )}
                {t('sesión a partir de ahora.')}
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setIsEmailConfirmOpen(false)} data-testid="email-confirm-cancel">
                Cancelar
              </Button>
              <Button onClick={confirmSaveEmail} color="primary" variant="contained" data-testid="email-confirm-accept">
                Confirmar
              </Button>
            </DialogActions>
          </Dialog>
          <AvatarCropModal
            imageSrc={cropImageSrc}
            isSaving={isSaving}
            onCancel={cancelCrop}
            onConfirm={confirmCrop}
            onError={message => enqueueSnackbar(message, { variant: 'error' })}
          />
        </Container>
      </main>
    </div>
  );
}
