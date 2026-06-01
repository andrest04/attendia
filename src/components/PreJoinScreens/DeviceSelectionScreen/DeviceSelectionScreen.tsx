import React from 'react';
import { makeStyles, Typography, Grid, Button, Theme, Hidden, Switch, Tooltip } from '@material-ui/core';
import CircularProgress from '@material-ui/core/CircularProgress';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import WarningIcon from '@material-ui/icons/Warning';
import SecurityIcon from '@material-ui/icons/Security';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import RemoveCircleOutlineIcon from '@material-ui/icons/RemoveCircleOutline';
import WifiIcon from '@material-ui/icons/Wifi';

import { LocalVideoTrack } from 'twilio-video';
import { saveRejoinSession } from '../rejoinSession';
import LocalVideoPreview from './LocalVideoPreview/LocalVideoPreview';
import SettingsMenu from './SettingsMenu/SettingsMenu';
import { Steps } from '../PreJoinScreens';
import ToggleAudioButton from '../../Buttons/ToggleAudioButton/ToggleAudioButton';
import ToggleVideoButton from '../../Buttons/ToggleVideoButton/ToggleVideoButton';
import { useAppState } from '../../../state';
import useChatContext from '../../../hooks/useChatContext/useChatContext';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';
import useDevices from '../../../hooks/useDevices/useDevices';
import useConnectionQuality, { ConnectionQuality } from '../../../hooks/useConnectionQuality/useConnectionQuality';
import useLightingCheck, { LightingStatus } from '../../../hooks/useLightingCheck/useLightingCheck';
import useStaggeredReveal from '../../../hooks/useStaggeredReveal/useStaggeredReveal';
import { useKrispToggle } from '../../../hooks/useKrispToggle/useKrispToggle';
import SmallCheckIcon from '../../../icons/SmallCheckIcon';
import InfoIconOutlined from '../../../icons/InfoIconOutlined';

// Pre-join check states share one icon vocabulary across the device list.
// 'unavailable' = the check can't run right now and that's expected (e.g. the
// lighting check with the camera turned off) — neutral, not an error.
type CheckState = 'ok' | 'fail' | 'pending' | 'unavailable';

const CONNECTION_DOT_COLOR: Record<ConnectionQuality, string> = {
  good: '#4CAF50',
  medium: '#F9A825',
  poor: '#E53935',
  unknown: '#9E9E9E',
};

const useStyles = makeStyles((theme: Theme) => ({
  gutterBottom: {
    marginBottom: '1em',
  },
  // Header
  titleBlock: {
    marginBottom: '1em',
  },
  subtitle: {
    fontSize: '0.85rem',
    color: '#606B85',
    marginTop: 4,
  },
  // Lighting check banner — driven by real local luminance analysis.
  lightingBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '10px 14px',
    marginBottom: '1em',
    backgroundColor: '#FFF8E1',
    border: '1px solid #FFE082',
    borderRadius: 4,
  },
  lightingBannerText: {
    fontSize: '0.8rem',
    color: 'rgb(40, 42, 43)',
  },
  // Preview column
  deviceButton: {
    width: '100%',
    border: '2px solid #aaa',
    margin: '1em 0',
  },
  localPreviewContainer: {
    paddingRight: '2em',
    marginBottom: '2em',
    [theme.breakpoints.down('sm')]: {
      padding: '0 2.5em',
    },
  },
  mobileButtonBar: {
    [theme.breakpoints.down('sm')]: {
      display: 'flex',
      justifyContent: 'space-between',
      margin: '1.5em 0 1em',
    },
  },
  mobileButton: {
    padding: '0.8em 0',
    margin: 0,
  },
  toolTipContainer: {
    display: 'flex',
    alignItems: 'center',
    '& div': {
      display: 'flex',
      alignItems: 'center',
    },
    '& svg': {
      marginLeft: '0.3em',
    },
  },
  // "Verificación previa" panel
  panel: {
    backgroundColor: '#FAFAFA',
    border: '1px solid #E0E0E0',
    borderRadius: 8,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    height: '100%',
    boxSizing: 'border-box',
  },
  panelTitle: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#282A2B',
  },
  panelGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  panelLabel: {
    fontSize: '0.8rem',
    fontWeight: 500,
    color: '#3D4252',
  },
  connectionPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 12,
    backgroundColor: '#EEEEEE',
    fontSize: '0.78rem',
    color: '#3D4252',
    alignSelf: 'flex-start',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  checkText: {
    fontSize: '0.78rem',
  },
  privacy: {
    padding: 10,
    backgroundColor: '#F5F5F5',
    border: '1px dashed #BDBDBD',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
  },
  privacyTitle: {
    fontSize: '0.76rem',
    fontWeight: 500,
    color: '#3D4252',
  },
  privacyText: {
    fontSize: '0.72rem',
    color: '#616161',
    margin: '3px 0 0',
  },
  enterBlock: {
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  cta: {
    width: '100%',
  },
}));

