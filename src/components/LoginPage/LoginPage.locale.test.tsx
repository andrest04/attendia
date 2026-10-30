/* eslint-disable @typescript-eslint/no-var-requires */
// The test setup already initialized the singleton, so select English before loading the
// LoginPage module, as it would be after a reload with EN selected.
export {};

const { setLocale } = require('../../i18n/locale');
setLocale('en');

const React = require('react');
const { act, fireEvent, render } = require('@testing-library/react');
const LoginPage = require('./LoginPage').default;
const LocaleProvider = require('../../i18n/LocaleProvider').default;

jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/login' }),
  useHistory: () => ({ replace: jest.fn() }),
  Link: ({ children }: { children: any }) => children,
}));
jest.mock('../../state', () => ({
  useAppState: () => ({ user: null, profile: null, isAuthReady: true }),
}));
jest.mock('./google-logo.svg', () => ({ ReactComponent: () => null }));

afterAll(() => {
  setLocale('es');
  window.localStorage.clear();
});

describe('the LoginPage role selector across a language switch', () => {
  it('follows the language even when the page module was first loaded in English', () => {
    const { getByText, getByTestId } = render(
      React.createElement(LocaleProvider, null, () => React.createElement(LoginPage))
    );
    act(() => {
      fireEvent.click(getByText('Create account'));
    });
    expect(getByTestId('role-option-profesor').textContent).toContain('I am a teacher');

    act(() => setLocale('es'));

    expect(getByTestId('role-option-profesor').textContent).toContain('Soy profesor');
    expect(getByTestId('role-option-profesor').textContent).toContain('Crear y dar clases');
    expect(getByTestId('role-option-estudiante').textContent).toContain('Soy estudiante');
    expect(getByTestId('role-option-estudiante').textContent).toContain('Unirme a clases existentes');
  });
});
