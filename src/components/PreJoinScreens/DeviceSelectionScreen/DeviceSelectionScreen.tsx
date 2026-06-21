import React, { useState } from 'react';
import { makeStyles, Typography, Grid, Button, Theme, Hidden, Switch, Tooltip } from '@material-ui/core';
import CircularProgress from '@material-ui/core/CircularProgress';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import WarningIcon from '@material-ui/icons/Warning';
import SecurityIcon from '@material-ui/icons/Security';
import WifiIcon from '@material-ui/icons/Wifi';

import { LocalVideoTrack } from 'twilio-video';
import { saveRejoinSession } from '../rejoinSession';
import { hasConsent, saveConsent } from '../attentionConsent';
import { isTeacherIdentity } from '../classSessionTypes';
import AttentionConsentModal from '../AttentionConsentModal';
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

const CONNECTION_QUALITY_LABEL: Record<ConnectionQuality, string> = {
  good: 'Conexión buena',
  medium: 'Conexión media',
  poor: 'Conexión pobre',
  unknown: 'Verificando…',
};

const CONNECTION_BAR_COLOR: Record<ConnectionQuality, string> = {
  good: '#10b981',
  medium: '#1d6eed',
  poor: '#ef4444',
  unknown: '#94a3b8',
};

// Icon badge colors for each check state
const CHECK_BADGE_BG: Record<CheckState, string> = {
  ok: '#d1fae5',
  fail: '#fee2e2',
  pending: '#f1f5f9',
  unavailable: '#f1f5f9',
};

const CHECK_TEXT_COLOR: Record<CheckState, string> = {
  ok: '#353535',
  fail: '#7f1d1d',
  pending: '#94a3b8',
  unavailable: '#94a3b8',
};