interface DeviceSelectionScreenProps {
  name: string;
  roomName: string;
  setStep: (step: Steps) => void;
}

function CheckIcon({ state }: { state: CheckState }) {
  if (state === 'ok') {
    return <CheckCircleIcon style={{ fontSize: 15, color: '#4CAF50' }} />;
  }
  if (state === 'fail') {
    return <WarningIcon style={{ fontSize: 15, color: '#E53935' }} />;
  }
  if (state === 'unavailable') {
    // Neutral, expected-not-applicable state (e.g. camera off) — not a failure.
    return <RemoveCircleOutlineIcon style={{ fontSize: 15, color: '#BDBDBD' }} />;
  }
  return <CircularProgress size={13} thickness={5} style={{ color: '#9E9E9E' }} />;
}

function lightingToCheckState(status: LightingStatus): CheckState {
  if (status === 'ok') return 'ok';
  if (status === 'low') return 'fail';
  return 'pending';
}

export default function DeviceSelectionScreen({ name, roomName, setStep }: DeviceSelectionScreenProps) {
  const classes = useStyles();
  const { getToken, isFetching, isKrispEnabled, isKrispInstalled } = useAppState();
  const { connect: chatConnect } = useChatContext();
  const { connect: videoConnect, isAcquiringLocalTracks, isConnecting, localTracks } = useVideoContext();
  const { toggleKrisp } = useKrispToggle();

  const { hasAudioInputDevices, hasVideoInputDevices, audioOutputDevices } = useDevices();
  const connection = useConnectionQuality();
  const videoTrack = localTracks.find(track => !track.name.includes('screen') && track.kind === 'video') as
    | LocalVideoTrack
    | undefined;
  const lighting = useLightingCheck(videoTrack);

  const disableButtons = isFetching || isAcquiringLocalTracks || isConnecting;

  // With the camera off the track is removed, so there's no frame to analyze.
  // Surface that as a neutral "unavailable" rather than an endless spinner.
  // While tracks are still being acquired, keep it pending instead.
  const isCameraOff = !videoTrack && !isAcquiringLocalTracks;
  const lightingState: CheckState = isCameraOff ? 'unavailable' : lightingToCheckState(lighting.status);

  const deviceChecks: Array<{ label: string; state: CheckState }> = [
    { label: 'Micrófono detectado', state: hasAudioInputDevices ? 'ok' : 'fail' },
    { label: 'Cámara detectada', state: hasVideoInputDevices ? 'ok' : 'fail' },
    { label: 'Altavoces detectados', state: audioOutputDevices.length > 0 ? 'ok' : 'fail' },
    { label: isCameraOff ? 'Iluminación (cámara apagada)' : 'Iluminación adecuada', state: lightingState },
  ];

  // Reveal the checks sequentially (top to bottom) so detection reads as a
  // running check rather than resolving all at once. Rows past the reveal
  // frontier stay in the 'pending' (spinner) state.
  const revealedChecks = useStaggeredReveal(deviceChecks.length);

  const handleJoin = () => {
    getToken(name, roomName)
      .then(({ token }) => {
        // Persist enough to auto-rejoin after a refresh. The identity carries the role
        // (teacher/student), so reconnecting with it restores the correct room shell.
        saveRejoinSession({ roomName, identity: name });
        videoConnect(token);
        process.env.REACT_APP_DISABLE_TWILIO_CONVERSATIONS !== 'true' && chatConnect(token);
      })
      // getToken now rejects when the server refuses (e.g. the room-access guard blocking
      // a student for a room the teacher hasn't opened). The error is already surfaced via
      // the app-level ErrorDialog (setError in the getToken wrapper); just swallow the
      // rejection here so it doesn't become an unhandled promise rejection.
      .catch(() => {});
  };

  if (isFetching || isConnecting) {
    return (
      <Grid container justifyContent="center" alignItems="center" direction="column" style={{ height: '100%' }}>
        <div>
          <CircularProgress variant="indeterminate" />
        </div>
        <div>
          <Typography variant="body2" style={{ fontWeight: 'bold', fontSize: '16px' }}>
            Uniéndose a la reunión
          </Typography>
        </div>
      </Grid>
    );
  }

  return (
    <>
      <div className={classes.titleBlock}>
        <Typography variant="h5">Sala de Espera</Typography>
        <Typography className={classes.subtitle}>
          Verifica tus dispositivos antes de entrar · Sala: <strong>{roomName}</strong>
        </Typography>
        <Typography className={classes.subtitle}>
          Paso compartido para profesor y estudiante antes de entrar.
        </Typography>
      </div>

      {/* Lighting warning — only shown when the live luminance check finds the scene too dark. */}
      {lighting.status === 'low' && (
        <div className={classes.lightingBanner} role="note" aria-label="Verificación de iluminación">
          <WarningIcon style={{ fontSize: 16, color: '#F9A825', flexShrink: 0, marginTop: 2 }} />
          <Typography className={classes.lightingBannerText}>
            <strong>Condiciones de iluminación insuficientes:</strong> mejora la luz de tu entorno para que el sistema
            pueda analizar tu atención correctamente.
          </Typography>
        </div>
      )}

      <Grid container spacing={2}>
        {/* Preview + device controls */}
        <Grid item md={8} sm={12} xs={12}>
          <div className={classes.localPreviewContainer}>
            <LocalVideoPreview identity={name} />
          </div>
          <div className={classes.mobileButtonBar}>
            <Hidden mdUp>
              <ToggleAudioButton className={classes.mobileButton} disabled={disableButtons} />
              <ToggleVideoButton className={classes.mobileButton} disabled={disableButtons} />
              <SettingsMenu mobileButtonClass={classes.mobileButton} />
            </Hidden>
          </div>

          <Hidden smDown>
            <Grid container direction="row" justifyContent="center" spacing={2}>
              <Grid item md={5}>
                <ToggleAudioButton className={classes.deviceButton} disabled={disableButtons} />
              </Grid>
              <Grid item md={5}>
                <ToggleVideoButton className={classes.deviceButton} disabled={disableButtons} />
              </Grid>
            </Grid>
          </Hidden>

          {isKrispInstalled && (
            <Grid
              container
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              style={{ marginTop: '1em' }}
            >
              <div className={classes.toolTipContainer}>
                <Typography variant="subtitle2">Cancelación de ruido</Typography>
                <Tooltip
                  title="Suprime el ruido de fondo de tu micrófono"
                  interactive
                  leaveDelay={250}
                  leaveTouchDelay={15000}
                  enterTouchDelay={0}
                >
                  <div>
                    <InfoIconOutlined />
                  </div>
                </Tooltip>
              </div>

              <FormControlLabel
                control={
                  <Switch
                    checked={!!isKrispEnabled}
                    checkedIcon={<SmallCheckIcon />}
                    disableRipple={true}
                    onClick={toggleKrisp}
                  />
                }
                label={isKrispEnabled ? 'Activado' : 'Desactivado'}
                style={{ marginRight: 0 }}
                // Prevents <Switch /> from being temporarily enabled (and then quickly disabled) in unsupported browsers after
                // isAcquiringLocalTracks becomes false:
                disabled={isKrispEnabled && isAcquiringLocalTracks}
              />
            </Grid>
          )}

          <Hidden smDown>
            <div style={{ marginTop: '1em' }}>
              <SettingsMenu mobileButtonClass={classes.mobileButton} />
            </div>
          </Hidden>
        </Grid>

        {/* "Verificación previa" panel — real device, connection, and lighting status. */}
        <Grid item md={4} sm={12} xs={12}>
          <div className={classes.panel}>
            <Typography className={classes.panelTitle}>Verificación previa</Typography>

            <div className={classes.panelGroup}>
              <span className={classes.panelLabel}>Calidad de conexión</span>
              <span className={classes.connectionPill}>
                <WifiIcon style={{ fontSize: 14, color: CONNECTION_DOT_COLOR[connection.quality] }} />
                {connection.label}
                <span
                  className={classes.connectionDot}
                  style={{ backgroundColor: CONNECTION_DOT_COLOR[connection.quality] }}
                />
              </span>
            </div>

            <div className={classes.panelGroup}>
              <span className={classes.panelLabel}>Estado de dispositivos</span>
              {deviceChecks.map((item, index) => {
                // Until this row's turn arrives, show the spinner regardless of
                // its (already-known) real state.
                const effectiveState: CheckState = index < revealedChecks ? item.state : 'pending';
                return (
                  <div key={item.label} className={classes.checkRow}>
                    <CheckIcon state={effectiveState} />
                    <span
                      className={classes.checkText}
                      style={{ color: effectiveState === 'ok' ? '#3D4252' : '#9E9E9E' }}
                    >
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className={classes.privacy}>
              <SecurityIcon style={{ fontSize: 14, color: '#9E9E9E', marginTop: 2, flexShrink: 0 }} />
              <div>
                <Typography className={classes.privacyTitle}>Privacidad de datos faciales</Typography>
                <Typography className={classes.privacyText}>
                  El análisis de atención se procesa localmente. No se almacenan datos faciales.
                </Typography>
              </div>
            </div>

            <div className={classes.enterBlock}>
              <Button
                variant="contained"
                color="primary"
                className={classes.cta}
                data-cy-join-now
                onClick={handleJoin}
                disabled={disableButtons}
              >
                Entrar a la sala
              </Button>
              <Button
                variant="outlined"
                color="primary"
                className={classes.cta}
                onClick={() => setStep(Steps.roomNameStep)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </Grid>
      </Grid>
    </>
  );
}
