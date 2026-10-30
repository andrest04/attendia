import { getI18n } from 'react-i18next';
import i18n from './index';
import testI18n from './testInit';
import { getCurrentLanguage } from './currentLanguage';

afterEach(() => {
  i18n.changeLanguage('es');
  window.localStorage.clear();
});

it('initializes the app and React i18n singleton in Spanish', () => {
  expect(testI18n).toBe(i18n);
  expect(getI18n()).toBe(i18n);
  expect(i18n.language).toBe('es');
  expect(i18n.t('common:language.label')).toBe('Idioma');
  expect(getCurrentLanguage()).toBe('es');
  expect(document.documentElement.lang).toBe('es');
});

it('keeps app language helpers synchronized with singleton changes', async () => {
  await i18n.changeLanguage('en');
  expect(getCurrentLanguage()).toBe('en');
  expect(document.documentElement.lang).toBe('en');
});
