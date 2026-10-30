import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import es from '../../i18n/locales/completeControls.es';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Theme,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { inputLabels, Settings } from '../../state/settings/settingsReducer';
import { useAppState } from '../../state';
import useRoomState from '../../hooks/useRoomState/useRoomState';

const useStyles = makeStyles((theme: Theme) => ({
  container: {
    width: '600px',
    minHeight: '400px',
    [theme.breakpoints.down('xs')]: {
      width: 'calc(100vw - 32px)',
    },
    '& .inputSelect': {
      width: 'calc(100% - 35px)',
    },
  },
  button: {
    float: 'right',
  },
  paper: {
    [theme.breakpoints.down('xs')]: {
      margin: '16px',
    },
  },
  formControl: {
    display: 'block',
    margin: '1.5em 0',
    '&:first-child': {
      margin: '0 0 1.5em 0',
    },
  },
  label: {
    width: '133%', // Labels have scale(0.75) applied to them, so this effectively makes the width 100%
  },
}));

let nextDialogId = 0;

const withDefault = (val?: string) => (typeof val === 'undefined' ? 'default' : val);

export default function ConnectionOptionsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const classes = useStyles();
  const [dialogId] = useState(() => `connection-options-${++nextDialogId}`);
  const { t } = useTranslation('completeControls');
  const text = (key: keyof typeof es) => t(key, es[key]);
  const { settings, dispatchSetting } = useAppState();
  const roomState = useRoomState();
  const isDisabled = roomState !== 'disconnected';

  const handleChange = useCallback(
    (e: React.ChangeEvent<{ value: unknown; name?: string }>) => {
      dispatchSetting({ name: e.target.name as keyof Settings, value: e.target.value as string });
    },
    [dispatchSetting]
  );

  const handleNumberChange = useCallback(
    (e: React.ChangeEvent<{ value: unknown; name?: string }>) => {
      if (!/[^\d]/.test(e.target.value as string)) handleChange(e);
    },
    [handleChange]
  );

  return (
    <Dialog open={open} onClose={onClose} classes={{ paper: classes.paper }}>
      <DialogTitle>{text('connectionTitle')}</DialogTitle>
      <Divider />
      <DialogContent className={classes.container}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography hidden={!isDisabled} variant="body2">
              {text('connectedNotice')}
            </Typography>
          </Grid>

          <Grid item sm={6} xs={12}>
            <FormControl className={classes.formControl}>
              <InputLabel id={`${dialogId}-dominant-label`}>{text('dominantPriority')}</InputLabel>
              <Select
                fullWidth
                disabled={isDisabled}
                name={inputLabels.dominantSpeakerPriority}
                label={inputLabels.dominantSpeakerPriority}
                labelId={`${dialogId}-dominant-label`}
                SelectDisplayProps={{ id: `${dialogId}-dominant` }}
                value={withDefault(settings.dominantSpeakerPriority)}
                onChange={handleChange}
              >
                <MenuItem value="low">{text('low')}</MenuItem>
                <MenuItem value="standard">{text('standard')}</MenuItem>
                <MenuItem value="high">{text('high')}</MenuItem>
                <MenuItem value="default">{text('serverDefault')}</MenuItem>
              </Select>
            </FormControl>

            <FormControl className={classes.formControl}>
              <InputLabel id={`${dialogId}-switch-label`}>{text('switchOffMode')}</InputLabel>
              <Select
                fullWidth
                disabled={isDisabled}
                name={inputLabels.trackSwitchOffMode}
                label={inputLabels.trackSwitchOffMode}
                labelId={`${dialogId}-switch-label`}
                SelectDisplayProps={{ id: `${dialogId}-switch` }}
                value={withDefault(settings.trackSwitchOffMode)}
                onChange={handleChange}
              >
                <MenuItem value="predicted">{text('predicted')}</MenuItem>
                <MenuItem value="detected">{text('detected')}</MenuItem>
                <MenuItem value="disabled">{text('disabled')}</MenuItem>
                <MenuItem value="default">{text('serverDefault')}</MenuItem>
              </Select>
            </FormControl>

            <FormControl className={classes.formControl}>
              <InputLabel id={`${dialogId}-mode-label`}>{text('mode')}</InputLabel>
              <Select
                fullWidth
                disabled={isDisabled}
                name={inputLabels.bandwidthProfileMode}
                label={inputLabels.bandwidthProfileMode}
                labelId={`${dialogId}-mode-label`}
                SelectDisplayProps={{ id: `${dialogId}-mode` }}
                value={withDefault(settings.bandwidthProfileMode)}
                onChange={handleChange}
              >
                <MenuItem value="grid">{text('grid')}</MenuItem>
                <MenuItem value="collaboration">{text('collaboration')}</MenuItem>
                <MenuItem value="presentation">{text('presentation')}</MenuItem>
                <MenuItem value="default">{text('serverDefault')}</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item sm={6} xs={12}>
            <FormControl className={classes.formControl}>
              <InputLabel id={`${dialogId}-client-label`}>{text('clientSwitchOff')}</InputLabel>
              <Select
                fullWidth
                disabled={isDisabled}
                name={inputLabels.clientTrackSwitchOffControl}
                label={inputLabels.clientTrackSwitchOffControl}
                labelId={`${dialogId}-client-label`}
                SelectDisplayProps={{ id: `${dialogId}-client` }}
                value={withDefault(settings.clientTrackSwitchOffControl)}
                onChange={handleChange}
              >
                <MenuItem value="auto">{text('auto')}</MenuItem>
                <MenuItem value="manual">{text('manual')}</MenuItem>
                <MenuItem value="default">{text('default')}</MenuItem>
              </Select>
            </FormControl>

            <FormControl className={classes.formControl}>
              <InputLabel id={`${dialogId}-content-label`}>{text('contentPreferences')}</InputLabel>
              <Select
                fullWidth
                disabled={isDisabled}
                name={inputLabels.contentPreferencesMode}
                label={inputLabels.contentPreferencesMode}
                labelId={`${dialogId}-content-label`}
                SelectDisplayProps={{ id: `${dialogId}-content` }}
                value={withDefault(settings.contentPreferencesMode)}
                onChange={handleChange}
              >
                <MenuItem value="auto">{text('auto')}</MenuItem>
                <MenuItem value="manual">{text('manual')}</MenuItem>
                <MenuItem value="default">{text('default')}</MenuItem>
              </Select>
            </FormControl>

            <FormControl className={classes.formControl}>
              <TextField
                disabled={isDisabled}
                fullWidth
                id={`${dialogId}-max-audio-bitrate`}
                label={text('maxAudioBitrate')}
                placeholder={text('noLimit')}
                name={inputLabels.maxAudioBitrate}
                value={withDefault(settings.maxAudioBitrate)}
                onChange={handleNumberChange}
              />
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <Divider />
      <DialogActions>
        <Button className={classes.button} color="primary" variant="contained" onClick={onClose}>
          {text('done')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
