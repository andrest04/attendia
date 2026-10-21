import { createI18n } from './createI18n';

const i18n = createI18n();

function syncHtmlLang(language?: string) {
  if (typeof document !== 'undefined' && language) {
    document.documentElement.lang = language.split('-')[0];
  }
}

syncHtmlLang(i18n.language);
i18n.on('languageChanged', syncHtmlLang);

export default i18n;
