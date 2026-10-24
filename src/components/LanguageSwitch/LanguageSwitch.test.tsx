import React from 'react';
import { mount } from 'enzyme';
import LanguageSwitch from './LanguageSwitch';
import { getLocale, LOCALE_STORAGE_KEY } from '../../i18n/locale';

afterEach(() => {
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
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe(JSON.stringify('en'));
    wrapper.update();
    expect(wrapper.find('[aria-label="Language"]').exists()).toBe(true);

    wrapper.unmount();
  });
});
