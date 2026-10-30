import React from 'react';
import { useTranslation } from 'react-i18next';
import es from '../../i18n/locales/completeControls.es';
import { IconButton } from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import { SnackbarKey, useSnackbar } from 'notistack';

export default function SnackbarCloseButton({ snackbarKey }: { snackbarKey: SnackbarKey }) {
  const { closeSnackbar } = useSnackbar();
  const { t } = useTranslation('completeControls');

  return (
    <IconButton
      size="small"
      aria-label={t('closeNotification', es.closeNotification)}
      onClick={() => closeSnackbar(snackbarKey)}
      data-testid="snackbar-close-button"
    >
      <CloseIcon fontSize="small" htmlColor="#fff" />
    </IconButton>
  );
}
