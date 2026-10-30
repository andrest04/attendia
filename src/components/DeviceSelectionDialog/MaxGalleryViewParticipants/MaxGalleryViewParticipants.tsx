import { FormControl, MenuItem, Typography, Select, Grid } from '@material-ui/core';
import { useAppState } from '../../../state';
import { useTranslation } from 'react-i18next';
import es from '../../../i18n/locales/completeControls.es';

const MAX_PARTICIPANT_OPTIONS = [6, 12, 24];

export default function MaxGalleryViewParticipants() {
  const { t } = useTranslation('completeControls');
  const { maxGalleryViewParticipants, setMaxGalleryViewParticipants } = useAppState();

  return (
    <div>
      <Typography variant="subtitle2" gutterBottom>
        {t('maxParticipants', es.maxParticipants)}
      </Typography>
      <Grid container alignItems="center" justifyContent="space-between">
        <div className="inputSelect">
          <FormControl fullWidth>
            <Select
              inputProps={{ 'aria-label': t('maxParticipants', es.maxParticipants) }}
              onChange={e => setMaxGalleryViewParticipants(parseInt(e.target.value as string))}
              value={maxGalleryViewParticipants}
              variant="outlined"
            >
              {MAX_PARTICIPANT_OPTIONS.map(option => (
                <MenuItem value={option} key={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
      </Grid>
    </div>
  );
}
