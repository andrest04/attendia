import { createI18n } from './createI18n';
import { setCurrentLanguage } from './currentLanguage';
import { FALLBACK_LANGUAGE } from './resolveLocale';

const i18n = createI18n();

const descriptions: { [language: string]: string } = {
  es: 'Plataforma de clases en video con telemetría de atención.',
  en: 'Video classroom platform with attention telemetry.',
};

function syncHtmlMetadata(language?: string) {
  setCurrentLanguage(language);
  if (typeof document !== 'undefined' && language) {
    const baseLanguage = language.split('-')[0].toLowerCase();
    document.documentElement.lang = baseLanguage;
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute('content', descriptions[baseLanguage] || descriptions[FALLBACK_LANGUAGE]);
    }
  }
}

syncHtmlMetadata(i18n.language);
i18n.on('languageChanged', syncHtmlMetadata);

export default i18n;
