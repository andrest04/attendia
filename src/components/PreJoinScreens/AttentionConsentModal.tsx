import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  makeStyles,
  Theme,
} from '@material-ui/core';
import SecurityIcon from '@material-ui/icons/Security';
import { t } from '../../i18n/translate';

const useStyles = makeStyles((theme: Theme) => ({
  title: {
    fontFamily: 'Poppins, sans-serif',
    fontWeight: 700,
    fontSize: 18,
    color: '#1d2f6f',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  infoBox: {
    backgroundColor: '#ebf3ff',
    border: '1.5px solid rgba(29,110,237,0.18)',
    borderRadius: 10,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  infoBoxTitle: {
    fontFamily: 'Poppins, sans-serif',
    fontWeight: 700,
    fontSize: 13,
    color: '#1d2f6f',
  },
  bodyText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: '1.6',
    margin: 0,
  },
  list: {
    margin: '6px 0 0 0',
    paddingLeft: 20,
    fontSize: 13,
    color: '#475569',
    lineHeight: '1.7',
  },
  privacyLink: {
    fontFamily: 'Poppins, sans-serif',
    fontWeight: 600,
    fontSize: 13,
    color: '#1d6eed',
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  alternativeNote: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
    lineHeight: '1.5',
  },
  actions: {
    padding: '12px 24px 20px',
    display: 'flex',
    gap: 8,
    flexDirection: 'column-reverse',
    [theme.breakpoints.up('sm')]: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
  },
  acceptButton: {
    background: 'linear-gradient(168.73deg, #1d6eed 0%, #1557c8 100%)',
    color: '#ffffff',
    fontFamily: 'Poppins, sans-serif',
    fontWeight: 700,
    fontSize: 14,
    borderRadius: 10,
    padding: '10px 24px',
    boxShadow: '0px 4px 8px rgba(29,110,237,0.3)',
    '&:hover': {
      opacity: 0.92,
      background: 'linear-gradient(168.73deg, #1d6eed 0%, #1557c8 100%)',
    },
  },
}));

interface AttentionConsentModalProps {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export default function AttentionConsentModal({ open, onAccept, onDecline }: AttentionConsentModalProps) {
  const classes = useStyles();

  // The consent modal is a hard gate: students must explicitly accept or go back.
  // Swallow backdrop clicks instead of using the deprecated `disableBackdropClick`
  // prop (escape is still blocked via `disableEscapeKeyDown`).
  const handleClose = (_event: object, reason: 'backdropClick' | 'escapeKeyDown') => {
    if (reason === 'backdropClick') return;
  };

  return (
    <Dialog open={open} maxWidth="sm" fullWidth onClose={handleClose} disableEscapeKeyDown>
      <DialogTitle disableTypography>
        <span className={classes.title}>
          <SecurityIcon style={{ fontSize: 20, color: '#1d6eed', flexShrink: 0 }} />
          {t('Análisis de atención en clase')}
        </span>
      </DialogTitle>

      <DialogContent className={classes.content}>
        <Typography className={classes.bodyText}>
          {t(
            'Esta sesión utiliza análisis de atención basado en visión por computadora. Antes de unirte, necesitamos tu'
          )}
          {t('consentimiento explícito.')}
        </Typography>

        <div className={classes.infoBox}>
          <span className={classes.infoBoxTitle}>{t('¿Qué analiza el sistema?')}</span>
          <ul className={classes.list}>
            <li>{t('Detección de mirada (ojos) y orientación de la cabeza')}</li>
            <li>{t('Generación de un índice numérico de atención (0–100)')}</li>
          </ul>
        </div>

        <div className={classes.infoBox}>
          <span className={classes.infoBoxTitle}>{t('¿Cómo se protegen tus datos?')}</span>
          <ul className={classes.list}>
            <li>{t('Todo el procesamiento ocurre en tu dispositivo')}</li>
            <li>{t('Ninguna imagen ni video sale de tu equipo')}</li>
            <li>{t('Solo se transmiten índices numéricos de atención al docente')}</li>
            <li>{t('Los datos son para uso pedagógico exclusivamente')}</li>
          </ul>
        </div>

        <Typography className={classes.bodyText}>
          {t('Puedes consultar nuestra')}{' '}
          <a href="/security" className={classes.privacyLink} target="_blank" rel="noopener noreferrer">
            {t('Política de privacidad →')}
          </a>
        </Typography>

        <Typography className={classes.alternativeNote}>
          {t(
            'Si prefieres no participar en el análisis automatizado, existe una alternativa presencial. Consulta a tu'
          )}
          {t('docente antes de unirte.')}
        </Typography>
      </DialogContent>

      <DialogActions className={classes.actions}>
        <Button variant="outlined" color="primary" onClick={onDecline} data-cy-consent-decline>
          Volver
        </Button>
        <Button className={classes.acceptButton} onClick={onAccept} data-cy-consent-accept>
          Aceptar y unirme
        </Button>
      </DialogActions>
    </Dialog>
  );
}
