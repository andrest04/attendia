import React, { useCallback, useRef } from 'react';
import clsx from 'clsx';
import Button from '@material-ui/core/Button';
import VideoOffIcon from '../../../icons/VideoOffIcon';
import VideoOnIcon from '../../../icons/VideoOnIcon';
import { useToolbarButtonStyles } from '../toolbarButtonStyles';
import useDevices from '../../../hooks/useDevices/useDevices';
import useLocalVideoToggle from '../../../hooks/useLocalVideoToggle/useLocalVideoToggle';

export default function ToggleVideoButton(props: { disabled?: boolean; className?: string }) {
  const [isVideoEnabled, toggleVideoEnabled] = useLocalVideoToggle();
  const lastClickTimeRef = useRef(0);
  const { hasVideoInputDevices } = useDevices();
  const classes = useToolbarButtonStyles();

  const toggleVideo = useCallback(() => {
    if (Date.now() - lastClickTimeRef.current > 500) {
      lastClickTimeRef.current = Date.now();
      toggleVideoEnabled();
    }
  }, [toggleVideoEnabled]);

  return (
    <Button
      className={clsx(
        classes.toolbarButton,
        { [classes.toolbarButtonActive]: hasVideoInputDevices && isVideoEnabled },
        props.className
      )}
      onClick={toggleVideo}
      disabled={!hasVideoInputDevices || props.disabled}
      startIcon={isVideoEnabled ? <VideoOnIcon /> : <VideoOffIcon />}
    >
      {!hasVideoInputDevices ? 'Sin video' : isVideoEnabled ? 'Detener video' : 'Iniciar video'}
    </Button>
  );
}
