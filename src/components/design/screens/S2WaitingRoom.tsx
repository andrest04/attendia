import React, { useState } from 'react';
import { makeStyles, createStyles, Theme } from '@material-ui/core/styles';
import { Button, Typography } from '@material-ui/core';
import VideocamIcon from '@material-ui/icons/Videocam';
import VideocamOffIcon from '@material-ui/icons/VideocamOff';
import MicIcon from '@material-ui/icons/Mic';
import MicOffIcon from '@material-ui/icons/MicOff';
import WarningIcon from '@material-ui/icons/Warning';
import SecurityIcon from '@material-ui/icons/Security';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';

import USTag from '../USTag';
import ConnectionIndicator from '../shared/ConnectionIndicator';
import { wf, GALLERY_NAV_HEIGHT } from '../wireframe';
import { mockData } from '../data';

const MAX_W = 880;

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      minHeight: `calc(100vh - ${GALLERY_NAV_HEIGHT}px)`,
      backgroundColor: wf.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
    },

    /* Title */
    titleBlock: { width: '100%', maxWidth: MAX_W, marginBottom: 24 },
    titleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    title: { color: wf.ink, fontSize: 18, fontWeight: 600 },
    subtitle: { fontSize: 12, color: wf.gray500, marginTop: 4 },
    epicTag: {
      padding: '4px 10px',
      backgroundColor: wf.bg,
      borderRadius: 3,
      border: `1px solid ${wf.gray300}`,
      fontSize: 10,
      color: wf.gray500,
      whiteSpace: 'nowrap',
    },

    /* Lighting banner */
    banner: {
      width: '100%',
      maxWidth: MAX_W,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      marginBottom: 16,
      backgroundColor: wf.gray300,
      border: `1px solid ${wf.gray500}`,
      borderRadius: 6,
    },
    bannerBody: { flex: 1 },
    bannerTitle: { fontSize: 12, color: wf.gray700, fontWeight: 600 },
    bannerText: { fontSize: 11, color: wf.gray500, marginTop: 2 },

    /* Card */
    card: {
      width: '100%',
      maxWidth: MAX_W,
      backgroundColor: wf.white,
      border: `1px solid ${wf.gray300}`,
      borderRadius: 8,
      overflow: 'hidden',
    },
    cardInner: {
      display: 'flex',
      [theme.breakpoints.down('xs')]: { flexDirection: 'column' },
    },

    /* Preview side */
    previewSide: { flex: 1, display: 'flex', flexDirection: 'column' },
    preview: {
      backgroundColor: wf.gray300,
      height: 460,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      position: 'relative',
    },
    previewText: { fontSize: 13, color: wf.gray500 },
    twilioTag: {
      position: 'absolute',
      top: 8,
      left: 8,
      padding: '2px 8px',
      backgroundColor: wf.gray700,
      borderRadius: 3,
      fontSize: 9,
      color: wf.white,
      fontStyle: 'italic',
    },
    previewUs: { position: 'absolute', bottom: 8, left: 8 },

    /* Controls */
    controls: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      padding: '16px 24px',
      borderTop: `1px solid ${wf.gray300}`,
    },
    control: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
    toggleBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      padding: 0,
    },
    controlLabel: { fontSize: 10, color: wf.gray500 },

    /* Right panel */
    panel: {
      width: 260,
      borderLeft: `1px solid ${wf.gray300}`,
      backgroundColor: '#FAFAFA',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      padding: 20,
      [theme.breakpoints.down('xs')]: { width: 'auto', borderLeft: 'none', borderTop: `1px solid ${wf.gray300}` },
    },
    panelTitle: { color: wf.ink, fontSize: 14, fontWeight: 600 },
    panelGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
    panelLabel: { fontSize: 12, color: wf.gray700, fontWeight: 500 },

    checkRow: { display: 'flex', alignItems: 'center', gap: 8 },
    checkText: { fontSize: 11 },

    privacy: {
      padding: 10,
      backgroundColor: wf.bg,
      border: `1px dashed ${wf.gray300}`,
      borderRadius: 4,
    },
    privacyRow: { display: 'flex', alignItems: 'flex-start', gap: 6 },
    privacyTitle: { fontSize: 11, color: wf.gray700, fontWeight: 500 },
    privacyText: { fontSize: 10, color: wf.gray500, margin: '3px 0' },
    privacyLink: { fontSize: 10, color: wf.gray700, textDecoration: 'underline', cursor: 'pointer' },

    enterBlock: { marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4 },
    cta: {
      width: '100%',
      padding: 12,
      borderRadius: 6,
      fontSize: 14,
      fontWeight: 600,
      color: wf.white,
      textTransform: 'none',
      backgroundColor: wf.gray700,
      '&:hover': { backgroundColor: wf.gray700, opacity: 0.92 },
    },
  })
);

