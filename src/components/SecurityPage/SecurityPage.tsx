import React from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Container from '@material-ui/core/Container';
import Typography from '@material-ui/core/Typography';
import Paper from '@material-ui/core/Paper';
import Button from '@material-ui/core/Button';
import LockIcon from '@material-ui/icons/Lock';
import VpnKeyIcon from '@material-ui/icons/VpnKey';
import VisibilityIcon from '@material-ui/icons/Visibility';
import StorageIcon from '@material-ui/icons/Storage';
import SecurityIcon from '@material-ui/icons/Security';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ScheduleIcon from '@material-ui/icons/Schedule';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';

type SecurityStatus = 'activo' | 'en-desarrollo';

interface SecuritySection {
  id: string;
  icon: React.ReactNode;
  badge: string;
  status: SecurityStatus;
  title: string;
  subtitle: string;
  description: string;
  bullets: string[];
}

const sections: SecuritySection[] = [
  {
    id: 'srtp',
    icon: <LockIcon />,
    badge: 'SRTP / DTLS',
    status: 'activo',
    title: 'Cifrado de transmisión',
    subtitle: 'Protocolo de seguridad de capa de transporte para los medios',
    description:
      'Todas las transmisiones de audio, vídeo y datos se cifran mediante SRTP (Secure Real-time Transport Protocol) y DTLS (Datagram Transport Layer Security), garantizando la confidencialidad e integridad de los medios en tránsito a través de la infraestructura de Twilio Video.',
    bullets: [
      'SRTP para el cifrado de los flujos de audio y vídeo',
      'DTLS para la negociación de claves y la señalización',
      'TLS para los mensajes de control y la API REST',
      'Ningún dato viaja en texto plano',
    ],
  },
  {
    id: 'jwt',
    icon: <VpnKeyIcon />,
    badge: 'JWT TOKEN',
    status: 'activo',
    title: 'Tokens de acceso de sesión',
    subtitle: 'Autenticación sin necesidad de crear una cuenta de usuario',
    description:
      'El acceso a cada sala de clase se gestiona mediante tokens JWT de corta duración generados por el servidor. Cada token es único por sesión y participante, y expira automáticamente al finalizar la clase o tras un período de inactividad configurable.',
    bullets: [
      'Expiración configurable (por defecto: la duración de la sesión)',
      'No requiere la creación de una cuenta de usuario',
      'Tokens firmados con la clave privada del servidor',
      'Los tokens dejan de ser válidos cuando la sesión expira',
    ],
  },
  {
    id: 'facial',
    icon: <VisibilityIcon />,
    badge: 'LOCAL ONLY',
    status: 'en-desarrollo',
    title: 'Datos faciales — Procesamiento local',
    subtitle: 'Análisis de atención diseñado para no persistir datos biométricos',
    description:
      'El análisis de atención basado en visión por computadora (orientación de la cabeza, postura y detección facial) está EN DESARROLLO. Está diseñado para ejecutarse exclusivamente en el navegador del usuario; según ese diseño, ningún dato facial, imagen o modelo derivado se transmitiría ni se almacenaría en servidores externos. Esta función aún no está disponible.',
    bullets: [
      'Diseñado para procesarse 100% localmente en el navegador',
      'No se almacenarán imágenes faciales ni representaciones derivadas',
      'Solo se compartiría con el docente el índice de atención agregado (0–100)',
      'El usuario podrá desactivar el análisis en cualquier momento',
    ],
  },
  {
    id: 'availability',
    icon: <StorageIcon />,
    badge: 'RESILIENCIA',
    status: 'activo',
    title: 'Continuidad de la sesión',
    subtitle: 'Adaptación automática de la calidad para mantener la conexión',
    description:
      'La plataforma se apoya en la infraestructura global de Twilio Video. Ante congestión o degradación de la red, el sistema reduce automáticamente la calidad del vídeo para mantener la conectividad de todos los participantes.',
    bullets: [
      'Reducción automática de la resolución ante congestión de red',
      'Apoyada en la infraestructura global de Twilio Video',
      'Indicadores de calidad de red en tiempo real',
      'Pensada para sesiones grupales de clase',
    ],
  },
];

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    backgroundColor: theme.palette.background.default,
    minHeight: '100vh',
    paddingTop: theme.spacing(3.5),
    paddingBottom: theme.spacing(6),
  },
  page: {
    maxWidth: 900,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
    [theme.breakpoints.down('xs')]: {
      flexDirection: 'column',
    },
  },
  headerInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 0,
    marginBottom: theme.spacing(0.5),
    minWidth: 'auto',
    color: theme.palette.text.secondary,
    textTransform: 'none',
    fontSize: '0.8rem',
    fontWeight: 500,
    letterSpacing: 0,
    '&:hover': {
      backgroundColor: 'transparent',
      color: theme.palette.text.primary,
    },
    '& .MuiButton-startIcon': {
      marginRight: theme.spacing(0.75),
    },
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  headerIcon: {
    fontSize: 26,
    color: theme.palette.text.primary,
  },
  headerTitle: {
    fontWeight: 600,
    letterSpacing: '-0.02em',
  },
  headerSubtitle: {
    color: theme.palette.text.secondary,
    maxWidth: 620,
    fontSize: '0.875rem',
  },
  sections: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  card: {
    padding: theme.spacing(3, 3.5),
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    borderLeft: `4px solid ${theme.palette.text.primary}`,
    boxShadow: 'none',
    [theme.breakpoints.down('xs')]: {
      padding: theme.spacing(2.5),
    },
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
  },
  cardIconWrapper: {
    width: 44,
    height: 44,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardMeta: {
    flex: 1,
  },
  badgeAndStatus: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  badge: {
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    backgroundColor: theme.palette.text.primary,
    color: theme.palette.background.paper,
    borderRadius: 3,
    padding: '3px 10px',
  },
  pillActivo: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: '0.75rem',
    fontWeight: 600,
    borderRadius: 12,
    padding: '2px 10px',
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
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
    color: '#f57f17',
  },
  pillIconActivo: {
    fontSize: '0.9rem',
    color: '#2e7d32',
  },
  pillIconEnDesarrollo: {
    fontSize: '0.9rem',
    color: '#f57f17',
  },
  cardTitle: {
    fontWeight: 600,
  },
  cardSubtitle: {
    fontStyle: 'italic',
    color: theme.palette.text.secondary,
    fontSize: '0.875rem',
  },
  description: {
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(1),
    fontSize: '0.875rem',
    lineHeight: 1.6,
  },
  bulletList: {
    marginTop: theme.spacing(1),
    marginBottom: 0,
    paddingLeft: theme.spacing(2),
  },
  bulletItem: {
    color: theme.palette.text.secondary,
    fontSize: '0.85rem',
    lineHeight: 1.55,
    marginBottom: theme.spacing(0.5),
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    marginTop: theme.spacing(1.5),
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(3),
    padding: theme.spacing(2),
    border: `1px dashed ${theme.palette.text.secondary}`,
    borderRadius: 6,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.secondary,
  },
  footerIcon: {
    fontSize: 18,
    opacity: 0.6,
  },
  footerText: {
    fontSize: '0.8rem',
  },
}));

