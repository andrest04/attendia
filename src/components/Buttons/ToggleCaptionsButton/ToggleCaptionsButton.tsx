import { useCallback } from 'react';
import clsx from 'clsx';
import Button from '@material-ui/core/Button';
import Tooltip from '@material-ui/core/Tooltip';
import CaptionsIcon from '../../../icons/CaptionsIcon';
import CaptionsOffIcon from '../../../icons/CaptionsOffIcon';
import { useToolbarButtonStyles } from '../toolbarButtonStyles';
import { useAppState } from '../../../state';

export default function ToggleCaptionsButton(props: { disabled?: boolean; className?: string }) {
  const { isCaptionsEnabled, setIsCaptionsEnabled } = useAppState();
  const classes = useToolbarButtonStyles();

  const toggleCaptions = useCallback(() => {
    setIsCaptionsEnabled(enabled => !enabled);
  }, [setIsCaptionsEnabled]);

  const tooltipTitle = isCaptionsEnabled ? '' : 'Requires Real-Time Transcriptions to be enabled in the Twilio Console';

  return (
    <Tooltip title={tooltipTitle} placement="top" data-testid="captions-tooltip">
      <span>
        <Button
          className={clsx(classes.toolbarButton, { [classes.toolbarButtonActive]: isCaptionsEnabled }, props.className)}
          onClick={toggleCaptions}
          disabled={props.disabled}
          startIcon={isCaptionsEnabled ? <CaptionsIcon /> : <CaptionsOffIcon />}
          data-cy="toggle-captions"
          aria-label="Toggle Captions"
        >
          {isCaptionsEnabled ? 'Subtítulos' : 'Subtítulos'}
        </Button>
      </span>
    </Tooltip>
  );
}
