import React from 'react';
import { useTranslation } from 'react-i18next';
import es from '../../../i18n/locales/completeControls.es';
import { FormControl, MenuItem, Typography, Select } from '@material-ui/core';
import { useAppState } from '../../../state';
import useDevices from '../../../hooks/useDevices/useDevices';

export default function AudioOutputList() {
  const { t } = useTranslation('completeControls');
  const { audioOutputDevices } = useDevices();
  const { activeSinkId, setActiveSinkId } = useAppState();
  const activeOutputLabel = audioOutputDevices.find(device => device.deviceId === activeSinkId)?.label;

  return (
    <div className="inputSelect">
      {audioOutputDevices.length > 1 ? (
        <FormControl fullWidth>
          <Typography variant="subtitle2" gutterBottom>
            {t('audioOutput', es.audioOutput)}
          </Typography>
          <Select
            inputProps={{ 'aria-label': t('audioOutput', es.audioOutput) }}
            onChange={e => setActiveSinkId(e.target.value as string)}
            value={activeSinkId}
            variant="outlined"
          >
            {audioOutputDevices.map(device => (
              <MenuItem value={device.deviceId} key={device.deviceId}>
                {device.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : (
        <>
          <Typography variant="subtitle2">{t('audioOutput', es.audioOutput)}</Typography>
          <Typography>{activeOutputLabel || t('systemAudio', es.systemAudio)}</Typography>
        </>
      )}
    </div>
  );
}
