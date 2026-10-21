import React from 'react';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n/createI18n';
import { useAppState } from '../../state';
import { useLocation, useHistory } from 'react-router-dom';
import LoginPage, { getFirebaseAuthErrorMessage } from './LoginPage';

jest.mock('react-router-dom', () => {
  return {
    useLocation: jest.fn(),
    useHistory: jest.fn(),
    Link: ({ children }: { children: React.ReactNode }) => children,
  };
});
jest.mock('../../state');
jest.mock('./google-logo.svg', () => ({ ReactComponent: () => null }));

const mockUseAppState = useAppState as jest.Mock<any>;
(useHistory as jest.Mock<any>).mockImplementation(() => ({ replace: jest.fn() }));
(useLocation as jest.Mock<any>).mockImplementation(() => ({ pathname: '/login' }));

const english = createI18n({ detect: false, lng: 'en' });
const spanish = createI18n({ detect: false, lng: 'es' });

describe('LoginPage in English', () => {
  it('translates the sign-in form', () => {
    mockUseAppState.mockImplementation(() => ({ user: null, profile: null, isAuthReady: true }));
    const { getByText, getByLabelText } = render(
      <I18nextProvider i18n={english}>
        <LoginPage />
      </I18nextProvider>
    );
    expect(getByText('Sign in with your account to access your classes.')).toBeTruthy();
    expect(getByText('Continue with Google')).toBeTruthy();
    expect(getByLabelText('Email')).toBeTruthy();
    expect(getByLabelText('Password')).toBeTruthy();
  });

  it('translates the role completion step', () => {
    mockUseAppState.mockImplementation(() => ({
      user: { displayName: 'Ana' },
      profile: null,
      isAuthReady: true,
    }));
    const { getByText } = render(
      <I18nextProvider i18n={english}>
        <LoginPage />
      </I18nextProvider>
    );
    expect(getByText('How will you use Attendia?')).toBeTruthy();
    expect(getByText('I am a teacher')).toBeTruthy();
    expect(getByText('Ana')).toBeTruthy();
  });

  it('maps Firebase error codes with the translator it is given', () => {
    expect(getFirebaseAuthErrorMessage({ code: 'auth/wrong-password' }, english.t)).toBe(
      'Incorrect email or password. Check your details and try again.'
    );
    expect(getFirebaseAuthErrorMessage({ code: 'auth/wrong-password' }, spanish.t)).toBe(
      'Correo o contraseña incorrectos. Revisa tus datos e intenta de nuevo.'
    );
    expect(getFirebaseAuthErrorMessage({}, english.t)).toContain('could not complete the operation');
  });
});
