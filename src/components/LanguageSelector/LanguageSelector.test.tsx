import React from 'react';
import { mount } from 'enzyme';
import { I18nextProvider } from 'react-i18next';
import { act } from 'react-dom/test-utils';
import { createI18n, LANGUAGE_STORAGE_KEY } from '../../i18n/createI18n';
import LanguageSelector from './LanguageSelector';

describe('LanguageSelector', () => {
  beforeEach(() => window.localStorage.clear());

  it('lists the languages and changes and persists the selection', async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es');
    const i18n = createI18n();
    const wrapper = mount(
      <I18nextProvider i18n={i18n}>
        <LanguageSelector />
      </I18nextProvider>
    );
    expect(wrapper.find('select').prop('value')).toBe('es');
    expect(wrapper.find('option').map(o => o.text())).toEqual(['Español', 'Inglés']);

    await act(async () => {
      wrapper.find('select').simulate('change', { target: { value: 'en' } });
    });
    wrapper.update();

    expect(i18n.language).toBe('en');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(wrapper.find('select').prop('value')).toBe('en');
    expect(wrapper.find('option').map(o => o.text())).toEqual(['Spanish', 'English']);
    wrapper.unmount();
  });
});
