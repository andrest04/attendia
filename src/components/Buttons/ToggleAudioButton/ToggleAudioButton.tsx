import React from 'react';
import Button from '@material-ui/core/Button';
import MicIcon from '../../../icons/MicIcon';
import MicOffIcon from '../../../icons/MicOffIcon';
import { toolbarButtonClass, useToolbarButtonStyles } from '../toolbarButtonStyles';
import useLocalAudioToggle from '../../../hooks/useLocalAudioToggle/useLocalAudioToggle';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';
import { t } from '../../../i18n/translate';

export default function ToggleAudioButton(props: {
  disabled?: boolean;
  className?: string;
  iconOnly?: boolean;
  /** Renders as a bare icon (no inner circle) so a circular wrapping chip is the only shape. */
  plain?: boolean;
}) {
  const [isAudioEnabled, toggleAudioEnabled] = useLocalAudioToggle();
  const { localTracks } = useVideoContext();
  const hasAudioTrack = localTracks.some(track => track.kind === 'audio');
  const classes = useToolbarButtonStyles();
  const label = t(!hasAudioTrack ? 'Sin audio' : isAudioEnabled ? 'Silenciar' : 'Activar');
  const isActive = hasAudioTrack && isAudioEnabled;

  return (
    <Button
      className={toolbarButtonClass(classes, { active: isActive, plain: props.plain, className: props.className })}
      onClick={toggleAudioEnabled}
      disabled={!hasAudioTrack || props.disabled}
      startIcon={isAudioEnabled ? <MicIcon /> : <MicOffIcon />}
      aria-label={props.iconOnly ? label : undefined}
      data-cy-audio-toggle
    >
      {props.iconOnly ? null : label}
    </Button>
  );
}
