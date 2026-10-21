import { createI18n } from './createI18n';
import { setCurrentLanguage } from './currentLanguage';

const i18n = createI18n();

function syncHtmlLang(language?: string) {
  setCurrentLanguage(language);
  if (typeof document !== 'undefined' && language) {
    document.documentElement.lang = language.split('-')[0];
  }
}

syncHtmlLang(i18n.language);
i18n.on('languageChanged', syncHtmlLang);

export default i18n;
