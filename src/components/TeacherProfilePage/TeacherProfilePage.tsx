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
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import spanishTranslator from '../../i18n/spanishTranslator';
import { useAppState } from '../../state';
import { getProfessorInitials, resolveProfilePhotoURL } from '../../utils/professorIdentity/professorIdentity';
import DashboardHeader from '../TeacherDashboard/DashboardHeader';
import AvatarCropModal from './AvatarCropModal';

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
    // Without this the single grid row stretches to the 220px minimum and spreads the card's
    // content apart (a big gap between the title and the avatar row).
    alignContent: 'start',
    gap: theme.spacing(3),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
  },
  section: { display: 'grid', alignContent: 'start', gap: theme.spacing(2) },
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
    // Neutral, not the brand blue: while the photo downloads the circle would otherwise read as
    // "no photo" (an empty blue disc), and a transparent photo would sit on the brand colour.
    backgroundColor: '#e2ecf9',
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

function validateAvatarFile(file: File, t: TFunction) {
  if (!ALLOWED_AVATAR_INPUT_MIME_TYPES.includes(file.type) || file.size > MAX_INPUT_AVATAR_BYTES) {
    throw new Error(t('teacherProfile:photo.invalidFile'));
  }
}

function readFileAsDataUrl(file: File, t: TFunction): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(t('teacherProfile:photo.readFailed')));
    reader.readAsDataURL(file);
  });
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

function errorMessage(error: any, t: TFunction = spanishTranslator) {
  if (error?.code === 'auth/requires-recent-login') return t('teacherProfile:errors.requiresRecentLogin');
  if (error?.code === 'auth/email-already-in-use') return t('teacherProfile:errors.emailInUse');
  if (error?.code === 'auth/invalid-email') return t('teacherProfile:errors.invalidEmail');
  return error?.message || t('teacherProfile:errors.generic');
}

