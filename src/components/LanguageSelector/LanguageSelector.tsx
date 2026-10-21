import React from 'react';
import { NativeSelect } from '@material-ui/core';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../../i18n/resolveLocale';

export default function LanguageSelector() {
  const { t, i18n } = useTranslation('common');
  const current = (i18n.resolvedLanguage || i18n.language || 'es').split('-')[0];

  return (
    <NativeSelect
      value={current}
      onChange={event => i18n.changeLanguage(event.target.value as string)}
      inputProps={{ 'aria-label': t('language.label') }}
    >
      {SUPPORTED_LANGUAGES.map(language => (
        <option key={language} value={language}>
          {t(`language.${language}`)}
        </option>
      ))}
    </NativeSelect>
  );
}
