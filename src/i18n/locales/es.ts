import completeDashboard from './completeDashboard.es';
import completePreview from './completePreview.es';
import completeControls from './completeControls.es';
import completeBackground from './completeBackground.es';
import completeReports from './completeReports.es';
import completePages from './completePages.es';
import completeNotifications from './completeNotifications.es';
import dashboard from './dashboard.es';
import entryFlow from './entryFlow.es';
import roomUi from './roomUi.es';

const es = {
  completeDashboard,
  completeControls,
  completeBackground,
  completePages,
  completeNotifications,
  ...roomUi,
  ...entryFlow,
  ...dashboard,
  chat: { ...entryFlow.chat, sendMessage: 'Enviar mensaje', byteUnit: 'octetos', openFile: 'Abrir archivo: {{filename}}' },
  common: {
    ...completeReports,
    ...completePreview,
    acknowledge: 'Aceptar',
    roleBadgeTeacher: 'Profesor',
    browserSupport: { yes: 'Sí', no: 'No' },
    connectionNotice: { lost: 'Conexión perdida:', reconnecting: 'Reconectando a la sala...' },
    networkQuality: { label: 'Calidad de red: {{level}} de 5' },
    audioTrack: { enabled: 'Pista de audio activada', disabled: 'Pista de audio desactivada', unavailable: 'Pista de audio no disponible' },
    recordingNotifications: {
      started: 'La grabación ha comenzado.',
      inProgress: 'Grabación en curso.',
      complete: 'Grabación completada',
      beforeLink: 'Puedes ver la grabación en la',
      link: 'Consola de Twilio',
      afterLink: '. Las grabaciones estarán disponibles cuando termine esta sala.',
    },
    language: {
      label: 'Idioma',
      es: 'Español',
      en: 'Inglés',
    },
  },
  classSessions: {
    today: 'Hoy',
    tomorrow: 'Mañana',
    now: 'Ahora',
    inMinutes: 'En {{count}} min',
    inHours: 'En {{count}}h',
    overdueMinutes: 'Venció hace {{count}} min',
    overdueHours: 'Venció hace {{count}}h',
    overdueDays: 'Venció hace {{count}}d',
  },
};

export default es;