/** S2 — Waiting room / pre-session check. Design mock (US07, US11, US22, US33, US37). */
export default function S2WaitingRoom() {
  const classes = useStyles();
  const { session, waitingRoom } = mockData;
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  return (
    <div className={classes.root}>
      {/* Title */}
      <div className={classes.titleBlock}>
        <div className={classes.titleRow}>
          <div>
            <Typography className={classes.title}>Sala de Espera</Typography>
            <Typography className={classes.subtitle}>
              Verifica tus dispositivos antes de entrar · Clase: <strong>{session.courseName}</strong>
            </Typography>
          </div>
          <span className={classes.epicTag}>EP03 — Pre-sesión</span>
        </div>
      </div>

      {/* Lighting warning */}
      {!waitingRoom.lightingOk && (
        <div className={classes.banner}>
          <WarningIcon style={{ fontSize: 18, color: wf.gray700 }} />
          <div className={classes.bannerBody}>
            <Typography className={classes.bannerTitle}>
              Condiciones de iluminación insuficientes para análisis de atención
            </Typography>
            <Typography className={classes.bannerText}>
              Mejora la iluminación de tu entorno para que el sistema pueda analizar tu atención correctamente.
            </Typography>
          </div>
          <USTag ids={['US22']} />
        </div>
      )}

      {/* Main card */}
      <div className={classes.card}>
        <div className={classes.cardInner}>
          {/* Camera preview */}
          <div className={classes.previewSide}>
            <div className={classes.preview}>
              {camOn ? (
                <>
                  <VideocamIcon style={{ fontSize: 64, color: wf.gray500 }} />
                  <span className={classes.previewText}>Vista previa de cámara</span>
                  <span className={classes.twilioTag}>Twilio Video</span>
                </>
              ) : (
                <>
                  <VideocamOffIcon style={{ fontSize: 64, color: wf.gray500 }} />
                  <span className={classes.previewText}>Cámara desactivada</span>
                </>
              )}
              <USTag ids={['US07', 'US33']} className={classes.previewUs} />
            </div>

            {/* Device controls */}
            <div className={classes.controls}>
              <div className={classes.control}>
                <button
                  type="button"
                  className={classes.toggleBtn}
                  onClick={() => setMicOn(v => !v)}
                  style={{
                    border: `2px solid ${micOn ? wf.gray700 : wf.gray500}`,
                    backgroundColor: micOn ? wf.gray700 : wf.bg,
                  }}
                >
                  {micOn ? (
                    <MicIcon style={{ fontSize: 20, color: wf.white }} />
                  ) : (
                    <MicOffIcon style={{ fontSize: 20, color: wf.gray500 }} />
                  )}
                </button>
                <span className={classes.controlLabel}>{micOn ? 'Micrófono activo' : 'Micrófono apagado'}</span>
                <USTag ids={['US07']} />
              </div>

              <div className={classes.control}>
                <button
                  type="button"
                  className={classes.toggleBtn}
                  onClick={() => setCamOn(v => !v)}
                  style={{
                    border: `2px solid ${camOn ? wf.gray700 : wf.gray500}`,
                    backgroundColor: camOn ? wf.gray700 : wf.bg,
                  }}
                >
                  {camOn ? (
                    <VideocamIcon style={{ fontSize: 20, color: wf.white }} />
                  ) : (
                    <VideocamOffIcon style={{ fontSize: 20, color: wf.gray500 }} />
                  )}
                </button>
                <span className={classes.controlLabel}>{camOn ? 'Cámara activa' : 'Cámara apagada'}</span>
                <USTag ids={['US07']} />
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className={classes.panel}>
            <Typography className={classes.panelTitle}>Verificación previa</Typography>

            <div className={classes.panelGroup}>
              <span className={classes.panelLabel}>Calidad de conexión</span>
              <ConnectionIndicator quality={waitingRoom.connectionQuality} showLabel showUS />
            </div>

            <div className={classes.panelGroup}>
              <span className={classes.panelLabel}>Estado de dispositivos</span>
              {waitingRoom.deviceChecks.map(item => (
                <div key={item.label} className={classes.checkRow}>
                  {item.ok ? (
                    <CheckCircleIcon style={{ fontSize: 13, color: wf.gray700 }} />
                  ) : (
                    <WarningIcon style={{ fontSize: 13, color: wf.gray500 }} />
                  )}
                  <span className={classes.checkText} style={{ color: item.ok ? wf.gray700 : wf.gray500 }}>
                    {item.label}
                  </span>
                </div>
              ))}
              <USTag ids={['US22']} />
            </div>

            <div className={classes.privacy}>
              <div className={classes.privacyRow}>
                <SecurityIcon style={{ fontSize: 12, color: wf.gray500, marginTop: 2 }} />
                <div>
                  <Typography className={classes.privacyTitle}>Privacidad de datos faciales</Typography>
                  <Typography className={classes.privacyText}>
                    El análisis de atención se procesa localmente. No se almacenan datos faciales.
                  </Typography>
                  <span className={classes.privacyLink}>Política de privacidad →</span>
                  <USTag ids={['US37']} />
                </div>
              </div>
            </div>

            <div className={classes.enterBlock}>
              <Button className={classes.cta} disableElevation>
                Entrar a la sala
              </Button>
              <USTag ids={['US07', 'US33', 'US37']} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
