import React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import ScreenShareIcon from '../../../icons/ScreenShareIcon';
import Tooltip from '@material-ui/core/Tooltip';
import { toolbarButtonClass, useToolbarButtonStyles } from '../toolbarButtonStyles';
import useScreenShareControl from '../../../hooks/useScreenShareControl/useScreenShareControl';

// Translation keys (namespace-qualified), shared with the room toolbars: resolve them with `t`.
export const SCREEN_SHARE_KEY = 'toolbar:screenShare.start';
export const STOP_SCREEN_SHARE_KEY = 'toolbar:screenShare.stop';
export const SHARE_IN_PROGRESS_KEY = 'toolbar:screenShare.blockedByOther';
export const SHARE_LOCKED_KEY = 'toolbar:screenShare.lockedByTeacher';
export const SHARE_NOT_SUPPORTED_KEY = 'toolbar:screenShare.notSupported';

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
  const { t } = useTranslation('toolbar');
  const classes = useStyles();
  const toolbarClasses = useToolbarButtonStyles();
  const {
    toggleScreenShare,
    isSharingScreen,
    isSupported: isScreenShareSupported,
    blockedByOtherShare: disableScreenShareButton,
    lockedByTeacher,
    disabled: isScreenShareUnavailable,
  } = useScreenShareControl();
  const isDisabled = props.disabled || isScreenShareUnavailable;

  let tooltipMessage = '';

  if (disableScreenShareButton) {
    tooltipMessage = t(SHARE_IN_PROGRESS_KEY);
  }

  if (lockedByTeacher) {
    tooltipMessage = t(SHARE_LOCKED_KEY);
  }

  if (!isScreenShareSupported) {
    tooltipMessage = t(SHARE_NOT_SUPPORTED_KEY);
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
          className={toolbarButtonClass(toolbarClasses, {
            active: isSharingScreen,
            className: clsx(classes.button, props.className),
          })}
          onClick={toggleScreenShare}
          disabled={isDisabled}
          startIcon={<ScreenShareIcon />}
          aria-label={
            props.iconOnly ? (isSharingScreen ? t(STOP_SCREEN_SHARE_KEY) : t('screenShare.short')) : undefined
          }
          data-cy-share-screen
        >
          {props.iconOnly ? null : isSharingScreen ? t(STOP_SCREEN_SHARE_KEY) : t('screenShare.short')}
        </Button>
      </span>
    </Tooltip>
  );
}
