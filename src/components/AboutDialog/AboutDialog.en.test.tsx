import React from 'react';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n/createI18n';
import { useAppState } from '../../state';
import AboutDialog from './AboutDialog';

jest.mock('twilio-video', () => ({ version: '1.2', isSupported: true }));
jest.mock('../../state');
jest.mock('../../../package.json', () => ({ version: '1.3' }));

(useAppState as jest.Mock<any>).mockImplementation(() => ({ roomType: 'group' }));

describe('AboutDialog in English', () => {
  it('translates the labels and keeps the values', () => {
    const { getByText } = render(
      <I18nextProvider i18n={createI18n({ detect: false, lng: 'en' })}>
        <AboutDialog open onClose={() => {}} />
      </I18nextProvider>
    );
    expect(getByText('About')).toBeTruthy();
    expect(getByText('Supported browser: true')).toBeTruthy();
    expect(getByText('SDK version: 1.2')).toBeTruthy();
    expect(getByText('Room type: group')).toBeTruthy();
  });
});
