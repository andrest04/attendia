import React, { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import {
  Avatar,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  TextField,
  Typography,
} from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { Redirect } from 'react-router-dom';
import { useAppState } from '../../state';

const MAX_INPUT_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_AVATAR_DATA_URL_LENGTH = 90000;

const useStyles = makeStyles((theme: Theme) => ({
  page: { minHeight: '100%', padding: theme.spacing(4), backgroundColor: '#f6f9fd' },
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
  avatar: { width: 72, height: 72 },
  actions: { display: 'flex', gap: theme.spacing(1), flexWrap: 'wrap' },
  backLink: { padding: 0, minWidth: 'auto' },
  button: { whiteSpace: 'nowrap' },
  status: { minHeight: theme.spacing(3), color: theme.palette.text.secondary },
}));

async function compressAvatar(file: File): Promise<string> {
  if (!['image/jpeg', 'image/webp'].includes(file.type) || file.size > MAX_INPUT_AVATAR_BYTES) {
    throw new Error('Elige una imagen JPEG o WebP de hasta 2 MB.');
  }
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('No pudimos leer la imagen.'));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('La imagen no es válida.'));
    element.src = source;
  });
  const scale = Math.min(1, 256 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.82, 0.7, 0.58]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_AVATAR_DATA_URL_LENGTH) return dataUrl;
  }
  throw new Error('La imagen sigue siendo demasiado grande después de comprimirla.');
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

function errorMessage(error: any) {
  if (error?.code === 'auth/requires-recent-login') return 'Confirmar identidad e intentar nuevamente.';
  if (error?.code === 'auth/email-already-in-use') return 'Ese correo ya está vinculado a otra cuenta.';
  if (error?.code === 'auth/invalid-email') return 'Ese correo no es válido.';
  return error?.message || 'No pudimos completar el cambio. Intenta de nuevo.';
}

interface Props {
  onReturnToClasses?: () => void;
}

