import React from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Container from '@material-ui/core/Container';
import Typography from '@material-ui/core/Typography';
import Paper from '@material-ui/core/Paper';
import VideocamIcon from '@material-ui/icons/Videocam';
import ChatIcon from '@material-ui/icons/Chat';
import TrackChangesIcon from '@material-ui/icons/TrackChanges';
import PanToolIcon from '@material-ui/icons/PanTool';
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import RefreshIcon from '@material-ui/icons/Refresh';
import MenuBookIcon from '@material-ui/icons/MenuBook';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import DoneIcon from '@material-ui/icons/Done';
import AttendiaLogo from '../Brand/AttendiaLogo';
import goBackFromStandalonePage from '../../utils/goBackFromStandalonePage';

interface CardAccent {
  topBar: string;
  iconBg: string;
  bulletBg: string;
  iconColor: string;
}

interface ManualSection {
  id: string;
  icon: React.ReactNode;
  accent: CardAccent;
  categoryPill: string;
  title: string;
  description: string;
  bullets: string[];
}

const accentBlue: CardAccent = { topBar: '#1d6eed', iconBg: '#ebf3ff', bulletBg: '#ebf3ff', iconColor: '#1d6eed' };
const accentGreen: CardAccent = { topBar: '#059669', iconBg: '#d1fae5', bulletBg: '#d1fae5', iconColor: '#059669' };
const accentAmber: CardAccent = { topBar: '#ffb800', iconBg: '#fff8e1', bulletBg: '#fff8e1', iconColor: '#d97706' };
const accentNavy: CardAccent = { topBar: '#1d2f6f', iconBg: '#e3edfb', bulletBg: '#e3edfb', iconColor: '#1d2f6f' };
const accentRed: CardAccent = { topBar: '#dc2626', iconBg: '#fee2e2', bulletBg: '#fee2e2', iconColor: '#dc2626' };

