import i18n from './index';

// Initialize the same instance used by the app and react-i18next, regardless of jsdom's locale.
i18n.changeLanguage('es');

export default i18n;
