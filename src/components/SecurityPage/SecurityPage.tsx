import React from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Container from '@material-ui/core/Container';
import Typography from '@material-ui/core/Typography';
import Paper from '@material-ui/core/Paper';
import LockIcon from '@material-ui/icons/Lock';
import VpnKeyIcon from '@material-ui/icons/VpnKey';
import VisibilityIcon from '@material-ui/icons/Visibility';
import LanguageIcon from '@material-ui/icons/Language';
import SecurityIcon from '@material-ui/icons/Security';
import ScheduleIcon from '@material-ui/icons/Schedule';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import DoneIcon from '@material-ui/icons/Done';
import AttendiaLogo from '../Brand/AttendiaLogo';

type SecurityStatus = 'activo' | 'en-desarrollo';

interface CardAccent {
  topBar: string;
  iconBg: string;
  bulletBg: string;
  iconColor: string;
}

interface SecuritySection {
  id: string;
  icon: React.ReactNode;
  accent: CardAccent;
  categoryPill: string;
  status: SecurityStatus;
  title: string;
  description: string;
  bullets: string[];
}

const accentBlue: CardAccent = {
  topBar: '#1d6eed',
  iconBg: '#ebf3ff',
  bulletBg: '#ebf3ff',
  iconColor: '#1d6eed',
};

const accentGreen: CardAccent = {
  topBar: '#059669',
  iconBg: '#d1fae5',
  bulletBg: '#d1fae5',
  iconColor: '#059669',
};

const accentAmber: CardAccent = {
  topBar: '#ffb800',
  iconBg: '#fff8e1',
  bulletBg: '#fff8e1',
  iconColor: '#d97706',
};

const accentNavy: CardAccent = {
  topBar: '#1d2f6f',
  iconBg: '#e3edfb',
  bulletBg: '#e3edfb',
  iconColor: '#1d2f6f',
};

