import React, { useCallback, useRef } from 'react';
import clsx from 'clsx';
import Button from '@material-ui/core/Button';
import VideoOffIcon from '../../../icons/VideoOffIcon';
import VideoOnIcon from '../../../icons/VideoOnIcon';
import { useToolbarButtonStyles } from '../toolbarButtonStyles';
import useDevices from '../../../hooks/useDevices/useDevices';
import useLocalVideoToggle from '../../../hooks/useLocalVideoToggle/useLocalVideoToggle';

export default function ToggleVideoButton(props: {
  disabled?: boolean;
  className?: string;
  iconOnly?: boolean;
  /** Renders as a bare icon (no inner circle) so a circular wrapping chip is the only shape. */
  plain?: boolean;
}) {
  const [isVideoEnabled, toggleVideoEnabled] = useLocalVideoToggle();
  const lastClickTimeRef = useRef(0);
  const { hasVideoInputDevices } = useDevices();
  const classes = useToolbarButtonStyles();
  const label = !hasVideoInputDevices ? 'Sin video' : isVideoEnabled ? 'Detener video' : 'Iniciar video';
  const isActive = hasVideoInputDevices && isVideoEnabled;

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
        props.plain && classes.chipIcon,
        {
          [classes.toolbarButtonActive]: !props.plain && isActive,
          [classes.chipIconActive]: props.plain && isActive,
        },
        props.className
      )}
      onClick={toggleVideo}
      disabled={!hasVideoInputDevices || props.disabled}
      startIcon={isVideoEnabled ? <VideoOnIcon /> : <VideoOffIcon />}
      aria-label={props.iconOnly ? label : undefined}
    >
      {props.iconOnly ? null : label}
    </Button>
  );
}
