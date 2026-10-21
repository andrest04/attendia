import React from 'react';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import Video from 'twilio-video';
import { createI18n } from '../../i18n/createI18n';
import UnsupportedBrowserWarning from './UnsupportedBrowserWarning';

describe('UnsupportedBrowserWarning in English', () => {
  it('keeps the original English wording', () => {
    // @ts-ignore
    Video.isSupported = false;
    const { container, getByText } = render(
      <I18nextProvider i18n={createI18n({ detect: false, lng: 'en' })}>
        <UnsupportedBrowserWarning>
          <span>Is supported</span>
        </UnsupportedBrowserWarning>
      </I18nextProvider>
    );
    expect(getByText('Browser or context not supported')).toBeTruthy();
    expect(getByText('supported browsers')).toBeTruthy();
    expect(container.textContent).toContain('(e.g. https or localhost).');
  });
});
