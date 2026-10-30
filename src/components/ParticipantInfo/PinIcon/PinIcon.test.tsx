import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { I18nextProvider } from 'react-i18next';
import Tooltip from '@material-ui/core/Tooltip';
import { createI18n } from '../../../i18n/createI18n';
import es from '../../../i18n/locales/completeControls.es';
import en from '../../../i18n/locales/completeControls.en';
import PinIcon from './PinIcon';

it('updates the pinned participant tooltip when the language changes', async () => {
  const i18n = createI18n({ detect: false, lng: 'es' });
  i18n.addResourceBundle('es', 'completeControls', es);
  i18n.addResourceBundle('en', 'completeControls', en);
  const wrapper = mount(<I18nextProvider i18n={i18n}><PinIcon /></I18nextProvider>);
  expect(wrapper.find(Tooltip).prop('title')).toBe(es.pin);
  await act(async () => { await i18n.changeLanguage('en'); });
  wrapper.update();
  expect(wrapper.find(Tooltip).prop('title')).toBe(en.pin);
  wrapper.unmount();
});