const sections: SecuritySection[] = [
  {
    id: 'srtp',
    icon: <LockIcon style={{ fontSize: 20 }} />,
    accent: accentBlue,
    categoryPill: 'SRTP · TLS',
    status: 'activo',
    title: 'Cifrado de transmisión',
    description:
      'Todos los flujos de audio, video y datos se cifran mediante SRTP (Secure Real-time Transport Protocol) y TLS (Transport Layer Security), garantizando la confidencialidad e integridad de los medios en tránsito a través de la infraestructura Twilio Video.',
    bullets: [
      'SRTP para todos los flujos de audio y video',
      'TLS para señalización y datos de control',
      'Claves de sesión negociadas por DTLS-SRTP',
    ],
  },
  {
    id: 'jwt',
    icon: <VpnKeyIcon style={{ fontSize: 20 }} />,
    accent: accentGreen,
    categoryPill: 'JWT · SESSION',
    status: 'activo',
    title: 'Tokens de acceso de sesión',
    description:
      'El acceso a cada sala de clase se gestiona mediante tokens JWT únicos generados por el servidor. Cada token es específico para cada sesión y participante, expirando automáticamente al cerrar la sesión o transcurrido el período de tiempo configurado.',
    bullets: [
      'Tokens firmados con algoritmos RS256',
      'Expiración automática configurable (default: 4h)',
      'Invalidación inmediata al cerrar sesión',
    ],
  },
  {
    id: 'facial',
    icon: <VisibilityIcon style={{ fontSize: 20 }} />,
    accent: accentAmber,
    categoryPill: 'LOCAL ONLY',
    status: 'activo',
    title: 'Datos faciales — Procesamiento local',
    description:
      'El análisis de atención basado en visión por computadora (detección de rostro, análisis de postura, detección de parpadeo, dirección de mirada) se realiza exclusivamente en el dispositivo del usuario mediante TensorFlow.js. Ningún dato facial se transmite a servidores externos.',
    bullets: [
      'TensorFlow.js ejecutado en el navegador del usuario',
      'El procesamiento de IA nunca abandona el dispositivo',
      'Solo se transmiten índices numéricos agregados de atención',
    ],
  },
  {
    id: 'availability',
    icon: <LanguageIcon style={{ fontSize: 20 }} />,
    accent: accentNavy,
    categoryPill: 'GLOBAL SFU',
    status: 'activo',
    title: 'Disponibilidad del servicio',
    description:
      'La plataforma garantiza disponibilidad del 99.95% para usuarios activos, apoyada en la infraestructura global de Twilio Video. En caso de degradación, el sistema ajusta adaptativamente la calidad del video para mantener la continuidad del servicio.',
    bullets: [
      'SFU distribuido en múltiples regiones globales',
      'Reconexión automática con backoff exponencial',
      'Reducción adaptativa de bitrate ante pérdida de paquetes',
    ],
  },
];

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    backgroundColor: theme.palette.background.default,
    minHeight: '100vh',
    position: 'relative',
  },
  // Decorative background circles
  bgCircle1: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: '50%',
    background: 'rgba(29,110,237,0.06)',
    pointerEvents: 'none',
  },
  bgCircle2: {
    position: 'absolute',
    bottom: 200,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: '50%',
    background: 'rgba(29,47,111,0.05)',
    pointerEvents: 'none',
  },
  bgCircle3: {
    position: 'absolute',
    bottom: 60,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 120,
    height: 120,
    borderRadius: '50%',
    background: 'rgba(29,110,237,0.05)',
    pointerEvents: 'none',
  },
  // Sticky header / nav bar
  nav: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backgroundColor: 'rgba(255,255,255,0.9)',
    backdropFilter: 'blur(8px)',
    borderBottom: '1px solid #e2ecf9',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(1.75, 4.5),
  },
  navLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    textDecoration: 'none',
  },
  navLogoIcon: {
    width: 28,
    height: 28,
    backgroundColor: theme.palette.primary.main,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLogoIconInner: {
    color: '#fff',
    fontSize: 16,
  },
  navLogoText: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '1.1rem',
    color: theme.palette.text.primary,
    letterSpacing: '-0.01em',
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
  backChevron: {
    fontSize: 16,
  },
  navSpacer: {
    flex: 1,
  },
  securityChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    backgroundColor: '#ebf3ff',
    border: '1px solid rgba(29,110,237,0.18)',
    borderRadius: 20,
    padding: theme.spacing(0.75, 1.875),
  },
  securityChipIcon: {
    fontSize: 13,
    color: theme.palette.primary.main,
  },
  securityChipText: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 600,
    fontSize: '0.75rem',
    color: theme.palette.primary.main,
    lineHeight: 1.5,
    whiteSpace: 'nowrap',
  },
  // Main content
  contentWrapper: {
    position: 'relative',
    zIndex: 1,
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
  // Cards
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
    minWidth: 0,
  },
  categoryPill: {
    display: 'inline-block',
    backgroundColor: '#f0f5ff',
    border: '1px solid #e2ecf9',
    borderRadius: 20,
    padding: '3.5px 10px',
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '0.625rem',
    color: '#94a3b8',
    letterSpacing: '0.06em',
    lineHeight: 1.5,
    marginBottom: theme.spacing(0.25),
  },
  cardTitle: {
    fontFamily: 'Poppins, Inter, sans-serif',
    fontWeight: 700,
    fontSize: '0.9375rem',
    color: theme.palette.text.primary,
    lineHeight: 1.4,
  },
  cardBody: {
    padding: theme.spacing(2.25, 3),
  },
  description: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '0.8125rem',
    color: theme.palette.text.secondary,
    lineHeight: 1.75,
    marginBottom: theme.spacing(1.75),
  },
  bullets: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  bulletRow: {
    display: 'flex',
    alignItems: 'flex-start',
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
    marginTop: 1,
  },
  bulletIcon: {
    fontSize: 11,
  },
  bulletText: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '0.8125rem',
    color: '#353535',
    lineHeight: 1.5,
  },
  // Status pill (honesty: shown only for en-desarrollo sections)
  statusRow: {
    marginTop: theme.spacing(2),
    paddingTop: theme.spacing(1.75),
    borderTop: '1px solid #e2ecf9',
  },
  pillEnDesarrollo: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: '0.75rem',
    fontWeight: 600,
    borderRadius: 12,
    padding: '2px 10px',
    backgroundColor: '#fff8e1',
    color: '#d97706',
    fontFamily: 'Inter, sans-serif',
  },
  pillIconEnDesarrollo: {
    fontSize: '0.9rem',
    color: '#d97706',
  },
  // Footer note
  footerWrapper: {
    marginTop: theme.spacing(3),
  },
  footerCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: '#ebf3ff',
    border: '1.5px solid rgba(29,110,237,0.18)',
    borderRadius: 16,
    padding: theme.spacing(2.5, 3),
  },
  footerIconBox: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(29,110,237,0.12)',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  footerIconInner: {
    fontSize: 17,
    color: theme.palette.primary.main,
  },
  footerText: {
    fontFamily: 'Inter, sans-serif',
    fontSize: '0.8125rem',
    color: theme.palette.text.primary,
    lineHeight: 1.65,
  },
  footerBrand: {
    fontWeight: 700,
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

function SecurityCard({ section }: { section: SecuritySection }) {
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
        {section.status === 'en-desarrollo' && (
          <div className={classes.statusRow}>
            <span className={classes.pillEnDesarrollo}>
              <ScheduleIcon className={classes.pillIconEnDesarrollo} />
              En desarrollo
            </span>
          </div>
        )}
      </div>
    </Paper>
  );
}

