import React, { useCallback, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Slider, Typography } from '@material-ui/core';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { cropToBudgetedBlob } from './avatarCropUtils';
import { t } from '../../i18n/translate';

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
  onError: (message: string) => void;
}

export default function AvatarCropModal({ imageSrc, isSaving, onCancel, onConfirm, onError }: Props) {
  const classes = useStyles();
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
      const blob = await cropToBudgetedBlob(imageSrc, croppedAreaPixels);
      onConfirm(blob);
    } catch (error) {
      onError(error?.message || t('No pudimos ajustar la imagen.'));
    } finally {
      setIsCropping(false);
    }
  };

  return (
    <Dialog open={Boolean(imageSrc)} onClose={onCancel} maxWidth="xs" fullWidth data-testid="avatar-crop-dialog">
      <DialogTitle>Ajustar foto</DialogTitle>
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
          <Typography variant="body2">Zoom</Typography>
          <Slider
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
          Cancelar
        </Button>
        <Button
          onClick={handleConfirm}
          color="primary"
          variant="contained"
          disabled={isSaving || isCropping || !croppedAreaPixels}
          data-testid="avatar-crop-confirm"
        >
          Listo
        </Button>
      </DialogActions>
    </Dialog>
  );
}
