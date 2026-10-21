import React, { PropsWithChildren } from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import Divider from '@material-ui/core/Divider';
import { useTranslation } from 'react-i18next';
import packageJSON from '../../../package.json';

import Video from 'twilio-video';
import { useAppState } from '../../state';

interface AboutDialogProps {
  open: boolean;
  onClose(): void;
}

function AboutDialog({ open, onClose }: PropsWithChildren<AboutDialogProps>) {
  const { roomType } = useAppState();
  const { t } = useTranslation('misc');
  return (
    <Dialog open={open} onClose={onClose} fullWidth={true} maxWidth="xs">
      <DialogTitle>{t('about.title')}</DialogTitle>
      <Divider />
      <DialogContent>
        <DialogContentText>
          {t('about.supportedBrowser')}: {String(Video.isSupported)}
        </DialogContentText>
        <DialogContentText>
          {t('about.sdkVersion')}: {Video.version}
        </DialogContentText>
        <DialogContentText>
          {t('about.appVersion')}: {packageJSON.version}
        </DialogContentText>
        <DialogContentText>
          {t('about.deployedTag')}: {process.env.REACT_APP_GIT_TAG || 'N/A'}
        </DialogContentText>
        <DialogContentText>
          {t('about.deployedCommit')}: {process.env.REACT_APP_GIT_COMMIT || 'N/A'}
        </DialogContentText>
        {roomType && (
          <DialogContentText>
            {t('about.roomType')}: {roomType}
          </DialogContentText>
        )}
      </DialogContent>
      <Divider />
      <DialogActions>
        <Button onClick={onClose} color="primary" variant="contained" autoFocus>
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AboutDialog;
