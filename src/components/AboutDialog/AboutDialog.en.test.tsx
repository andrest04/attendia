import React from 'react';
import { act, render } from '@testing-library/react';
import Video from 'twilio-video';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n/createI18n';
import { useAppState } from '../../state';
import AboutDialog from './AboutDialog';

jest.mock('twilio-video', () => ({ version: '1.2', isSupported: true }));
jest.mock('../../state');
jest.mock('../../../package.json', () => ({ version: '1.3' }));

(useAppState as jest.Mock<any>).mockImplementation(() => ({ roomType: 'group' }));

describe('AboutDialog in English', () => {
  it('updates both supported states on a live language switch', async () => {
    const i18n = createI18n({ detect: false, lng: 'es' });
    const video = Video as { isSupported: boolean };
    const original = video.isSupported;
    try {
      video.isSupported = false;
      const view = render(<I18nextProvider i18n={i18n}><AboutDialog open onClose={() => {}} /></I18nextProvider>);
      expect(view.getByText('Navegador compatible: No')).toBeTruthy();
      await act(async () => { await i18n.changeLanguage('en'); });
      expect(view.getByText('Supported browser: No')).toBeTruthy();
      video.isSupported = true;
      view.rerender(<I18nextProvider i18n={i18n}><AboutDialog open onClose={() => {}} /></I18nextProvider>);
      expect(view.getByText('Supported browser: Yes')).toBeTruthy();
      await act(async () => { await i18n.changeLanguage('es'); });
      expect(view.getByText('Navegador compatible: Sí')).toBeTruthy();
    } finally {
      video.isSupported = original;
    }
  });

  it('translates the labels and keeps the values', () => {
    const { getByText } = render(
      <I18nextProvider i18n={createI18n({ detect: false, lng: 'en' })}>
        <AboutDialog open onClose={() => {}} />
      </I18nextProvider>
    );
    expect(getByText('About')).toBeTruthy();
    expect(getByText('Supported browser: Yes')).toBeTruthy();
    expect(getByText('SDK version: 1.2')).toBeTruthy();
    expect(getByText('Room type: group')).toBeTruthy();
  });
});
