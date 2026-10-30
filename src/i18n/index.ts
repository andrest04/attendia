import { createI18n } from './createI18n';
import { bindCurrentLanguage, syncCurrentLanguage } from './currentLanguage';
import { FALLBACK_LANGUAGE } from './resolveLocale';

const i18n = createI18n();

const descriptions: { [language: string]: string } = {
  es: 'Plataforma de clases en video con telemetría de atención.',
  en: 'Video classroom platform with attention telemetry.',
};

function syncHtmlMetadata(language?: string) {
  syncCurrentLanguage(language);
  if (typeof document !== 'undefined' && language) {
    const baseLanguage = language.split('-')[0].toLowerCase();
    document.documentElement.lang = baseLanguage;
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute('content', descriptions[baseLanguage] || descriptions[FALLBACK_LANGUAGE]);
    }
  }
}

bindCurrentLanguage(language => {
  // Legacy languageChanged listeners may call the setter with the emitted value.
  if (i18n.language === language) syncCurrentLanguage(language);
  else i18n.changeLanguage(language);
});
syncHtmlMetadata(i18n.language);
i18n.on('languageChanged', syncHtmlMetadata);

export default i18n;
