import React from 'react';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n/createI18n';
import PhoneBlockedScreen from './PhoneBlockedScreen';

describe('PhoneBlockedScreen in English', () => {
  it('shows the English copy', () => {
    const { getByText } = render(
      <I18nextProvider i18n={createI18n({ detect: false, lng: 'en' })}>
        <PhoneBlockedScreen />
      </I18nextProvider>
    );
    expect(getByText('This platform is not available on phones')).toBeTruthy();
    expect(getByText('Sign in from a computer or tablet.')).toBeTruthy();
  });
});
