import React, { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  makeStyles,
  TextField,
  Typography,
} from '@material-ui/core';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import { useAppState } from '../../../state';
import { t } from '../../../i18n/translate';

const MIN_PASSWORD_LENGTH = 6;
const weakPasswordMessage = () =>
  t('La contraseña es demasiado débil. Usa al menos {{count}} caracteres.', { count: MIN_PASSWORD_LENGTH });

const useStyles = makeStyles({
  fieldBlock: {
    marginBottom: '1em',
  },
  fieldLabel: {
    display: 'block',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 500,
    fontSize: 13,
    color: '#1d2f6f',
    marginBottom: '0.4em',
  },
  errorMessage: {
    display: 'flex',
    alignItems: 'center',
    color: '#d32f2f',
    fontSize: 12,
    marginBottom: '0.5em',
    '& svg': {
      fontSize: 16,
      marginRight: '0.3em',
    },
  },
});

// Maps Firebase credential-linking error codes to friendly Spanish messages.
// Follows the same local-mapping pattern as LoginPage's getFirebaseAuthErrorMessage.
function getCreatePasswordErrorMessage(error: any): string {
  switch (error?.code) {
    case 'auth/weak-password':
      return weakPasswordMessage();
    case 'auth/requires-recent-login':
      return t('Por seguridad, cierra sesión y vuelve a entrar con Google antes de crear tu contraseña.');
    case 'auth/provider-already-linked':
    case 'auth/credential-already-in-use':
    case 'auth/email-already-in-use':
      return t('Esta cuenta ya tiene una contraseña configurada. Inicia sesión con tu correo y contraseña.');
    default:
      return t('No se pudo crear la contraseña. Intenta de nuevo.');
  }
}

interface CreatePasswordDialogProps {
  open: boolean;
  onClose(): void;
}

export default function CreatePasswordDialog({ open, onClose }: CreatePasswordDialogProps) {
  const classes = useStyles();
  const { createPassword } = useAppState();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Reset every local state on open/close so a reopened dialog starts clean.
  useEffect(() => {
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setIsSubmitting(false);
    setIsSuccess(false);
  }, [open]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(weakPasswordMessage());
      return;
    }

    if (password !== confirmPassword) {
      setError(t('Las contraseñas no coinciden.'));
      return;
    }

    setIsSubmitting(true);
    createPassword?.(password)
      .then(() => {
        setIsSuccess(true);
      })
      .catch(err => {
        setError(getCreatePasswordErrorMessage(err));
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('Crear contraseña')}</DialogTitle>
      {isSuccess ? (
        <>
          <DialogContent>
            <Typography variant="body1">
              {t('Contraseña creada. Ya puedes iniciar sesión con tu correo y contraseña.')}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} color="primary" variant="contained">
              {t('Entendido')}
            </Button>
          </DialogActions>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <div className={classes.fieldBlock}>
              <label htmlFor="input-new-password" className={classes.fieldLabel}>
                {t('Contraseña nueva')}
              </label>
              <TextField
                id="input-new-password"
                fullWidth
                type="password"
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                variant="outlined"
              />
            </div>
            <div className={classes.fieldBlock}>
              <label htmlFor="input-confirm-password" className={classes.fieldLabel}>
                {t('Confirmar contraseña')}
              </label>
              <TextField
                id="input-confirm-password"
                fullWidth
                type="password"
                value={confirmPassword}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                variant="outlined"
              />
            </div>
            {error && (
              <Typography variant="caption" className={classes.errorMessage}>
                <ErrorOutlineIcon />
                {error}
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={isSubmitting}>
              {t('Cancelar')}
            </Button>
            <Button
              type="submit"
              color="primary"
              variant="contained"
              disabled={!password.length || !confirmPassword.length || isSubmitting}
            >
              {t('Crear contraseña')}
            </Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  );
}