export default function TeacherProfilePage() {
  const classes = useStyles();
  const { t } = useTranslation('teacherProfile');
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
      enqueueSnackbar(errorMessage(error, t), { variant: 'error' });
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
      enqueueSnackbar(t('name.updated'), { variant: 'success' });
    });
  };

  const selectAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file after cancelling the crop
    if (!file) return;
    try {
      validateAvatarFile(file, t);
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : t('photo.validationFailed'), {
        variant: 'error',
      });
      return;
    }
    readFileAsDataUrl(file, t)
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
      enqueueSnackbar(t('photo.updated'), { variant: 'success' });
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
      enqueueSnackbar(t('email.updated'), { variant: 'success' });
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
      enqueueSnackbar(hasPasswordProvider ? t('password.updated') : t('password.created'), {
        variant: 'success',
      });
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
          showLanguageSelector
          extraMenuItems={
            <MenuItem onClick={() => signOut?.()} data-testid="student-profile-header-sign-out">
              {t('signOut')}
            </MenuItem>
          }
        />
      )}
      <main className={classes.page} data-testid="teacher-profile-page">
        <Container maxWidth={false} className={classes.container}>
          <div className={classes.header}>
            <Typography variant="h4">{t('title', { context: profile.role })}</Typography>
            <Typography color="textSecondary">{t('subtitle')}</Typography>
            {profile.role === 'student' && (
              <Button
                className={classes.studentRoomEntry}
                component={Link}
                to={{ pathname: '/', state: { preJoinRole: 'student' } }}
                variant="contained"
                data-testid="student-room-entry"
              >
                {t('backToRoom')}
              </Button>
            )}
          </div>
          <div className={classes.layout} data-testid="teacher-profile-layout">
            <Paper className={classes.panel} elevation={0} data-testid="teacher-profile-photo">
              <section className={classes.section} aria-labelledby="photo-heading">
                <Typography id="photo-heading" variant="h6">
                  {t('photo.heading')}
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
                    {savingAction === 'avatar' ? <CircularProgress size={18} color="inherit" /> : t('photo.change')}
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
                          enqueueSnackbar(t('photo.deleted'), { variant: 'success' });
                        })
                      }
                    >
                      {savingAction === 'deleteAvatar' ? (
                        <CircularProgress size={18} color="inherit" />
                      ) : (
                        t('photo.delete')
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
                            enqueueSnackbar(t('photo.restored'), { variant: 'success' });
                          })
                        }
                      >
                        {savingAction === 'restorePhoto' ? (
                          <CircularProgress size={18} color="inherit" />
                        ) : (
                          t('photo.useGoogle')
                        )}
                      </Button>
                    )
                  )}
                </div>
              </section>
            </Paper>
            <Paper className={classes.panel} elevation={0} data-testid="teacher-profile-name">
              <form className={classes.section} onSubmit={saveName} noValidate>
                <Typography variant="h6">{t('name.heading')}</Typography>
                <TextField
                  label={t('name.label')}
                  value={name}
                  onChange={event => setName(event.target.value)}
                  required
                  inputProps={{ maxLength: 100 }}
                  error={nameSubmitted && isNameEmpty}
                  helperText={nameSubmitted && isNameEmpty ? t('name.required') : ' '}
                />
                <Button
                  className={classes.button}
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={isSaving || isNameEmpty || isNameUnchanged}
                >
                  {savingAction === 'name' ? <CircularProgress size={18} color="inherit" /> : t('name.save')}
                </Button>
              </form>
            </Paper>
            <Paper className={classes.panel} elevation={0} data-testid="teacher-profile-email">
              <form className={classes.section} onSubmit={saveEmail} noValidate>
                <Typography variant="h6">{t('email.heading')}</Typography>
                <TextField
                  label={t('email.label')}
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  required
                  disabled={isEmailChangeLocked}
                  inputProps={{ 'aria-describedby': isEmailChangeLocked ? 'email-password-setup-hint' : undefined }}
                  error={(emailSubmitted && isEmailEmpty) || isEmailInvalid}
                  helperText={
                    isEmailChangeLocked
                      ? t('email.lockedHelper')
                      : emailSubmitted && isEmailEmpty
                      ? t('email.required')
                      : isEmailInvalid
                      ? t('email.invalidFormat')
                      : ' '
                  }
                />
                {isEmailChangeLocked && (
                  <Typography id="email-password-setup-hint" color="textSecondary" aria-live="polite">
                    {t('email.googleHint')}
                  </Typography>
                )}
                {hasPasswordProvider && (
                  <TextField
                    label={t('password.current')}
                    type="password"
                    value={emailCurrentPassword}
                    onChange={event => setEmailCurrentPassword(event.target.value)}
                    required
                    error={emailSubmitted && isCurrentPasswordEmptyForEmail}
                    helperText={emailSubmitted && isCurrentPasswordEmptyForEmail ? t('password.currentRequired') : ' '}
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
                  {savingAction === 'email' ? <CircularProgress size={18} color="inherit" /> : t('email.save')}
                </Button>
              </form>
            </Paper>
            <Paper className={classes.panel} elevation={0} data-testid="teacher-profile-password">
              <form className={classes.section} onSubmit={savePassword} noValidate>
                <Typography variant="h6">
                  {hasPasswordProvider ? t('password.heading') : t('password.create')}
                </Typography>
                {hasPasswordProvider && (
                  <TextField
                    label={t('password.current')}
                    type="password"
                    value={currentPassword}
                    onChange={event => setCurrentPassword(event.target.value)}
                    required
                    error={passwordSubmitted && isCurrentPasswordEmptyForPassword}
                    helperText={
                      passwordSubmitted && isCurrentPasswordEmptyForPassword ? t('password.currentRequired') : ' '
                    }
                  />
                )}
                <TextField
                  label={t('password.new')}
                  type="password"
                  value={newPassword}
                  onChange={event => setNewPassword(event.target.value)}
                  required
                  inputProps={{ minLength: 8 }}
                  error={passwordSubmitted && isNewPasswordInvalid}
                  helperText={passwordSubmitted && isNewPasswordInvalid ? t('password.tooShort') : ' '}
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
                    t('password.update')
                  ) : (
                    t('password.create')
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
            <DialogTitle>{t('confirmEmail.title')}</DialogTitle>
            <DialogContent>
              <DialogContentText>{t('confirmEmail.newEmail')}</DialogContentText>
              <DialogContentText>
                <strong>{email}</strong>
              </DialogContentText>
              <DialogContentText>{t('confirmEmail.notice')}</DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setIsEmailConfirmOpen(false)} data-testid="email-confirm-cancel">
                {t('confirmEmail.cancel')}
              </Button>
              <Button onClick={confirmSaveEmail} color="primary" variant="contained" data-testid="email-confirm-accept">
                {t('confirmEmail.confirm')}
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