// Manual content — describes ONLY features that actually exist in the room. Keep
// this in sync with the in-room behaviour; the onboarding tutorial is the short
// version of this same material.
const sections: ManualSection[] = [
  {
    id: 'controls',
    icon: <VideocamIcon style={{ fontSize: 20 }} />,
    accent: accentBlue,
    categoryPill: 'BARRA DE HERRAMIENTAS',
    title: 'Controles de cámara y micrófono',
    description:
      'Gestiona tu cámara, micrófono y pantalla desde la barra de herramientas inferior. Puedes activarlos o desactivarlos en cualquier momento durante la sesión.',
    bullets: ['Silenciar o activar tu micrófono', 'Iniciar o detener tu cámara', 'Compartir tu pantalla con la sala'],
  },
  {
    id: 'panel',
    icon: <ChatIcon style={{ fontSize: 20 }} />,
    accent: accentGreen,
    categoryPill: 'PANEL DERECHO',
    title: 'Atención, detalle individual y chat',
    description:
      'El panel derecho reúne la información de la sesión. El profesor ve la atención del grupo, el detalle por estudiante y el chat; el estudiante ve el chat de la sesión.',
    bullets: [
      'Atención del grupo en tiempo real',
      'Detalle individual por estudiante (vista del profesor)',
      'Chat con el profesor y la lista de participantes',
    ],
  },
  {
    id: 'attention',
    icon: <TrackChangesIcon style={{ fontSize: 20 }} />,
    accent: accentAmber,
    categoryPill: 'ANÁLISIS LOCAL',
    title: 'Detección de atención',
    description:
      'El análisis de atención se ejecuta de forma local en tu navegador a partir de la mirada y la orientación de la cabeza. Ninguna imagen sale de tu dispositivo: solo se comparte un índice numérico. Está deshabilitado de forma predeterminada y requiere tu consentimiento.',
    bullets: [
      'El procesamiento corre en tu dispositivo, nunca sale de él',
      'Solo se transmite un índice de atención, nunca imágenes',
      'Deshabilitado por defecto; requiere consentimiento del participante',
    ],
  },
  {
    id: 'raise-hand',
    icon: <PanToolIcon style={{ fontSize: 20 }} />,
    accent: accentNavy,
    categoryPill: 'PARTICIPACIÓN',
    title: 'Levantar la mano y turnos',
    description:
      'Pide la palabra con el botón "Levantar mano". El profesor ve la cola de manos levantadas y puede otorgar el turno; cuando es tu turno recibes un aviso.',
    bullets: [
      'Botón "Levantar mano" en la barra de herramientas',
      'El profesor ve la cola y otorga el turno',
      'Aviso "es tu turno" cuando el profesor te habilita',
    ],
  },
  {
    id: 'recording',
    icon: <FiberManualRecordIcon style={{ fontSize: 20 }} />,
    accent: accentRed,
    categoryPill: 'SOLO PROFESOR',
    title: 'Grabación de la sesión',
    description:
      'El profesor puede grabar la sesión desde el control "Grabar". Mientras la grabación está activa, un indicador REC es visible para todos los participantes.',
    bullets: [
      'Disponible solo para el profesor',
      'Indicador REC visible mientras graba',
      'No disponible en salas peer-to-peer / go',
    ],
  },
  {
    id: 'rejoin',
    icon: <RefreshIcon style={{ fontSize: 20 }} />,
    accent: accentBlue,
    categoryPill: 'RECONEXIÓN',
    title: 'Si recargas la página',
    description:
      'Un refresco del navegador no te saca de la clase: la sesión se reconecta automáticamente con tu misma identidad. Solo el botón "Salir" termina la sesión de forma intencional.',
    bullets: [
      'Recargar la página reconecta a la misma sala',
      'Se conserva tu identidad y tu rol',
      '"Salir" cierra la sesión y no reconecta',
    ],
  },
];

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    backgroundColor: theme.palette.background.default,
    minHeight: '100vh',
    position: 'relative',
  },
  nav: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backgroundColor: 'rgba(255,255,255,0.9)',
    backdropFilter: 'blur(8px)',
    borderBottom: '1px solid #e2ecf9',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    padding: theme.spacing(1.75, 4.5),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(1, 2),
    },
  },
  navLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    textDecoration: 'none',
  },
  navDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#e2ecf9',
    flexShrink: 0,
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: theme.spacing(0.75, 1.25),
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: theme.palette.text.secondary,
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 500,
    fontSize: '0.8125rem',
    borderRadius: 8,
    '&:hover': {
      backgroundColor: theme.palette.background.default,
      color: theme.palette.text.primary,
    },
  },
  navSpacer: {
    flex: 1,
  },
  manualChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    backgroundColor: '#ebf3ff',
    border: '1px solid rgba(29,110,237,0.18)',
    borderRadius: 20,
    padding: theme.spacing(0.75, 1.875),
  },
  manualChipIcon: {
    fontSize: 13,
    color: theme.palette.primary.main,
  },
  manualChipText: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.75rem',
    color: theme.palette.primary.main,
    lineHeight: 1.5,
    whiteSpace: 'nowrap',
  },
  page: {
    maxWidth: 780,
    paddingTop: theme.spacing(5),
    paddingBottom: theme.spacing(7.5),
  },
  pageHeading: {
    marginBottom: theme.spacing(4),
  },
  h1: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 800,
    fontSize: '1.75rem',
    color: theme.palette.text.primary,
    letterSpacing: '-0.02em',
    lineHeight: 1.25,
    marginBottom: theme.spacing(1.25),
  },
  subtitle: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
    lineHeight: 1.6,
    maxWidth: 560,
  },
  sections: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  card: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2ecf9',
    borderRadius: 20,
    boxShadow: '0px 2px 12px 0px rgba(29,110,237,0.08), 0px 1px 3px 0px rgba(0,0,0,0.04)',
    overflow: 'hidden',
  },
  cardTopBar: {
    height: 3,
    width: '100%',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: theme.spacing(2.5, 3),
    paddingBottom: theme.spacing(2.125),
    borderBottom: '1px solid #e2ecf9',
  },
  cardIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardMeta: {
    flex: 1,
  },
  categoryPill: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 700,
    fontSize: '0.65rem',
    letterSpacing: '0.08em',
    color: theme.palette.text.secondary,
    marginBottom: 2,
  },
  cardTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '1rem',
    color: theme.palette.text.primary,
  },
  cardBody: {
    padding: theme.spacing(2.5, 3),
  },
  description: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '0.8125rem',
    color: theme.palette.text.primary,
    lineHeight: 1.65,
    margin: 0,
    marginBottom: theme.spacing(2),
  },
  bullets: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.25),
  },
  bulletRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  bulletIconWrapper: {
    width: 20,
    height: 20,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bulletIcon: {
    fontSize: 13,
  },
  bulletText: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '0.8125rem',
    color: theme.palette.text.primary,
    lineHeight: 1.5,
  },
}));

