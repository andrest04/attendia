import React, { useCallback, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Slider, Typography } from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { AvatarCropError, cropToBudgetedBlob } from './avatarCropUtils';

const useStyles = makeStyles((theme: Theme) => ({
  cropArea: {
    position: 'relative',
    width: '100%',
    height: 320,
    backgroundColor: '#333',
  },
  zoomRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
}));

interface Props {
  imageSrc: string | null;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
  onError: (error: AvatarCropError | { message: string } | { translationKey: 'crop.failed' }) => void;
}

export default function AvatarCropModal({ imageSrc, isSaving, onCancel, onConfirm, onError }: Props) {
  const classes = useStyles();
  const { t } = useTranslation('teacherProfile');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  const handleCropComplete = useCallback((_croppedArea: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setIsCropping(true);
    try {
      const blob = await cropToBudgetedBlob(imageSrc, croppedAreaPixels, t);
      onConfirm(blob);
    } catch (error: any) {
      onError(error instanceof AvatarCropError ? error : { translationKey: 'crop.failed' });
    } finally {
      setIsCropping(false);
    }
  };

  return (
    <Dialog open={Boolean(imageSrc)} onClose={onCancel} maxWidth="xs" fullWidth data-testid="avatar-crop-dialog" aria-labelledby="avatar-crop-title">
      <DialogTitle id="avatar-crop-title">{t('crop.title')}</DialogTitle>
      <DialogContent>
        <div className={classes.cropArea}>
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
            />
          )}
        </div>
        <div className={classes.zoomRow}>
          <Typography id="avatar-crop-zoom-label" variant="body2">{t('crop.zoom')}</Typography>
          <Slider
            aria-labelledby="avatar-crop-zoom-label"
            value={zoom}
            min={1}
            max={3}
            step={0.05}
            onChange={(_event, value) => setZoom(value as number)}
            data-testid="avatar-zoom-slider"
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isSaving || isCropping} data-testid="avatar-crop-cancel">
          {t('crop.cancel')}
        </Button>
        <Button
          onClick={handleConfirm}
          color="primary"
          variant="contained"
          disabled={isSaving || isCropping || !croppedAreaPixels}
          data-testid="avatar-crop-confirm"
        >
          {t('crop.done')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
