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
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('prejoin');

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
          {t('consent.title')}
        </span>
      </DialogTitle>

      <DialogContent className={classes.content}>
        <Typography className={classes.bodyText}>{t('consent.intro')}</Typography>

        <div className={classes.infoBox}>
          <span className={classes.infoBoxTitle}>{t('consent.whatTitle')}</span>
          <ul className={classes.list}>
            <li>{t('consent.whatGaze')}</li>
            <li>{t('consent.whatIndex')}</li>
          </ul>
        </div>

        <div className={classes.infoBox}>
          <span className={classes.infoBoxTitle}>{t('consent.protectTitle')}</span>
          <ul className={classes.list}>
            <li>
              {t('consent.protectBefore')}
              <strong>{t('consent.protectStrong')}</strong>
              {t('consent.protectAfter')}
            </li>
            <li>{t('consent.protectNoImages')}</li>
            <li>{t('consent.protectOnlyIndices')}</li>
            <li>{t('consent.protectPedagogical')}</li>
          </ul>
        </div>

        <Typography className={classes.bodyText}>
          {t('consent.policyIntro')}{' '}
          <a href="/security" className={classes.privacyLink} target="_blank" rel="noopener noreferrer">
            {t('consent.policyLink')}
          </a>
        </Typography>

        <Typography className={classes.alternativeNote}>{t('consent.alternative')}</Typography>
      </DialogContent>

      <DialogActions className={classes.actions}>
        <Button variant="outlined" color="primary" onClick={onDecline} data-cy-consent-decline>
          {t('consent.back')}
        </Button>
        <Button className={classes.acceptButton} onClick={onAccept} data-cy-consent-accept>
          {t('consent.accept')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
