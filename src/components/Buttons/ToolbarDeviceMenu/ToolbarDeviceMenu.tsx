import React, { useState } from 'react';
import clsx from 'clsx';
import { Button, createStyles, makeStyles, Theme } from '@material-ui/core';
import KeyboardArrowUpIcon from '@material-ui/icons/KeyboardArrowUp';
import CheckIcon from '@material-ui/icons/Check';
import { LocalAudioTrack, LocalVideoTrack } from 'twilio-video';
import { DEFAULT_VIDEO_CONSTRAINTS, SELECTED_AUDIO_INPUT_KEY, SELECTED_VIDEO_INPUT_KEY } from '../../../constants';
import { useAppState } from '../../../state';
import useDevices from '../../../hooks/useDevices/useDevices';
import useMediaStreamTrack from '../../../hooks/useMediaStreamTrack/useMediaStreamTrack';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';
import { selectAudioTrack, selectCameraTrack } from '../../../utils/trackSelectors';
import { t } from '../../../i18n/translate';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    wrap: {
      position: 'relative',
      display: 'flex',
    },
    // Bare chevron that tucks next to the mic/camera button — the Google Meet
    // device-picker affordance. No filled chip/background: just a subtle glyph so it
    // reads as an affordance ON the button, not as a separate control.
    caret: {
      width: 16,
      height: 44,
      minWidth: 16,
      padding: 0,
      borderRadius: 0,
      flexShrink: 0,
      backgroundColor: 'transparent',
      color: 'rgba(255,255,255,0.6)',
      '&:hover': {
        backgroundColor: 'transparent',
        color: 'rgba(255,255,255,0.95)',
      },
      '& .MuiButton-startIcon': {
        margin: 0,
      },
      '& svg': {
        width: 18,
        height: 18,
      },
    },
    backdrop: {
      position: 'fixed',
      inset: 0,
      zIndex: 15,
    },
    '@keyframes deviceMenuIn': {
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
    // Opens upward (toolbar sits at the bottom of the stage) and is centred over the
    // caret so it never runs off either edge of the bar.
    menu: {
      position: 'absolute',
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginBottom: 8,
      zIndex: 16,
      minWidth: 240,
      maxWidth: 300,
      backgroundColor: '#16255c',
      borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.12)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      overflow: 'hidden',
      padding: '6px 0',
      animation: '$deviceMenuIn 150ms ease',
      '@media (prefers-reduced-motion: reduce)': {
        animation: 'none',
      },
    },
    sectionLabel: {
      padding: '8px 14px 4px',
      fontFamily: 'Inter, sans-serif',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 0.4,
      textTransform: 'uppercase' as const,
      color: 'rgba(255,255,255,0.45)',
    },
    item: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      padding: '9px 14px',
      background: 'none',
      border: 'none',
      textAlign: 'left' as const,
      cursor: 'pointer',
      fontFamily: 'Inter, sans-serif',
      fontSize: 13,
      fontWeight: 500,
      color: 'rgba(255,255,255,0.85)',
      '&:hover': {
        backgroundColor: 'rgba(255,255,255,0.08)',
      },
    },
    itemActive: {
      color: '#69a9ff',
    },
    // Reserve the check column so labels line up whether or not a row is selected.
    check: {
      width: 16,
      height: 16,
      flexShrink: 0,
    },
    label: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
    },
    divider: {
      height: 1,
      margin: '6px 0',
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
  })
);

interface DeviceOption {
  deviceId: string;
  label: string;
}

interface DeviceGroup {
  /** Section heading, e.g. "Micrófono". */
  title: string;
  devices: DeviceOption[];
  activeDeviceId?: string;
  onSelect: (deviceId: string) => void;
  fallbackLabel: string;
}

interface ToolbarDeviceMenuProps {
  /** Which controls this caret manages: audio → mic + speaker, video → camera. */
  kind: 'audio' | 'video';
  /** Disable the caret (e.g. while reconnecting). */
  disabled?: boolean;
  'data-testid'?: string;
}