export default function SecurityPage() {
  const classes = useStyles();

  const handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.assign('/login');
  };

  return (
    <div className={classes.root}>
      {/* Decorative background */}
      <div className={classes.bgCircle1} />
      <div className={classes.bgCircle2} />
      <div className={classes.bgCircle3} />

      {/* Nav bar */}
      <nav className={classes.nav}>
        <div className={classes.navLogo}>
          <AttendiaLogo variant="full" size={28} />
        </div>

        <div className={classes.navDivider} />

        <button className={classes.backButton} onClick={handleGoBack}>
          <ChevronLeftIcon style={{ fontSize: 16 }} />
          Volver
        </button>

        <div className={classes.navSpacer} />

        <div className={classes.securityChip}>
          <SecurityIcon className={classes.securityChipIcon} />
          <span className={classes.securityChipText}>Centro de seguridad</span>
        </div>
      </nav>

      {/* Page content */}
      <div className={classes.contentWrapper}>
        <Container className={classes.page} maxWidth={false}>
          <div className={classes.pageHeading}>
            <Typography variant="h1" className={classes.h1}>
              Seguridad y Privacidad
            </Typography>
            <p className={classes.subtitle}>
              Información sobre las medidas de seguridad, privacidad de datos y disponibilidad del servicio
              implementadas en attendia.
            </p>
          </div>

          <div className={classes.sections}>
            {sections.map(section => (
              <SecurityCard key={section.id} section={section} />
            ))}
          </div>

          <div className={classes.footerWrapper}>
            <div className={classes.footerCard}>
              <div className={classes.footerIconBox}>
                <SecurityIcon className={classes.footerIconInner} />
              </div>
              <p className={classes.footerText}>
                <strong className={classes.footerBrand}>attendia</strong>
                {
                  ' no almacena imágenes, video ni datos biométricos en ningún servidor. Todos los datos de análisis de atención son procesados localmente y solo se reportan índices numéricos agregados por sesión.'
                }
              </p>
            </div>
          </div>
        </Container>
      </div>
    </div>
  );
}
