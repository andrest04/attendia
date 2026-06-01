import React from 'react';
import LoginPage from './LoginPage';
import { act, fireEvent, render, waitForElement } from '@testing-library/react';
import { useAppState } from '../../state';
import { useLocation, useHistory } from 'react-router-dom';
import { setImmediate } from 'timers';

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
const mockUseLocation = useLocation as jest.Mock<any>;
const mockUseHistory = useHistory as jest.Mock<any>;

const mockReplace = jest.fn();
mockUseHistory.mockImplementation(() => ({ replace: mockReplace }));
mockUseLocation.mockImplementation(() => ({ pathname: '/login' }));

describe('the LoginPage component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocation.mockImplementation(() => ({ pathname: '/login' }));
  });

  describe('with auth enabled', () => {
    it('should redirect to "/" when there is a user ', () => {
      process.env.REACT_APP_SET_AUTH = 'firebase';
      mockUseAppState.mockImplementation(() => ({ user: {}, signIn: () => Promise.resolve(), isAuthReady: true }));
      render(<LoginPage />);
      expect(mockReplace).toHaveBeenCalledWith('/');
    });

    it('should render the login page when there is no user', () => {
      process.env.REACT_APP_SET_AUTH = 'firebase';
      mockUseAppState.mockImplementation(() => ({ user: null, signIn: () => Promise.resolve(), isAuthReady: true }));
      const { getByText } = render(<LoginPage />);
      expect(mockReplace).not.toHaveBeenCalled();
      expect(getByText('Iniciar sesión con Google')).toBeTruthy();
    });

    it('should redirect the user to "/" after signIn when there is no previous location', done => {
      process.env.REACT_APP_SET_AUTH = 'firebase';
      mockUseAppState.mockImplementation(() => ({ user: null, signIn: () => Promise.resolve(), isAuthReady: true }));
      const { getByText } = render(<LoginPage />);
      getByText('Iniciar sesión con Google').click();
      setImmediate(() => {
        expect(mockReplace).toHaveBeenCalledWith({ pathname: '/', state: { preJoinRole: 'teacher' } });
        done();
      });
    });

    it('should redirect the user to their previous location after signIn', done => {
      process.env.REACT_APP_SET_AUTH = 'firebase';
      mockUseLocation.mockImplementation(() => ({ state: { from: { pathname: '/room/test' } } }));
      mockUseAppState.mockImplementation(() => ({ user: null, signIn: () => Promise.resolve(), isAuthReady: true }));
      const { getByText } = render(<LoginPage />);
      getByText('Iniciar sesión con Google').click();
      setImmediate(() => {
        expect(mockReplace).toHaveBeenCalledWith({ pathname: '/room/test', state: { preJoinRole: 'teacher' } });
        done();
      });
    });

    it('should not render anything when isAuthReady is false', () => {
      process.env.REACT_APP_SET_AUTH = 'firebase';
      mockUseAppState.mockImplementation(() => ({ user: null, signIn: () => Promise.resolve(), isAuthReady: false }));
      const { container } = render(<LoginPage />);
      expect(mockReplace).not.toHaveBeenCalled();
      expect(container.children[0]).toBe(undefined);
    });
  });

  describe('with passcode auth enabled', () => {
    it('should call sign in with the supplied passcode', done => {
      const mockSignin = jest.fn(() => Promise.resolve());
      process.env.REACT_APP_SET_AUTH = 'passcode';
      mockUseAppState.mockImplementation(() => ({ user: null, signIn: mockSignin, isAuthReady: true }));
      const { getByLabelText, getByText } = render(<LoginPage />);

      act(() => {
        fireEvent.change(getByLabelText('Código de acceso'), { target: { value: '1234' } });
      });
      act(() => {
        fireEvent.submit(getByText('Ingresar'));
      });

      setImmediate(() => {
        expect(mockSignin).toHaveBeenCalledWith('1234');
        done();
      });
    });

    it('should call render error messages when signin fails', async () => {
      const mockSignin = jest.fn(() => Promise.reject(new Error('Test Error')));
      process.env.REACT_APP_SET_AUTH = 'passcode';
      mockUseAppState.mockImplementation(() => ({ user: null, signIn: mockSignin, isAuthReady: true }));
      const { getByLabelText, getByText } = render(<LoginPage />);

      act(() => {
        fireEvent.change(getByLabelText('Código de acceso'), { target: { value: '1234' } });
      });

      act(() => {
        fireEvent.submit(getByText('Ingresar'));
      });

      const element = await waitForElement(() => getByText('Test Error'));
      expect(element).toBeTruthy();
    });
  });

  it('should redirect to "/" when auth is disabled', () => {
    delete process.env.REACT_APP_SET_AUTH;
    mockUseAppState.mockImplementation(() => ({ user: null, signIn: () => Promise.resolve(), isAuthReady: true }));
    render(<LoginPage />);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  describe('role cards', () => {
    it('should render both role cards', () => {
      process.env.REACT_APP_SET_AUTH = 'firebase';
      mockUseAppState.mockImplementation(() => ({ user: null, signIn: () => Promise.resolve(), isAuthReady: true }));
      const { getByTestId, getByText } = render(<LoginPage />);
      expect(getByTestId('role-card-profesor')).toBeTruthy();
      expect(getByTestId('role-card-estudiante')).toBeTruthy();
      expect(getByText('Profesor')).toBeTruthy();
      expect(getByText('Estudiante')).toBeTruthy();
    });

    it('should allow selecting student role card', () => {
      process.env.REACT_APP_SET_AUTH = 'firebase';
      mockUseAppState.mockImplementation(() => ({ user: null, signIn: () => Promise.resolve(), isAuthReady: true }));
      const { getByTestId, getByText } = render(<LoginPage />);

      expect(getByText('Elige tu rol para iniciar el flujo correspondiente.')).toBeTruthy();
      expect(getByTestId('role-card-profesor').getAttribute('aria-pressed')).toBe('true');
      fireEvent.click(getByTestId('role-card-estudiante'));
      expect(getByTestId('role-card-profesor').getAttribute('aria-pressed')).toBe('false');
      expect(getByTestId('role-card-estudiante').getAttribute('aria-pressed')).toBe('true');
    });

    it('should pass selected student role on sign in', done => {
      process.env.REACT_APP_SET_AUTH = 'firebase';
      mockUseAppState.mockImplementation(() => ({ user: null, signIn: () => Promise.resolve(), isAuthReady: true }));
      const { getByTestId, getByText } = render(<LoginPage />);

      fireEvent.click(getByTestId('role-card-estudiante'));
      getByText('Iniciar sesión con Google').click();

      setImmediate(() => {
        expect(mockReplace).toHaveBeenCalledWith({ pathname: '/', state: { preJoinRole: 'student' } });
        done();
      });
    });
  });
});
