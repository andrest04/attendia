import React from 'react';
import { makeStyles, createStyles, Theme } from '@material-ui/core/styles';
import { Button, TextField, Typography } from '@material-ui/core';
import ComputerIcon from '@material-ui/icons/Computer';
import LockIcon from '@material-ui/icons/Lock';
import SecurityIcon from '@material-ui/icons/Security';
import PersonIcon from '@material-ui/icons/Person';
import MenuBookIcon from '@material-ui/icons/MenuBook';
import TuneIcon from '@material-ui/icons/Tune';

import USTag from '../USTag';
import { wf, GALLERY_NAV_HEIGHT } from '../wireframe';
import { mockData } from '../data';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      minHeight: `calc(100vh - ${GALLERY_NAV_HEIGHT}px)`,
      backgroundColor: wf.bg,
      display: 'flex',
      flexDirection: 'column',
    },

    /* Header */
    header: {
      backgroundColor: wf.white,
      borderBottom: `1px solid ${wf.gray300}`,
      padding: '20px 40px',
    },
    headerRow: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 12,
      flexWrap: 'wrap',
    },
    title: {
      color: wf.ink,
      fontSize: 22,
      fontWeight: 700,
      lineHeight: 1.2,
    },
    subtitle: {
      fontSize: 12,
      color: wf.gray500,
      marginTop: 4,
    },
    badges: {
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    badge: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 12px',
      borderRadius: 4,
      backgroundColor: wf.bg,
    },
    badgeStrong: { border: `1px solid ${wf.gray500}` },
    badgeMuted: { border: `1px solid ${wf.gray300}` },
    badgeStrongText: { fontSize: 11, color: wf.gray700 },
    badgeMutedText: { fontSize: 11, color: wf.gray500 },

    /* Main content */
    main: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    cards: {
      display: 'flex',
      gap: 32,
      width: '100%',
      maxWidth: 900,
      [theme.breakpoints.down('xs')]: {
        flexDirection: 'column',
        alignItems: 'stretch',
      },
    },
    card: {
      flex: 1,
      backgroundColor: wf.white,
      border: `1px solid ${wf.gray300}`,
      borderRadius: 8,
      padding: '28px 32px',
    },

    cardHead: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 24,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 6,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarPrimary: { backgroundColor: wf.gray700 },
    avatarSecondary: { backgroundColor: wf.gray500 },
    cardTitle: { color: wf.ink, fontSize: 16, fontWeight: 500, lineHeight: 1.2 },
    cardCaption: { fontSize: 11, color: wf.gray500 },

    epicTag: {
      padding: '4px 10px',
      backgroundColor: wf.bg,
      borderRadius: 3,
      border: `1px solid ${wf.gray300}`,
      marginBottom: 20,
      display: 'inline-block',
      fontSize: 10,
      color: wf.gray500,
    },

    /* Fields */
    field: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 },
    fieldLabel: { fontSize: 13, color: wf.gray700 },
    input: {
      '& .MuiOutlinedInput-root': {
        borderRadius: 4,
        backgroundColor: wf.white,
        fontSize: 13,
        color: wf.gray500,
      },
      '& .MuiOutlinedInput-notchedOutline': { borderColor: wf.gray500 },
      '& .MuiOutlinedInput-input': { padding: '8px 12px' },
    },

    /* Toggle (static mock) */
    rowBetween: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    toggle: {
      width: 40,
      height: 22,
      backgroundColor: wf.gray700,
      borderRadius: 11,
      position: 'relative',
    },
    toggleKnob: {
      width: 16,
      height: 16,
      backgroundColor: wf.white,
      borderRadius: '50%',
      position: 'absolute',
      top: 3,
      right: 4,
    },
    toggleState: { fontSize: 11, color: wf.gray500 },

    /* Slider (static mock) */
    sliderBlock: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 },
    sliderRow: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 },
    sliderEnds: { fontSize: 10, color: wf.gray500 },
    sliderTrack: {
      flex: 1,
      height: 6,
      backgroundColor: wf.gray300,
      borderRadius: 3,
      position: 'relative',
    },
    sliderFill: { width: '60%', height: '100%', backgroundColor: wf.gray700, borderRadius: 3 },
    sliderThumb: {
      width: 14,
      height: 14,
      backgroundColor: wf.gray700,
      borderRadius: '50%',
      position: 'absolute',
      top: '50%',
      left: '60%',
      transform: 'translate(-50%, -50%)',
      border: `2px solid ${wf.white}`,
    },

    /* Buttons — override the app's global MuiButton theme to stay grayscale */
    cta: {
      width: '100%',
      padding: 12,
      borderRadius: 6,
      fontSize: 14,
      fontWeight: 600,
      color: wf.white,
      textTransform: 'none',
      '&:hover': { opacity: 0.92 },
    },
    ctaPrimary: { backgroundColor: wf.gray700, '&:hover': { backgroundColor: wf.gray700 } },
    ctaSecondary: {
      backgroundColor: wf.gray500,
      marginTop: 16,
      '&:hover': { backgroundColor: wf.gray500 },
    },

    /* Divider column */
    divider: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      [theme.breakpoints.down('xs')]: { flexDirection: 'row' },
    },
    dividerLine: { width: 1, height: 80, backgroundColor: wf.gray300 },
    dividerOr: {
      fontSize: 11,
      color: wf.gray500,
      padding: '6px 10px',
      border: `1px solid ${wf.gray300}`,
      borderRadius: 20,
      backgroundColor: wf.white,
    },

    /* Privacy notice */
    privacy: {
      padding: 12,
      backgroundColor: wf.bg,
      border: `1px dashed ${wf.gray300}`,
      borderRadius: 6,
    },
    privacyRow: { display: 'flex', alignItems: 'flex-start', gap: 8 },
    privacyTitle: { fontSize: 12, color: wf.gray700, fontWeight: 500 },
    privacyText: { fontSize: 11, color: wf.gray500, marginTop: 4 },

    /* Footer */
    footer: {
      borderTop: `1px solid ${wf.gray300}`,
      backgroundColor: wf.white,
      padding: '12px 40px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap',
    },
    footerText: { fontSize: 11, color: wf.gray500 },
    footerLinks: { display: 'flex', gap: 16, flexWrap: 'wrap' },
    footerLink: { fontSize: 11, color: wf.gray500, textDecoration: 'underline', cursor: 'pointer' },
  })
);

