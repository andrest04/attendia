import React, { PropsWithChildren } from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContentText from '@material-ui/core/DialogContentText';
import enhanceMessage from './enhanceMessage';
import { t as translateSpanish } from '../../i18n/translate';
import { TwilioError } from 'twilio-video';
import { useTranslation } from 'react-i18next';

interface ErrorDialogProps {
  dismissError: Function;
  error: TwilioError | Error | null;
}

function ErrorDialog({ dismissError, error }: PropsWithChildren<ErrorDialogProps>) {
  const { t } = useTranslation('errors');
  const { message, code, name } = error || {};
  const enhancedMessage = enhanceMessage(message, code, name, t);

  return (
    <Dialog open={error !== null} onClose={() => dismissError()} fullWidth={true} maxWidth="xs">
      <DialogTitle>{t('dialog.title')}</DialogTitle>
      <DialogContent>
        <DialogContentText>{enhancedMessage}</DialogContentText>
        {Boolean(code) && (
          <pre>
            <code>{t('dialog.errorCode', { code })}</code>
          </pre>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => dismissError()} color="primary" autoFocus>
          {translateSpanish('Aceptar')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ErrorDialog;