function BulletItem({ text, bulletBg, iconColor }: { text: string; bulletBg: string; iconColor: string }) {
  const classes = useStyles();
  return (
    <div className={classes.bulletRow}>
      <div className={classes.bulletIconWrapper} style={{ backgroundColor: bulletBg }}>
        <DoneIcon className={classes.bulletIcon} style={{ color: iconColor }} />
      </div>
      <span className={classes.bulletText}>{text}</span>
    </div>
  );
}

function ManualCard({ section }: { section: ManualSection }) {
  const classes = useStyles();
  const { accent } = section;
  return (
    <Paper className={classes.card} elevation={0} square={false}>
      <div className={classes.cardTopBar} style={{ backgroundColor: accent.topBar }} />
      <div className={classes.cardHeader}>
        <div className={classes.cardIconBox} style={{ backgroundColor: accent.iconBg }}>
          <span style={{ color: accent.iconColor, display: 'flex', alignItems: 'center' }}>{section.icon}</span>
        </div>
        <div className={classes.cardMeta}>
          <div className={classes.categoryPill}>{section.categoryPill}</div>
          <div className={classes.cardTitle}>{section.title}</div>
        </div>
      </div>
      <div className={classes.cardBody}>
        <p className={classes.description}>{section.description}</p>
        <div className={classes.bullets}>
          {section.bullets.map(bullet => (
            <BulletItem key={bullet} text={bullet} bulletBg={accent.bulletBg} iconColor={accent.iconColor} />
          ))}
        </div>
      </div>
    </Paper>
  );
}

/**
 * Full in-app user manual. A plain route (`/manual`) OUTSIDE PrivateRoute/VideoApp,
 * mirroring SecurityPage — opened in a NEW TAB from the onboarding tutorial so the
 * live Twilio room is never torn down. Content documents only real room features.
 */
export default function ManualPage() {
  const classes = useStyles();

  const handleGoBack = () => {
    goBackFromStandalonePage();
  };

  return (
    <div className={classes.root} data-testid="manual-page">
      <nav className={classes.nav}>
        <div className={classes.navLogo}>
          <AttendiaLogo variant="full" size={28} />
        </div>

        <div className={classes.navDivider} />

        <button className={classes.backButton} onClick={handleGoBack} data-testid="manual-back">
          <ChevronLeftIcon style={{ fontSize: 16 }} />
          Volver
        </button>

        <div className={classes.navSpacer} />

        <div className={classes.manualChip}>
          <MenuBookIcon className={classes.manualChipIcon} />
          <span className={classes.manualChipText}>Manual de uso</span>
        </div>
      </nav>

      <Container className={classes.page} maxWidth={false}>
        <div className={classes.pageHeading}>
          <Typography variant="h1" className={classes.h1}>
            Manual de uso
          </Typography>
          <p className={classes.subtitle}>
            Guía completa de las funciones de la sala de clase: controles, participación, atención y reconexión.
          </p>
        </div>

        <div className={classes.sections} data-testid="manual-sections">
          {sections.map(section => (
            <ManualCard key={section.id} section={section} />
          ))}
        </div>
      </Container>
    </div>
  );
}
