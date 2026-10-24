/* eslint-disable @typescript-eslint/no-var-requires */
// English is stored before anything is imported, as after a reload with EN selected: the
// LoginPage module is evaluated in English, which is what used to freeze its role labels.
export {};

window.localStorage.setItem('attendia-locale', JSON.stringify('en'));

const React = require('react');
const { act, fireEvent, render } = require('@testing-library/react');
const LoginPage = require('./LoginPage').default;
const LocaleProvider = require('../../i18n/LocaleProvider').default;
const { setLocale } = require('../../i18n/locale');

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
    expect(getByTestId('role-option-profesor').textContent).toContain("I'm a teacher");

    act(() => setLocale('es'));

    expect(getByTestId('role-option-profesor').textContent).toContain('Soy profesor');
    expect(getByTestId('role-option-profesor').textContent).toContain('Crear y dar clases');
    expect(getByTestId('role-option-estudiante').textContent).toContain('Soy estudiante');
    expect(getByTestId('role-option-estudiante').textContent).toContain('Unirme a clases existentes');
  });
});