interface FieldProps {
  label: string;
  placeholder: string;
  usIds?: string[];
}

function Field({ label, placeholder, usIds }: FieldProps) {
  const classes = useStyles();
  return (
    <div className={classes.field}>
      <label className={classes.fieldLabel}>{label}</label>
      <TextField
        className={classes.input}
        variant="outlined"
        placeholder={placeholder}
        InputProps={{ readOnly: true }}
        fullWidth
      />
      {usIds && <USTag ids={usIds} />}
    </div>
  );
}

/** S1 — Landing / Access page. Design mock (US01, US02, US03, US30, US33, US36, US37). */
export default function S1Access() {
  const classes = useStyles();
  const { platform } = mockData;

  return (
    <div className={classes.root}>
      {/* Header */}
      <div className={classes.header}>
        <div className={classes.headerRow}>
          <div>
            <Typography component="h1" className={classes.title}>
              {platform.name}
            </Typography>
            <Typography className={classes.subtitle}>{platform.tagline}</Typography>
          </div>
          <div className={classes.badges}>
            <div className={`${classes.badge} ${classes.badgeStrong}`}>
              <LockIcon style={{ fontSize: 14, color: wf.gray700 }} />
              <span className={classes.badgeStrongText}>Acceso seguro por token</span>
              <USTag ids={['US36']} />
            </div>
            <div className={`${classes.badge} ${classes.badgeMuted}`}>
              <ComputerIcon style={{ fontSize: 14, color: wf.gray500 }} />
              <span className={classes.badgeMutedText}>Usar desde navegador, sin instalación</span>
              <USTag ids={['US33']} />
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={classes.main}>
        <div className={classes.cards}>
          {/* LEFT — Professor: create room */}
          <div className={classes.card}>
            <div className={classes.cardHead}>
              <div className={`${classes.avatar} ${classes.avatarPrimary}`}>
                <MenuBookIcon style={{ fontSize: 18, color: wf.white }} />
              </div>
              <div>
                <Typography className={classes.cardTitle}>Profesor</Typography>
                <span className={classes.cardCaption}>Crear nueva sala de clase</span>
              </div>
            </div>

            <div className={classes.epicTag}>EP01 — Gestión de Sala</div>

            <Field label="Nombre de la sala" placeholder="Ej: Matemáticas — Grupo A" usIds={['US01']} />

            {/* Recording toggle (static mock) */}
            <div className={classes.field}>
              <div className={classes.rowBetween}>
                <label className={classes.fieldLabel}>Habilitar grabación</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className={classes.toggle}>
                    <div className={classes.toggleKnob} />
                  </div>
                  <span className={classes.toggleState}>Activo</span>
                </div>
              </div>
              <USTag ids={['US12']} />
            </div>

            {/* Proctoring sensitivity slider (static mock) */}
            <div className={classes.sliderBlock}>
              <div className={classes.rowBetween}>
                <label className={classes.fieldLabel}>Sensibilidad de proctoring</label>
                <TuneIcon style={{ fontSize: 16, color: wf.gray500 }} />
              </div>
              <div className={classes.sliderRow}>
                <span className={classes.sliderEnds}>Baja</span>
                <div className={classes.sliderTrack}>
                  <div className={classes.sliderFill} />
                  <div className={classes.sliderThumb} />
                </div>
                <span className={classes.sliderEnds}>Alta</span>
              </div>
              <USTag ids={['US30']} />
            </div>

            <Button className={`${classes.cta} ${classes.ctaPrimary}`} disableElevation>
              Crear sala
            </Button>
            <USTag ids={['US01', 'US02']} />
          </div>

          {/* Divider */}
          <div className={classes.divider}>
            <div className={classes.dividerLine} />
            <span className={classes.dividerOr}>o</span>
            <div className={classes.dividerLine} />
          </div>

          {/* RIGHT — Student: join */}
          <div className={classes.card}>
            <div className={classes.cardHead}>
              <div className={`${classes.avatar} ${classes.avatarSecondary}`}>
                <PersonIcon style={{ fontSize: 18, color: wf.white }} />
              </div>
              <div>
                <Typography className={classes.cardTitle}>Estudiante</Typography>
                <span className={classes.cardCaption}>Unirme a sala existente</span>
              </div>
            </div>

            <div className={classes.epicTag}>EP01 — Acceso de Estudiante</div>

            <Field label="Código o enlace de sala" placeholder="Ingresar código de sesión" usIds={['US02']} />
            <Field label="Tu nombre o alias (no requiere cuenta)" placeholder="Ej: Ana García" usIds={['US03']} />

            <div className={classes.privacy}>
              <div className={classes.privacyRow}>
                <SecurityIcon style={{ fontSize: 16, color: wf.gray500, marginTop: 2 }} />
                <div>
                  <Typography className={classes.privacyTitle}>Aviso de privacidad</Typography>
                  <Typography className={classes.privacyText}>
                    Al unirte aceptas el procesamiento local de imagen para análisis de atención. No se almacenan datos
                    faciales.
                  </Typography>
                  <USTag ids={['US37']} />
                </div>
              </div>
            </div>

            <Button className={`${classes.cta} ${classes.ctaSecondary}`} disableElevation>
              Unirme a la sala
            </Button>
            <USTag ids={['US02', 'US03']} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={classes.footer}>
        <span className={classes.footerText}>
          Infraestructura: <strong>{platform.infrastructure}</strong>
        </span>
        <div className={classes.footerLinks}>
          <span className={classes.footerLink}>Política de privacidad de datos faciales</span>
          <span className={classes.footerLink}>Seguridad y cifrado</span>
        </div>
      </div>
    </div>
  );
}
