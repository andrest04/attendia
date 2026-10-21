import React from 'react';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n/createI18n';
import { useAppState } from '../../state';
import SessionEndedScreen from './SessionEndedScreen';

jest.mock('../../state');

describe('SessionEndedScreen in English', () => {
  it('shows the English copy', () => {
    (useAppState as jest.Mock<any>).mockImplementation(() => ({ setSessionEndedByProfessor: jest.fn() }));
    const { getByText } = render(
      <I18nextProvider i18n={createI18n({ detect: false, lng: 'en' })}>
        <SessionEndedScreen />
      </I18nextProvider>
    );
    expect(getByText('The session has ended')).toBeTruthy();
    expect(getByText('Back to home')).toBeTruthy();
  });
});