export default function TeacherProfilePage({ onReturnToClasses }: Props) {
  const classes = useStyles();
  const { user, profile, updateTeacherProfile, changeEmail, changePassword } = useAppState();
  const firebaseUser = user && 'email' in user ? user : null;
  const [name, setName] = useState(profile?.displayName || firebaseUser?.displayName || '');
  const [email, setEmail] = useState(firebaseUser?.email || profile?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null | undefined>(profile?.avatarDataUrl);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [isEmailConfirmOpen, setIsEmailConfirmOpen] = useState(false);
  const hasPasswordProvider = Boolean(firebaseUser?.providerData.some(provider => provider.providerId === 'password'));

  useEffect(() => setName(profile?.displayName || firebaseUser?.displayName || ''), [
    profile?.displayName,
    firebaseUser?.displayName,
  ]);
  useEffect(() => setEmail(firebaseUser?.email || profile?.email || ''), [profile?.email, firebaseUser?.email]);
  useEffect(() => setAvatarDataUrl(profile?.avatarDataUrl), [profile?.avatarDataUrl]);

  if (!firebaseUser || profile?.role !== 'teacher') return <Redirect to="/" />;

  const run = async (work: () => Promise<void>) => {
    setIsSaving(true);
    setStatus('');
    try {
      await work();
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const saveName = (event: FormEvent) => {
    event.preventDefault();
    run(async () => {
      await updateTeacherProfile!({ displayName: name.trim() });
      setStatus('Nombre actualizado.');
    });
  };

  const selectAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    run(async () => {
      const nextAvatar = await compressAvatar(file);
      await updateTeacherProfile!({ avatarDataUrl: nextAvatar });
      setAvatarDataUrl(nextAvatar);
      setStatus('Foto actualizada.');
    });
  };

  const isEmailUnchanged = email.trim().toLowerCase() === (firebaseUser.email || '').trim().toLowerCase();
  const isEmailInvalid = !isValidEmail(email);

  const saveEmail = (event: FormEvent) => {
    event.preventDefault();
    if (isEmailUnchanged || isEmailInvalid) return;
    setIsEmailConfirmOpen(true);
  };

  const confirmSaveEmail = () => {
    setIsEmailConfirmOpen(false);
    return run(async () => {
      await changeEmail!(email, currentPassword || undefined);
      setStatus('Correo actualizado.');
    });
  };

  const savePassword = (event: FormEvent) => {
    event.preventDefault();
    run(async () => {
      if (newPassword.length < 8) throw new Error('La nueva contraseña debe tener al menos 8 caracteres.');
      await changePassword!(currentPassword || undefined, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setStatus(hasPasswordProvider ? 'Contraseña actualizada.' : 'Contraseña creada y vinculada a tu cuenta.');
    });
  };

  const photo = avatarDataUrl || firebaseUser.photoURL || undefined;
  return (
    <main className={classes.page} data-testid="teacher-profile-page">
      <Container maxWidth={false} className={classes.container}>
        <div className={classes.header}>
          <div className={classes.actions}>
            <Button className={classes.backLink} onClick={onReturnToClasses}>
              Volver a Clases
            </Button>
          </div>
          <Typography variant="h4">Perfil docente</Typography>
          <Typography color="textSecondary">Administra tu identidad y acceso.</Typography>
        </div>
        <div className={classes.layout} data-testid="teacher-profile-layout">
          <Paper className={classes.panel} elevation={0} data-testid="teacher-profile-photo">
            <section className={classes.section} aria-labelledby="photo-heading">
              <Typography id="photo-heading" variant="h6">
                Foto
              </Typography>
              <div className={classes.avatarRow}>
                <Avatar className={classes.avatar} src={photo}>
                  {name.slice(0, 1).toUpperCase()}
                </Avatar>
                <Button className={classes.button} component="label" variant="outlined" disabled={isSaving}>
                  Cambiar foto
                  <input
                    hidden
                    type="file"
                    accept="image/jpeg,image/webp"
                    onChange={selectAvatar}
                    data-testid="profile-avatar-input"
                  />
                </Button>
                {avatarDataUrl && (
                  <Button
                    className={classes.button}
                    onClick={() =>
                      run(async () => {
                        await updateTeacherProfile!({ avatarDataUrl: null });
                        setAvatarDataUrl(null);
                        setStatus('Foto eliminada.');
                      })
                    }
                  >
                    Usar foto de Google
                  </Button>
                )}
              </div>
            </section>
          </Paper>
          <Paper className={classes.panel} elevation={0} data-testid="teacher-profile-name">
            <form className={classes.section} onSubmit={saveName}>
              <Typography variant="h6">Nombre</Typography>
              <TextField
                label="Nombre"
                value={name}
                onChange={event => setName(event.target.value)}
                required
                inputProps={{ maxLength: 100 }}
              />
              <Button className={classes.button} type="submit" variant="contained" color="primary" disabled={isSaving}>
                Guardar nombre
              </Button>
            </form>
          </Paper>
          <Paper className={classes.panel} elevation={0} data-testid="teacher-profile-email">
            <form className={classes.section} onSubmit={saveEmail}>
              <Typography variant="h6">Correo</Typography>
              <TextField
                label="Nuevo correo"
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
                error={isEmailInvalid}
                helperText={isEmailInvalid ? 'El formato del correo no es válido.' : ' '}
              />
              {hasPasswordProvider && (
                <TextField
                  label="Contraseña actual"
                  type="password"
                  value={currentPassword}
                  onChange={event => setCurrentPassword(event.target.value)}
                  required
                />
              )}
              <Button
                className={classes.button}
                type="submit"
                variant="contained"
                color="primary"
                disabled={isSaving || isEmailUnchanged || isEmailInvalid}
              >
                Guardar correo
              </Button>
            </form>
          </Paper>
          <Paper className={classes.panel} elevation={0} data-testid="teacher-profile-password">
            <form className={classes.section} onSubmit={savePassword}>
              <Typography variant="h6">{hasPasswordProvider ? 'Contraseña' : 'Crear contraseña'}</Typography>
              {hasPasswordProvider && (
                <TextField
                  label="Contraseña actual"
                  type="password"
                  value={currentPassword}
                  onChange={event => setCurrentPassword(event.target.value)}
                  required
                />
              )}
              <TextField
                label="Nueva contraseña"
                type="password"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                required
                inputProps={{ minLength: 8 }}
              />
              <Button className={classes.button} type="submit" variant="contained" color="primary" disabled={isSaving}>
                {hasPasswordProvider ? 'Actualizar contraseña' : 'Crear contraseña'}
              </Button>
            </form>
          </Paper>
        </div>
        <Typography component="div" className={classes.status} role="status">
          {isSaving ? <CircularProgress size={18} /> : status}
        </Typography>
        <Dialog
          open={isEmailConfirmOpen}
          onClose={() => setIsEmailConfirmOpen(false)}
          data-testid="email-confirm-dialog"
        >
          <DialogTitle>¿Confirmar el cambio de correo?</DialogTitle>
          <DialogContent>
            <DialogContentText>Nuevo correo:</DialogContentText>
            <DialogContentText>
              <strong>{email}</strong>
            </DialogContentText>
            <DialogContentText>
              Se actualizará de inmediato, sin un paso de verificación previo. Este correo se utilizará para iniciar
              sesión a partir de ahora.
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
      </Container>
    </main>
  );
}
