import React from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Container from '@material-ui/core/Container';
import Typography from '@material-ui/core/Typography';
import Paper from '@material-ui/core/Paper';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import LockIcon from '@material-ui/icons/Lock';
import VpnKeyIcon from '@material-ui/icons/VpnKey';
import VisibilityIcon from '@material-ui/icons/Visibility';
import StorageIcon from '@material-ui/icons/Storage';
import SecurityIcon from '@material-ui/icons/Security';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ScheduleIcon from '@material-ui/icons/Schedule';
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';

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
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(6),
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: theme.spacing(4),
    textAlign: 'center',
  },
  headerIcon: {
    fontSize: 48,
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(1),
  },
  headerTitle: {
    fontWeight: 700,
    marginBottom: theme.spacing(1),
  },
  headerSubtitle: {
    color: theme.palette.text.secondary,
    maxWidth: 600,
  },
  card: {
    marginBottom: theme.spacing(3),
    padding: theme.spacing(3),
    borderRadius: 8,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: theme.spacing(1.5),
    gap: theme.spacing(2),
  },
  cardIconWrapper: {
    color: theme.palette.primary.main,
    marginTop: 2,
    flexShrink: 0,
  },
  cardMeta: {
    flex: 1,
  },
  badgeAndStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
  },
  badge: {
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    backgroundColor: theme.palette.grey[200],
    color: theme.palette.text.secondary,
    borderRadius: 4,
    padding: '2px 8px',
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
    fontWeight: 700,
  },
  cardSubtitle: {
    fontStyle: 'italic',
    color: theme.palette.text.secondary,
    fontSize: '0.875rem',
  },
  description: {
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(1.5),
    fontSize: '0.875rem',
    lineHeight: 1.6,
  },
  bulletList: {
    marginTop: theme.spacing(1),
    paddingLeft: 0,
  },
  bulletItem: {
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 0,
  },
  bulletIcon: {
    minWidth: 28,
    color: theme.palette.primary.main,
    '& svg': {
      fontSize: '0.5rem',
    },
  },
  bulletText: {
    fontSize: '0.85rem',
    margin: 0,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    justifyContent: 'center',
    marginTop: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
  footerIcon: {
    fontSize: 18,
    opacity: 0.6,
  },
  footerText: {
    fontSize: '0.8rem',
    textAlign: 'center',
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

  return (
    <div className={classes.root}>
      <Container maxWidth="md">
        <div className={classes.header}>
          <SecurityIcon className={classes.headerIcon} />
          <Typography variant="h4" className={classes.headerTitle}>
            Seguridad y Privacidad
          </Typography>
          <Typography variant="body1" className={classes.headerSubtitle}>
            Información sobre los mecanismos de seguridad y privacidad de la plataforma.
          </Typography>
        </div>

        {sections.map(section => (
          <Paper key={section.id} className={classes.card} elevation={1}>
            <div className={classes.cardHeader}>
              <span className={classes.cardIconWrapper}>{section.icon}</span>
              <div className={classes.cardMeta}>
                <div className={classes.badgeAndStatus}>
                  <span className={classes.badge}>{section.badge}</span>
                  <StatusPill status={section.status} />
                </div>
                <Typography variant="h6" className={classes.cardTitle}>
                  {section.title}
                </Typography>
                <Typography className={classes.cardSubtitle}>{section.subtitle}</Typography>
              </div>
            </div>

            <Typography className={classes.description}>{section.description}</Typography>

            <List className={classes.bulletList} dense disablePadding>
              {section.bullets.map((bullet, index) => (
                <ListItem key={index} className={classes.bulletItem}>
                  <ListItemIcon className={classes.bulletIcon}>
                    <FiberManualRecordIcon />
                  </ListItemIcon>
                  <ListItemText primary={bullet} primaryTypographyProps={{ className: classes.bulletText }} />
                </ListItem>
              ))}
            </List>
          </Paper>
        ))}

        <div className={classes.footer}>
          <SecurityIcon className={classes.footerIcon} />
          <Typography className={classes.footerText}>
            Para consultas sobre privacidad o el tratamiento de tus datos, contacta al responsable de la asignatura.
          </Typography>
        </div>
      </Container>
    </div>
  );
}
