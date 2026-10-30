import React from 'react';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import LocaleProvider from './LocaleProvider';
import { setLocale } from './locale';
import { t } from './translate';
import i18n from './index';
import { I18nextProvider, useTranslation } from 'react-i18next';

// A plain component that calls t() in render, like most of the app: it has no locale hook of its own.
function Label() {
  return <span>{t('Idioma')}</span>;
}

beforeEach(() => {
  i18n.changeLanguage('es');
  window.localStorage.clear();
});

afterEach(() => {
  i18n.changeLanguage('es');
  window.localStorage.clear();
});

describe('LocaleProvider', () => {
  it('updates both catalogs in both directions with mixed providers', () => {
    function MixedLabel() {
      const { t: translate } = useTranslation('common');
      return <span>{t('Idioma')} / {translate('language.label')}</span>;
    }
    const wrapper = mount(
      <I18nextProvider i18n={i18n}>
        <LocaleProvider>{() => <MixedLabel />}</LocaleProvider>
      </I18nextProvider>
    );
    act(() => setLocale('en'));
    wrapper.update();
    expect(wrapper.text()).toBe('Language / Language');
    act(() => { i18n.changeLanguage('es'); });
    wrapper.update();
    expect(wrapper.text()).toBe('Idioma / Idioma');
    wrapper.unmount();
  });

  it('re-renders components that call t() when the language changes', () => {
    const wrapper = mount(<LocaleProvider>{() => <Label />}</LocaleProvider>);
    expect(wrapper.text()).toBe('Idioma');

    act(() => setLocale('en'));
    wrapper.update();
    expect(wrapper.text()).toBe('Language');

    act(() => setLocale('es'));
    wrapper.update();
    expect(wrapper.text()).toBe('Idioma');

    wrapper.unmount();
  });

  it('leaves the listener count at zero after unmount', () => {
    const wrapper = mount(<LocaleProvider>{() => <Label />}</LocaleProvider>);
    wrapper.unmount();

    // A change after unmount must not throw (no setState on an unmounted component).
    expect(() => act(() => setLocale('en'))).not.toThrow();
  });
});
