import React, { PropsWithChildren } from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import Divider from '@material-ui/core/Divider';
import packageJSON from '../../../package.json';

import Video from 'twilio-video';
import { useAppState } from '../../state';
import { t } from '../../i18n/translate';

interface AboutDialogProps {
  open: boolean;
  onClose(): void;
}

function AboutDialog({ open, onClose }: PropsWithChildren<AboutDialogProps>) {
  const { roomType } = useAppState();
  return (
    <Dialog open={open} onClose={onClose} fullWidth={true} maxWidth="xs">
      <DialogTitle>{t('Acerca de')}</DialogTitle>
      <Divider />
      <DialogContent>
        <DialogContentText>
          {t('Navegador compatible:')} {String(Video.isSupported)}
        </DialogContentText>
        <DialogContentText>
          {t('Versión del SDK:')} {Video.version}
        </DialogContentText>
        <DialogContentText>
          {t('Versión de la app:')} {packageJSON.version}
        </DialogContentText>
        <DialogContentText>
          {t('Tag desplegado:')} {process.env.REACT_APP_GIT_TAG || 'N/A'}
        </DialogContentText>
        <DialogContentText>
          {t('Hash del commit desplegado:')} {process.env.REACT_APP_GIT_COMMIT || 'N/A'}
        </DialogContentText>
        {roomType && (
          <DialogContentText>
            {t('Tipo de sala:')} {roomType}
          </DialogContentText>
        )}
      </DialogContent>
      <Divider />
      <DialogActions>
        <Button onClick={onClose} color="primary" variant="contained" autoFocus>
          {t('Aceptar')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AboutDialog;
