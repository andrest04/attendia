import entryFlow from './entryFlow.en';
import roomUi from './roomUi.en';

const en = {
  ...roomUi,
  ...entryFlow,
  common: {
    language: {
      label: 'Language',
      es: 'Spanish',
      en: 'English',
    },
  },
  classSessions: {
    today: 'Today',
    tomorrow: 'Tomorrow',
    now: 'Now',
    inMinutes: 'In {{count}} min',
    inHours: 'In {{count}}h',
    overdueMinutes: 'Expired {{count}} min ago',
    overdueHours: 'Expired {{count}}h ago',
    overdueDays: 'Expired {{count}}d ago',
  },
};

export default en;
