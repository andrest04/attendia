import React from 'react';
import { fireEvent, render, cleanup } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../i18n/createI18n';
import AboutDialog from './AboutDialog/AboutDialog';
import ErrorDialog from './ErrorDialog/ErrorDialog';

jest.mock('../state', () => ({ useAppState: () => ({ roomType: undefined }) }));
jest.mock('twilio-video', () => ({ version: '1.2', isSupported: true }));

afterEach(cleanup);

describe.each([['es', 'Aceptar'], ['en', 'OK']])('dialog acknowledgement in %s', (language, label) => {
  it('localizes the about dialog button and closes it', () => {
    const close = jest.fn();
    const i18n = createI18n({ detect: false, lng: language });
    const { getByRole } = render(<I18nextProvider i18n={i18n}><AboutDialog open onClose={close} /></I18nextProvider>);
    fireEvent.click(getByRole('button', { name: label }));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('localizes the error dialog button and dismisses it', () => {
    const dismiss = jest.fn();
    const i18n = createI18n({ detect: false, lng: language });
    const { getByRole } = render(<I18nextProvider i18n={i18n}><ErrorDialog error={new Error('test')} dismissError={dismiss} /></I18nextProvider>);
    fireEvent.click(getByRole('button', { name: label }));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
