import React from 'react';
import { IconButton } from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import { SnackbarKey, useSnackbar } from 'notistack';

export default function SnackbarCloseButton({ snackbarKey }: { snackbarKey: SnackbarKey }) {
  const { closeSnackbar } = useSnackbar();

  return (
    <IconButton
      size="small"
      aria-label="Cerrar notificación"
      onClick={() => closeSnackbar(snackbarKey)}
      data-testid="snackbar-close-button"
    >
      <CloseIcon fontSize="small" htmlColor="#fff" />
    </IconButton>
  );
}
