import React from 'react';
import { makeStyles, Typography, Grid, Button, Theme, Hidden, Switch, Tooltip } from '@material-ui/core';
import CircularProgress from '@material-ui/core/CircularProgress';
import Divider from '@material-ui/core/Divider';
import LocalVideoPreview from './LocalVideoPreview/LocalVideoPreview';
import SettingsMenu from './SettingsMenu/SettingsMenu';
import { Steps } from '../PreJoinScreens';
import ToggleAudioButton from '../../Buttons/ToggleAudioButton/ToggleAudioButton';
import ToggleVideoButton from '../../Buttons/ToggleVideoButton/ToggleVideoButton';
import { useAppState } from '../../../state';
import useChatContext from '../../../hooks/useChatContext/useChatContext';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import { useKrispToggle } from '../../../hooks/useKrispToggle/useKrispToggle';
import SmallCheckIcon from '../../../icons/SmallCheckIcon';
import InfoIconOutlined from '../../../icons/InfoIconOutlined';
import WarningIcon from '@material-ui/icons/Warning';
import SecurityIcon from '@material-ui/icons/Security';

const useStyles = makeStyles((theme: Theme) => ({
  gutterBottom: {
    marginBottom: '1em',
  },
  marginTop: {
    marginTop: '1em',
  },
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
  joinButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '0.8em',
    '& button': {
      whiteSpace: 'nowrap',
    },
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column-reverse',
      width: '100%',
      gap: 0,
      '& button': {
        margin: '0.5em 0',
      },
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
  // Lighting check banner — static placeholder (not wired to real analysis)
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
  // Privacy / connection info block
  preJoinInfoBlock: {
    padding: '10px 14px',
    marginTop: '0.5em',
    backgroundColor: '#F5F5F5',
    border: '1px dashed #BDBDBD',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
  },
  preJoinInfoText: {
    fontSize: '0.78rem',
    color: '#616161',
  },
  // Static connection quality pill
  connectionPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    fontSize: '0.75rem',
    color: '#616161',
    marginBottom: '0.5em',
  },
  connectionDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    backgroundColor: '#9E9E9E',
    flexShrink: 0,
  },
}));

interface DeviceSelectionScreenProps {
  name: string;
  roomName: string;
  setStep: (step: Steps) => void;
}

export default function DeviceSelectionScreen({ name, roomName, setStep }: DeviceSelectionScreenProps) {
  const classes = useStyles();
  const { getToken, isFetching, isKrispEnabled, isKrispInstalled } = useAppState();
  const { connect: chatConnect } = useChatContext();
  const { connect: videoConnect, isAcquiringLocalTracks, isConnecting } = useVideoContext();
  const { toggleKrisp } = useKrispToggle();
  const disableButtons = isFetching || isAcquiringLocalTracks || isConnecting;

  const handleJoin = () => {
    getToken(name, roomName).then(({ token }) => {
      videoConnect(token);
      process.env.REACT_APP_DISABLE_TWILIO_CONVERSATIONS !== 'true' && chatConnect(token);
    });
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
      <Typography variant="h5" className={classes.gutterBottom}>
        Unirse a {roomName}
      </Typography>

      {/*
        Lighting check — static placeholder (not yet wired to real analysis).
        Displayed as a soft informational hint, not a blocking warning.
      */}
      <div className={classes.lightingBanner} role="note" aria-label="Verificación de iluminación">
        <WarningIcon style={{ fontSize: 16, color: '#F9A825', flexShrink: 0, marginTop: 2 }} />
        <Typography className={classes.lightingBannerText}>
          <strong>Verifica tu iluminación:</strong> asegúrate de tener buena luz para que el sistema pueda analizar tu
          atención correctamente.
          {/* Lighting check — static placeholder. Not yet wired to real analysis. */}
        </Typography>
      </div>

      <Grid container justifyContent="center">
        <Grid item md={7} sm={12} xs={12}>
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
        </Grid>
        <Grid item md={5} sm={12} xs={12}>
          <Grid container direction="column" justifyContent="space-between" style={{ alignItems: 'normal' }}>
            <div>
              <Hidden smDown>
                <ToggleAudioButton className={classes.deviceButton} disabled={disableButtons} />
                <ToggleVideoButton className={classes.deviceButton} disabled={disableButtons} />
              </Hidden>
            </div>
          </Grid>
        </Grid>

        <Grid item md={12} sm={12} xs={12}>
          {isKrispInstalled && (
            <Grid
              container
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              style={{ marginBottom: '1em' }}
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
          <Divider />
        </Grid>

        <Grid item md={12} sm={12} xs={12}>
          {/*
            No Room exists pre-connect — network quality is not available here (static placeholder).
            The pill below is purely decorative until a Room connection is established.
          */}
          <div className={classes.preJoinInfoBlock}>
            <SecurityIcon style={{ fontSize: 14, color: '#9E9E9E', marginTop: 2, flexShrink: 0 }} />
            <Typography className={classes.preJoinInfoText}>
              El análisis de atención se procesa localmente. No se almacenan datos faciales.
            </Typography>
          </div>
        </Grid>

        <Grid item md={12} sm={12} xs={12}>
          <Grid container direction="row" alignItems="center" style={{ marginTop: '1em' }}>
            <Hidden smDown>
              <Grid item md={5} sm={12} xs={12}>
                <SettingsMenu mobileButtonClass={classes.mobileButton} />
              </Grid>
            </Hidden>

            <Grid item md={7} sm={12} xs={12}>
              <div className={classes.joinButtons}>
                <Button variant="outlined" color="primary" onClick={() => setStep(Steps.roomNameStep)}>
                  Cancelar
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  data-cy-join-now
                  onClick={handleJoin}
                  disabled={disableButtons}
                >
                  Unirme ahora
                </Button>
              </div>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </>
  );
}
