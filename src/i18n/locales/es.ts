import roomUi from './roomUi.es';

const es = {
  ...roomUi,
  common: {
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
