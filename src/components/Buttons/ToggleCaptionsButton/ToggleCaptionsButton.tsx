import { useCallback } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import es from '../../../i18n/locales/completeControls.es';
import Button from '@material-ui/core/Button';
import Tooltip from '@material-ui/core/Tooltip';
import CaptionsIcon from '../../../icons/CaptionsIcon';
import CaptionsOffIcon from '../../../icons/CaptionsOffIcon';
import { useToolbarButtonStyles } from '../toolbarButtonStyles';
import { useAppState } from '../../../state';

export default function ToggleCaptionsButton(props: { disabled?: boolean; className?: string }) {
  const { t } = useTranslation('toolbar');
  const { t: controls } = useTranslation('completeControls');
  const { isCaptionsEnabled, setIsCaptionsEnabled } = useAppState();
  const classes = useToolbarButtonStyles();

  const toggleCaptions = useCallback(() => {
    setIsCaptionsEnabled(enabled => !enabled);
  }, [setIsCaptionsEnabled]);

  const tooltipTitle = isCaptionsEnabled ? '' : controls('captionsRequirement', es.captionsRequirement);

  return (
    <Tooltip title={tooltipTitle} placement="top" data-testid="captions-tooltip">
      <span>
        <Button
          className={clsx(classes.toolbarButton, { [classes.toolbarButtonActive]: isCaptionsEnabled }, props.className)}
          onClick={toggleCaptions}
          disabled={props.disabled}
          startIcon={isCaptionsEnabled ? <CaptionsIcon /> : <CaptionsOffIcon />}
          data-cy="toggle-captions"
          aria-label={controls('captionsAria', es.captionsAria)}
        >
          {t('captions.label')}
        </Button>
      </span>
    </Tooltip>
  );
}