const useStyles = makeStyles((theme: Theme) => ({
  gutterBottom: {
    marginBottom: '1em',
  },
  // Inner padding for the device-check card: the shared contentCard has no
  // padding of its own (RoomNameScreen pads itself), so without this the title
  // and grid sit flush against the card edges. Vertical padding is fluid
  // (clamp + vh) so the lobby keeps fitting in one viewport — its cost is
  // recovered by the slightly tightened panel metrics below.
  screenWrapper: {
    padding: 'clamp(14px, 2vh, 24px) clamp(24px, 2.4vw, 32px)',
    [theme.breakpoints.down('sm')]: {
      padding: '16px 16px 20px',
    },
  },
  // Header
  titleBlock: {
    marginBottom: 'clamp(12px, 1.6vh, 18px)',
  },
  pageTitle: {
    fontFamily: 'Poppins, sans-serif',
    fontWeight: 700,
    fontSize: 28,
    lineHeight: '34px',
    color: '#1d2f6f',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  subtitleBold: {
    fontWeight: 700,
    color: '#1d2f6f',
  },
  // Lighting warning banner — driven by real local luminance analysis.
  lightingBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '15.5px 19.5px',
    marginBottom: '1.25em',
    backgroundColor: '#fff8e1',
    border: '1.5px solid #ffe082',
    borderRadius: 14,
  },
  lightingBannerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,184,0,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  lightingBannerBody: {
    flex: 1,
    minWidth: 0,
  },
  lightingBannerTitle: {
    fontFamily: 'Poppins, sans-serif',
    fontWeight: 700,
    fontSize: 13,
    lineHeight: '19.5px',
    color: '#7c4e00',
  },
  lightingBannerSub: {
    fontSize: 12,
    lineHeight: '18px',
    color: '#9a6400',
    marginTop: 3,
  },
  lightingBannerClose: {
    width: 40,
    height: 40,
    padding: 0,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#9a6400',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: 20,
    lineHeight: 1,
    borderRadius: 8,
    '&:hover': { backgroundColor: 'rgba(154,100,0,0.08)' },
  },
  // Preview column
  localPreviewContainer: {
    paddingRight: '2em',
    marginBottom: '1.5em',
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
  // Lobby-sized variant of the shared toolbar toggle buttons: bigger circle and
  // label per the Figma waiting room. Colors/states stay in toolbarButtonStyles.
  // '&&' doubles the class for specificity over the shared makeStyles rules.
  previewToggle: {
    '&& .MuiButton-startIcon': {
      width: 56,
      height: 56,
      '& svg': {
        width: 24,
        height: 24,
      },
    },
    '&& .MuiButton-label': {
      gap: 10,
    },
    '&& .MuiButton-label > *:not(.MuiButton-startIcon)': {
      fontSize: 14,
      fontFamily: 'Poppins, sans-serif',
      fontWeight: 600,
    },
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
    backgroundColor: '#ffffff',
    border: '1px solid #e2ecf9',
    borderRadius: 20,
    padding: '23px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 19,
    height: '100%',
    boxSizing: 'border-box',
    boxShadow: '0px 2px 12px 0px rgba(29,110,237,0.08), 0px 1px 3px 0px rgba(0,0,0,0.04)',
  },
  panelTitle: {
    fontFamily: 'Poppins, sans-serif',
    fontWeight: 700,
    fontSize: 19,
    lineHeight: '26px',
    color: '#1d2f6f',
  },
  panelGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  // Section labels: uppercase, small, slate
  sectionLabel: {
    fontFamily: 'Poppins, sans-serif',
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: '0.77px',
    textTransform: 'uppercase' as const,
    color: '#94a3b8',
    lineHeight: '16.5px',
  },
  // Connection quality pill
  connectionPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    borderRadius: 12,
    backgroundColor: '#f0f5ff',
    border: '1.5px solid #e2ecf9',
    marginTop: 8,
  },
  connectionLabel: {
    fontFamily: 'Poppins, sans-serif',
    fontWeight: 500,
    fontSize: 14,
    color: '#353535',
    flex: 1,
  },
  // Device check rows
  checkList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 11,
    marginTop: 10,
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  checkText: {
    fontFamily: 'Poppins, sans-serif',
    fontWeight: 500,
    fontSize: 14,
    lineHeight: '21px',
  },
  // Privacy card
  privacy: {
    padding: '16px 18px',
    backgroundColor: '#ebf3ff',
    border: '1.5px solid rgba(29,110,237,0.18)',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  privacyHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  privacyTitle: {
    fontFamily: 'Poppins, sans-serif',
    fontWeight: 700,
    fontSize: 13,
    color: '#1d2f6f',
    lineHeight: '19px',
  },
  privacyText: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: '18.5px',
    marginBottom: 8,
  },
  privacyLink: {
    fontFamily: 'Poppins, sans-serif',
    fontWeight: 600,
    fontSize: 12,
    color: '#1d6eed',
    textDecoration: 'none',
    cursor: 'pointer',
    lineHeight: '18px',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  enterBlock: {
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  // Gradient CTA button — not using MUI color="primary" so we can apply gradient
  ctaButton: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    background: 'linear-gradient(168.73deg, #1d6eed 0%, #1557c8 100%)',
    boxShadow: '0px 4px 8px rgba(29,110,237,0.35)',
    color: '#ffffff',
    fontFamily: 'Poppins, sans-serif',
    fontWeight: 700,
    fontSize: 14,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.2s',
    '&:hover': {
      opacity: 0.92,
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
  cancelButton: {
    width: '100%',
  },
}));

interface DeviceSelectionScreenProps {
  name: string;
  roomName: string;
  setStep: (step: Steps) => void;
}

// Signal-style connection bars. Active bars take the quality color; inactive
// bars stay light gray so all three are always visible.
function ConnectionBars({ quality, color }: { quality: ConnectionQuality; color: string }) {
  const activeBars = quality === 'good' ? 3 : quality === 'medium' ? 2 : quality === 'poor' ? 1 : 0;
  const heights = [6, 10, 14];
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {heights.map((height, index) => (
        <rect
          key={height}
          x={index * 7}
          y={14 - height}
          width="5"
          height={height}
          rx="1.5"
          fill={index < activeBars ? color : '#e2e8f0'}
        />
      ))}
    </svg>
  );
}

// Green circled-check SVG for ok state (Figma waiting room badge glyph)
function OkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="9" cy="9" r="7.2" stroke="#10b981" strokeWidth="1.6" />
      <path d="M6 9.3l2 2 4-4.2" stroke="#10b981" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Amber warning SVG for fail/unavailable state
function WarnIcon({ color }: { color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M7.5 5.5v3M7.5 10.5h.01M1.5 12.5L7.5 2.5l6 10H1.5z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckBadge({ state }: { state: CheckState }) {
  const badgeStyle: React.CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: CHECK_BADGE_BG[state],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };
  if (state === 'pending') {
    return (
      <div style={badgeStyle}>
        <CircularProgress size={15} thickness={5} style={{ color: '#94a3b8' }} />
      </div>
    );
  }
  if (state === 'ok') {
    return (
      <div style={badgeStyle}>
        <OkIcon />
      </div>
    );
  }
  // fail or unavailable
  return (
    <div style={badgeStyle}>
      <WarnIcon color={state === 'fail' ? '#ef4444' : '#94a3b8'} />
    </div>
  );
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

  // Consent modal state: shown when the CV pipeline is enabled, the user is a student,
  // and they have not yet consented for this room in the current session.
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  // Lets the user dismiss the lighting warning banner (the × was previously inert).
  const [lightingDismissed, setLightingDismissed] = useState(false);

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

  // Labels must agree with the state: a failed check reads "no detectado",
  // never the positive copy next to a warning icon.
  const deviceChecks: Array<{ label: string; state: CheckState }> = [
    {
      label: hasAudioInputDevices ? 'Micrófono detectado' : 'Micrófono no detectado',
      state: hasAudioInputDevices ? 'ok' : 'fail',
    },
    {
      label: hasVideoInputDevices ? 'Cámara detectada' : 'Cámara no detectada',
      state: hasVideoInputDevices ? 'ok' : 'fail',
    },
    {
      label: audioOutputDevices.length > 0 ? 'Altavoces funcionando' : 'Altavoces no detectados',
      state: audioOutputDevices.length > 0 ? 'ok' : 'fail',
    },
    {
      label: isCameraOff
        ? 'Iluminación (cámara apagada)'
        : lightingState === 'fail'
        ? 'Iluminación insuficiente'
        : 'Iluminación adecuada',
      state: lightingState,
    },
  ];

  // Reveal the checks sequentially (top to bottom) so detection reads as a
  // running check rather than resolving all at once. Rows past the reveal
  // frontier stay in the 'pending' (spinner) state.
  const revealedChecks = useStaggeredReveal(deviceChecks.length);

  /** Executes the actual join sequence after all gates (consent, etc.) have passed. */
  const doJoin = () => {
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

  /**
   * Called when the "Entrar a la sala" button is clicked.
   *
   * When the CV attention pipeline is enabled (REACT_APP_ENABLE_ATTENTION_CV === 'true'),
   * students must explicitly consent before joining. Teachers are never gated.
   * A student who already consented for this room (persisted in sessionStorage) is
   * not re-prompted — this covers auto-rejoin after a page refresh.
   */
  const handleJoin = () => {
    const cvEnabled = process.env.REACT_APP_ENABLE_ATTENTION_CV === 'true';
    const isTeacher = isTeacherIdentity(name);

    if (cvEnabled && !isTeacher && !hasConsent(roomName)) {
      // Show the consent modal; doJoin is deferred until the student accepts.
      setConsentModalOpen(true);
      return;
    }

    doJoin();
  };

  const handleConsentAccept = () => {
    saveConsent(roomName);
    setConsentModalOpen(false);
    doJoin();
  };

  const handleConsentDecline = () => {
    setConsentModalOpen(false);
    // Student chose not to consent — stay on the device-selection screen.
  };

  if (isFetching || isConnecting) {
    return (
      <div className={classes.screenWrapper}>
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
      </div>
    );
  }

  return (
    <div className={classes.screenWrapper}>
      {/* Page heading */}
      <div className={classes.titleBlock}>
        <Typography className={classes.pageTitle} component="h1">
          Sala de Espera
        </Typography>
        <Typography className={classes.subtitle}>
          Verifica tus dispositivos antes de entrar · Clase:{' '}
          <strong className={classes.subtitleBold}>{roomName}</strong>
        </Typography>
      </div>

      {/* Lighting warning — only shown when the live luminance check finds the scene too dark. */}
      {lighting.status === 'low' && !lightingDismissed && (
        <div className={classes.lightingBanner} role="note" aria-label="Verificación de iluminación">
          <div className={classes.lightingBannerIconWrap}>
            <WarningIcon style={{ fontSize: 17, color: '#ffb800' }} />
          </div>
          <div className={classes.lightingBannerBody}>
            <div className={classes.lightingBannerTitle}>
              Condiciones de iluminación insuficientes para análisis de atención
            </div>
            <div className={classes.lightingBannerSub}>
              Mejora la iluminación de tu entorno para que el sistema pueda analizar tu atención correctamente.
            </div>
          </div>
          <button
            className={classes.lightingBannerClose}
            aria-label="Cerrar aviso"
            onClick={() => setLightingDismissed(true)}
          >
            ×
          </button>
        </div>
      )}

      <Grid container spacing={2}>
        {/* Preview + device controls */}
        <Grid item md={8} sm={12} xs={12}>
          <div className={classes.localPreviewContainer}>
            <LocalVideoPreview identity={name}>
              <ToggleAudioButton className={classes.previewToggle} disabled={disableButtons} />
              <ToggleVideoButton className={classes.previewToggle} disabled={disableButtons} />
            </LocalVideoPreview>
          </div>
          <div className={classes.mobileButtonBar}>
            <Hidden mdUp>
              <ToggleAudioButton className={classes.mobileButton} disabled={disableButtons} />
              <ToggleVideoButton className={classes.mobileButton} disabled={disableButtons} />
              <SettingsMenu mobileButtonClass={classes.mobileButton} />
            </Hidden>
          </div>

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

            {/* Connection quality section */}
            <div className={classes.panelGroup}>
              <span className={classes.sectionLabel}>Calidad de conexión</span>
              <div className={classes.connectionPill}>
                <WifiIcon style={{ fontSize: 15, color: CONNECTION_BAR_COLOR[connection.quality] }} />
                <span className={classes.connectionLabel}>{CONNECTION_QUALITY_LABEL[connection.quality]}</span>
                <ConnectionBars quality={connection.quality} color={CONNECTION_BAR_COLOR[connection.quality]} />
              </div>
            </div>

            {/* Device checks section */}
            <div className={classes.panelGroup}>
              <span className={classes.sectionLabel}>Estado de dispositivos</span>
              <div className={classes.checkList}>
                {deviceChecks.map((item, index) => {
                  // Until this row's turn arrives, show the spinner regardless of
                  // its (already-known) real state.
                  const effectiveState: CheckState = index < revealedChecks ? item.state : 'pending';
                  const textColor = CHECK_TEXT_COLOR[effectiveState];
                  return (
                    <div key={item.label} className={classes.checkRow}>
                      <CheckBadge state={effectiveState} />
                      <span className={classes.checkText} style={{ color: textColor }}>
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Privacy card */}
            <div className={classes.privacy}>
              <div className={classes.privacyHeader}>
                <SecurityIcon style={{ fontSize: 15, color: '#1d6eed', marginTop: 1, flexShrink: 0 }} />
                <span className={classes.privacyTitle}>Privacidad de datos faciales</span>
              </div>
              <Typography className={classes.privacyText}>
                El análisis de atención se procesa{' '}
                <strong style={{ fontWeight: 700, color: '#64748b' }}>localmente</strong>. No se almacenan datos
                faciales.
              </Typography>
              <a href="/security" className={classes.privacyLink}>
                Política de privacidad →
              </a>
            </div>

            {/* CTA + cancel */}
            <div className={classes.enterBlock}>
              <button className={classes.ctaButton} data-cy-join-now onClick={handleJoin} disabled={disableButtons}>
                Entrar a la sala →
              </button>
              <Button
                variant="outlined"
                color="primary"
                className={classes.cancelButton}
                onClick={() => setStep(Steps.roomNameStep)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </Grid>
      </Grid>

      {process.env.REACT_APP_ENABLE_ATTENTION_CV === 'true' && (
        <AttentionConsentModal
          open={consentModalOpen}
          onAccept={handleConsentAccept}
          onDecline={handleConsentDecline}
        />
      )}
    </div>
  );
}
