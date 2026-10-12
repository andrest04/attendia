import React from 'react';
import clsx from 'clsx';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import ScreenShareIcon from '../../../icons/ScreenShareIcon';
import Tooltip from '@material-ui/core/Tooltip';
import { useToolbarButtonStyles } from '../toolbarButtonStyles';
import useScreenShareControl from '../../../hooks/useScreenShareControl/useScreenShareControl';

export const SCREEN_SHARE_TEXT = 'Compartir pantalla';
export const STOP_SCREEN_SHARE_TEXT = 'Dejar de compartir';
export const SHARE_IN_PROGRESS_TEXT = 'No puedes compartir pantalla mientras otro usuario lo está haciendo';
export const SHARE_NOT_SUPPORTED_TEXT = 'Este navegador no admite compartir pantalla';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    button: {
      '&[disabled]': {
        color: '#bbb',
        '& svg *': {
          fill: '#bbb',
        },
      },
    },
  })
);

export default function ToggleScreenShareButton(props: { disabled?: boolean; className?: string; iconOnly?: boolean }) {
  const classes = useStyles();
  const toolbarClasses = useToolbarButtonStyles();
  const {
    toggleScreenShare,
    isSharingScreen,
    isSupported: isScreenShareSupported,
    blockedByOtherShare: disableScreenShareButton,
    disabled: isScreenShareUnavailable,
  } = useScreenShareControl();
  const isDisabled = props.disabled || isScreenShareUnavailable;

  let tooltipMessage = '';

  if (disableScreenShareButton) {
    tooltipMessage = SHARE_IN_PROGRESS_TEXT;
  }

  if (!isScreenShareSupported) {
    tooltipMessage = SHARE_NOT_SUPPORTED_TEXT;
  }

  return (
    <Tooltip
      title={tooltipMessage}
      placement="top"
      PopperProps={{ disablePortal: true }}
      style={{ cursor: isDisabled ? 'not-allowed' : 'pointer' }}
    >
      <span>
        {/* The span element is needed because a disabled button will not emit hover events and we want to display
          a tooltip when screen sharing is disabled */}
        <Button
          className={clsx(
            toolbarClasses.toolbarButton,
            isSharingScreen && toolbarClasses.toolbarButtonActive,
            classes.button,
            props.className
          )}
          onClick={toggleScreenShare}
          disabled={isDisabled}
          startIcon={<ScreenShareIcon />}
          aria-label={props.iconOnly ? (isSharingScreen ? STOP_SCREEN_SHARE_TEXT : 'Compartir') : undefined}
          data-cy-share-screen
        >
          {props.iconOnly ? null : isSharingScreen ? STOP_SCREEN_SHARE_TEXT : 'Compartir'}
        </Button>
      </span>
    </Tooltip>
  );
}