function StatusPill({ status }: { status: SecurityStatus }) {
  const classes = useStyles();

  if (status === 'activo') {
    return (
      <span className={classes.pillActivo}>
        <CheckCircleIcon className={classes.pillIconActivo} />
        Activo
      </span>
    );
  }

  return (
    <span className={classes.pillEnDesarrollo}>
      <ScheduleIcon className={classes.pillIconEnDesarrollo} />
      En desarrollo
    </span>
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
      <Container className={classes.page} maxWidth={false}>
        <div className={classes.header}>
          <div className={classes.headerInfo}>
            <Button
              variant="text"
              color="default"
              className={classes.backButton}
              onClick={handleGoBack}
              startIcon={<ArrowBackIcon fontSize="small" />}
            >
              Regresar
            </Button>
            <div className={classes.titleRow}>
              <SecurityIcon className={classes.headerIcon} />
              <Typography variant="h5" className={classes.headerTitle}>
                Seguridad y Privacidad
              </Typography>
            </div>
            <Typography variant="body1" className={classes.headerSubtitle}>
              Información clara sobre los controles que protegen la sesión, los medios y los datos de estudiantes.
            </Typography>
          </div>
        </div>

        <div className={classes.sections}>
          {sections.map(section => (
            <Paper key={section.id} className={classes.card} elevation={0}>
              <div className={classes.cardHeader}>
                <span className={classes.cardIconWrapper}>{section.icon}</span>
                <div className={classes.cardMeta}>
                  <div className={classes.badgeAndStatus}>
                    <span className={classes.badge}>{section.badge}</span>
                    <Typography variant="h6" className={classes.cardTitle}>
                      {section.title}
                    </Typography>
                  </div>
                  <Typography className={classes.cardSubtitle}>{section.subtitle}</Typography>
                  <Typography className={classes.description}>{section.description}</Typography>

                  <ul className={classes.bulletList}>
                    {section.bullets.map(bullet => (
                      <li key={bullet} className={classes.bulletItem}>
                        {bullet}
                      </li>
                    ))}
                  </ul>

                  <div className={classes.cardFooter}>
                    <StatusPill status={section.status} />
                  </div>
                </div>
              </div>
            </Paper>
          ))}
        </div>
      </Container>
    </div>
  );
}
