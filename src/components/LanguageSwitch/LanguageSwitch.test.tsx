import React from 'react';
import { mount } from 'enzyme';
import LanguageSwitch from './LanguageSwitch';
import { getLocale } from '../../i18n/locale';
import i18n from '../../i18n';
import { LANGUAGE_STORAGE_KEY } from '../../i18n/createI18n';

beforeEach(() => {
  i18n.changeLanguage('es');
  window.localStorage.clear();
});

afterEach(() => {
  i18n.changeLanguage('es');
  window.localStorage.clear();
});

describe('LanguageSwitch', () => {
  it('selects English and keeps the control label in the active language', () => {
    const wrapper = mount(<LanguageSwitch />);

    expect(wrapper.find('[aria-label="Idioma"]').exists()).toBe(true);
    wrapper
      .find('button')
      .filterWhere(button => button.text() === 'EN')
      .simulate('click');

    expect(getLocale()).toBe('en');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    wrapper.update();
    expect(wrapper.find('[aria-label="Language"]').exists()).toBe(true);

    wrapper.unmount();
  });
});