export default function ToolbarDeviceMenu({ kind, disabled, ...rest }: ToolbarDeviceMenuProps) {
  const classes = useStyles();
  const { localTracks } = useVideoContext();
  const { audioInputDevices, videoInputDevices, audioOutputDevices } = useDevices();
  const { activeSinkId, setActiveSinkId } = useAppState();

  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);

  const localAudioTrack = selectAudioTrack(localTracks) as LocalAudioTrack | undefined;
  const localVideoTrack = selectCameraTrack(localTracks) as LocalVideoTrack | undefined;

  const audioStreamTrack = useMediaStreamTrack(localAudioTrack);
  const videoStreamTrack = useMediaStreamTrack(localVideoTrack);

  // Persist the preference even when the track is off so the next acquisition picks it
  // up; restart live tracks in place. Mirrors AudioInputList / VideoInputList exactly.
  const selectAudioInput = (deviceId: string) => {
    window.localStorage.setItem(SELECTED_AUDIO_INPUT_KEY, deviceId);
    localAudioTrack?.restart({ deviceId: { exact: deviceId } });
  };
  const selectVideoInput = (deviceId: string) => {
    window.localStorage.setItem(SELECTED_VIDEO_INPUT_KEY, deviceId);
    localVideoTrack?.restart({ ...(DEFAULT_VIDEO_CONSTRAINTS as {}), deviceId: { exact: deviceId } });
  };

  const groups: DeviceGroup[] =
    kind === 'audio'
      ? [
          {
            title: t('Micrófono'),
            devices: audioInputDevices,
            activeDeviceId:
              localAudioTrack?.noiseCancellation?.sourceTrack?.getSettings().deviceId ||
              audioStreamTrack?.getSettings().deviceId,
            onSelect: selectAudioInput,
            fallbackLabel: t('Micrófono del sistema'),
          },
          {
            title: t('Parlante'),
            devices: audioOutputDevices,
            activeDeviceId: activeSinkId,
            onSelect: setActiveSinkId,
            fallbackLabel: t('Salida de audio del sistema'),
          },
        ]
      : [
          {
            title: t('Cámara'),
            devices: videoInputDevices,
            activeDeviceId: videoStreamTrack?.getSettings().deviceId,
            onSelect: selectVideoInput,
            fallbackLabel: t('Cámara del sistema'),
          },
        ];

  const ariaLabel = kind === 'audio' ? t('Elegir micrófono o parlante') : t('Elegir cámara');

  return (
    <div className={classes.wrap}>
      <Button
        onClick={() => setIsOpen(open => !open)}
        disabled={disabled}
        className={classes.caret}
        startIcon={<KeyboardArrowUpIcon />}
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={isOpen}
        data-testid={rest['data-testid']}
      />
      {isOpen && (
        <>
          <div className={classes.backdrop} onClick={close} />
          <div className={classes.menu} role="menu" data-testid={rest['data-testid'] && `${rest['data-testid']}-menu`}>
            {groups.map((group, groupIndex) => (
              <React.Fragment key={group.title}>
                {groupIndex > 0 && <div className={classes.divider} />}
                <div className={classes.sectionLabel}>{group.title}</div>
                {group.devices.length > 0 ? (
                  group.devices.map(device => {
                    const isActive = device.deviceId === group.activeDeviceId;
                    return (
                      <button
                        type="button"
                        key={device.deviceId}
                        className={clsx(classes.item, { [classes.itemActive]: isActive })}
                        role="menuitemradio"
                        aria-checked={isActive}
                        onClick={() => {
                          group.onSelect(device.deviceId);
                          close();
                        }}
                      >
                        <span className={classes.check}>{isActive && <CheckIcon style={{ fontSize: 16 }} />}</span>
                        <span className={classes.label}>{device.label}</span>
                      </button>
                    );
                  })
                ) : (
                  <div className={classes.item} style={{ cursor: 'default', opacity: 0.6 }}>
                    <span className={classes.check} />
                    <span className={classes.label}>{group.fallbackLabel}</span>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
