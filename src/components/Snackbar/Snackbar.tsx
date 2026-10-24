import React from 'react';
import clsx from 'clsx';
import CloseIcon from '@material-ui/icons/Close';
import ErrorIcon from '../../icons/ErrorIcon';
import { IconButton, makeStyles, Theme, Typography } from '@material-ui/core';
import MUISnackbar from '@material-ui/core/Snackbar';
import WarningIcon from '../../icons/WarningIcon';
import InfoIcon from '../../icons/InfoIcon';
import { t } from '../../i18n/translate';

type SnackbarVariant = 'error' | 'warning' | 'info';

interface SnackbarProps {
  headline: string;
  message: string | React.ReactNode;
  variant?: SnackbarVariant;
  open: boolean;
  handleClose?: () => void;
}

const useStyles = makeStyles((theme: Theme) => ({
  container: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '400px',
    minHeight: '50px',
    background: 'white',
    padding: '1em',
    borderRadius: '3px',
    boxShadow: '0 12px 24px 4px rgba(40,42,43,0.2)',
    [theme.breakpoints.down('sm')]: {
      width: '100%',
    },
  },
  contentContainer: {
    display: 'flex',
    lineHeight: 1.8,
  },
  iconContainer: {
    display: 'flex',
    padding: '0 1.3em 0 0.3em',
    transform: 'translateY(3px)',
  },
  headline: {
    fontWeight: 'bold',
  },
  error: {
    borderLeft: '4px solid #D61F1F',
  },
  warning: {
    borderLeft: '4px solid #E46216',
  },
  info: {
    borderLeft: '4px solid #0263e0',
  },
}));

// The icon of each variant; its colored left border is the class of the same name.
const VARIANT_ICON: Record<SnackbarVariant, React.ComponentType> = {
  error: ErrorIcon,
  warning: WarningIcon,
  info: InfoIcon,
};

export default function Snackbar({ headline, message, variant, open, handleClose }: SnackbarProps) {
  const classes = useStyles();
  const VariantIcon = variant && VARIANT_ICON[variant];

  const handleOnClose = (_: React.SyntheticEvent | React.MouseEvent, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }

    handleClose?.();
  };

  return (
    <MUISnackbar
      anchorOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      open={open}
      onClose={handleOnClose}
      autoHideDuration={10000}
    >
      <div className={clsx(classes.container, variant && classes[variant])}>
        <div className={classes.contentContainer}>
          <div className={classes.iconContainer}>{VariantIcon && <VariantIcon />}</div>
          <div>
            <Typography variant="body1" className={classes.headline} component="span">
              {headline}
            </Typography>
            <Typography variant="body1" component="span">
              {' '}
              {message}
            </Typography>
          </div>
        </div>
        <div>
          {handleClose && (
            <IconButton size="small" aria-label={t('Cerrar')} color="inherit" onClick={handleClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </div>
      </div>
    </MUISnackbar>
  );
}
