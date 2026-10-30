import completeDashboard from './completeDashboard.en';
import completePreview from './completePreview.en';
import completeControls from './completeControls.en';
import completeBackground from './completeBackground.en';
import completeReports from './completeReports.en';
import completePages from './completePages.en';
import completeNotifications from './completeNotifications.en';
import dashboard from './dashboard.en';
import entryFlow from './entryFlow.en';
import roomUi from './roomUi.en';

const en = {
  completeDashboard,
  completeControls,
  completeBackground,
  completePages,
  completeNotifications,
  ...roomUi,
  ...entryFlow,
  ...dashboard,
  chat: { ...entryFlow.chat, sendMessage: 'Send message', byteUnit: 'bytes', openFile: 'Open file: {{filename}}' },
  common: {
    ...completeReports,
    ...completePreview,
    roleBadgeTeacher: 'Teacher',
    browserSupport: { yes: 'Yes', no: 'No' },
    connectionNotice: { lost: 'Connection Lost:', reconnecting: 'Reconnecting to room...' },
    networkQuality: { label: 'Network quality: {{level}} of 5' },
    audioTrack: { enabled: 'Audio track enabled', disabled: 'Audio track disabled', unavailable: 'Audio track unavailable' },
    recordingNotifications: {
      started: 'Recording has started.',
      inProgress: 'Recording is in progress.',
      complete: 'Recording Complete',
      beforeLink: 'You can view the recording in the',
      link: 'Twilio Console',
      afterLink: '. Recordings will be available once this room has ended.',
    },
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
