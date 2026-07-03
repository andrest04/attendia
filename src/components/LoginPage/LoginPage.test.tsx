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

const mockProfile = { displayName: 'Test User', email: 'test@example.com', role: 'student' };

describe('the LoginPage component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocation.mockImplementation(() => ({ pathname: '/login' }));
  });

  describe('with firebase auth enabled', () => {
    beforeEach(() => {
      process.env.REACT_APP_SET_AUTH = 'firebase';
    });

    it('should redirect to "/" when there is a user with a profile', () => {
      mockUseAppState.mockImplementation(() => ({ user: {}, profile: mockProfile, isAuthReady: true }));
      render(<LoginPage />);
      expect(mockReplace).toHaveBeenCalledWith('/');
    });

    it('should redirect to the previous location when there is a user with a profile', () => {
      mockUseLocation.mockImplementation(() => ({ pathname: '/login', state: { from: { pathname: '/room/test' } } }));
      mockUseAppState.mockImplementation(() => ({ user: {}, profile: mockProfile, isAuthReady: true }));
      render(<LoginPage />);
      expect(mockReplace).toHaveBeenCalledWith({ pathname: '/room/test' });
    });

    it('should not render anything when isAuthReady is false', () => {
      mockUseAppState.mockImplementation(() => ({ user: null, profile: null, isAuthReady: false }));
      const { container } = render(<LoginPage />);
      expect(mockReplace).not.toHaveBeenCalled();
      expect(container.children[0]).toBe(undefined);
    });

    describe('the login view', () => {
      beforeEach(() => {
        mockUseAppState.mockImplementation(() => ({
          user: null,
          profile: null,
          isAuthReady: true,
          signIn: jest.fn(() => Promise.resolve()),
          signInWithEmail: jest.fn(() => Promise.resolve()),
        }));
      });

      it('should render the email/password form and the Google button, with no role choice UI', () => {
        const { getByLabelText, getByText, queryByTestId } = render(<LoginPage />);
        expect(mockReplace).not.toHaveBeenCalled();
        expect(getByLabelText('Correo electrónico')).toBeTruthy();
        expect(getByLabelText('Contraseña')).toBeTruthy();
        expect(getByText('Continuar con Google')).toBeTruthy();
        // Role is not chosen at login anymore — it comes from the Firestore profile.
        expect(queryByTestId('role-card-profesor')).toBeNull();
        expect(queryByTestId('role-card-estudiante')).toBeNull();
      });

      it('should submit the form (Enter works) and call signInWithEmail with the credentials', done => {
        const mockSignInWithEmail = jest.fn(() => Promise.resolve());
        mockUseAppState.mockImplementation(() => ({
          user: null,
          profile: null,
          isAuthReady: true,
          signInWithEmail: mockSignInWithEmail,
        }));
        const { getByLabelText } = render(<LoginPage />);

        act(() => {
          fireEvent.change(getByLabelText('Correo electrónico'), { target: { value: 'ana@example.com' } });
          fireEvent.change(getByLabelText('Contraseña'), { target: { value: 'password1' } });
        });
        act(() => {
          fireEvent.submit(getByLabelText('Contraseña').closest('form')!);
        });

        setImmediate(() => {
          expect(mockSignInWithEmail).toHaveBeenCalledWith('ana@example.com', 'password1');
          done();
        });
      });

      it('should call the Google signIn from the Google button', done => {
        const mockSignIn = jest.fn(() => Promise.resolve());
        mockUseAppState.mockImplementation(() => ({
          user: null,
          profile: null,
          isAuthReady: true,
          signIn: mockSignIn,
        }));
        const { getByText } = render(<LoginPage />);

        getByText('Continuar con Google').click();

        setImmediate(() => {
          expect(mockSignIn).toHaveBeenCalledWith();
          done();
        });
      });

      it('should map auth/invalid-credential to a friendly Spanish message', async () => {
        const mockSignInWithEmail = jest.fn(() => Promise.reject({ code: 'auth/invalid-credential' }));
        mockUseAppState.mockImplementation(() => ({
          user: null,
          profile: null,
          isAuthReady: true,
          signInWithEmail: mockSignInWithEmail,
        }));
        const { getByLabelText, getByText } = render(<LoginPage />);

        act(() => {
          fireEvent.change(getByLabelText('Correo electrónico'), { target: { value: 'ana@example.com' } });
          fireEvent.change(getByLabelText('Contraseña'), { target: { value: 'wrong' } });
        });
        act(() => {
          fireEvent.submit(getByLabelText('Contraseña').closest('form')!);
        });

        const element = await waitForElement(() =>
          getByText('Correo o contraseña incorrectos. Revisa tus datos e intenta de nuevo.')
        );
        expect(element).toBeTruthy();
      });
    });

    describe('the register view', () => {
      const openRegisterView = () => {
        const utils = render(<LoginPage />);
        act(() => {
          fireEvent.click(utils.getByText('Crear cuenta'));
        });
        return utils;
      };

      it('should render the registration fields with the student role preselected', () => {
        mockUseAppState.mockImplementation(() => ({ user: null, profile: null, isAuthReady: true }));
        const { getByLabelText, getByTestId } = openRegisterView();

        expect(getByLabelText('Nombre completo')).toBeTruthy();
        expect(getByLabelText('Correo electrónico')).toBeTruthy();
        expect(getByLabelText('Contraseña')).toBeTruthy();
        expect(getByTestId('role-option-estudiante').getAttribute('aria-pressed')).toBe('true');
        expect(getByTestId('role-option-profesor').getAttribute('aria-pressed')).toBe('false');
      });

      it('should call register with the entered data and the default student role', done => {
        const mockRegister = jest.fn(() => Promise.resolve());
        mockUseAppState.mockImplementation(() => ({
          user: null,
          profile: null,
          isAuthReady: true,
          register: mockRegister,
        }));
        const { getByLabelText } = openRegisterView();

        act(() => {
          fireEvent.change(getByLabelText('Nombre completo'), { target: { value: 'Ana García' } });
          fireEvent.change(getByLabelText('Correo electrónico'), { target: { value: 'ana@example.com' } });
          fireEvent.change(getByLabelText('Contraseña'), { target: { value: 'password1' } });
        });
        act(() => {
          fireEvent.submit(getByLabelText('Contraseña').closest('form')!);
        });

        setImmediate(() => {
          expect(mockRegister).toHaveBeenCalledWith('Ana García', 'ana@example.com', 'password1', 'student');
          done();
        });
      });

      it('should call register with the teacher role when "Soy profesor" is selected', done => {
        const mockRegister = jest.fn(() => Promise.resolve());
        mockUseAppState.mockImplementation(() => ({
          user: null,
          profile: null,
          isAuthReady: true,
          register: mockRegister,
        }));
        const { getByLabelText, getByTestId } = openRegisterView();

        act(() => {
          fireEvent.click(getByTestId('role-option-profesor'));
          fireEvent.change(getByLabelText('Nombre completo'), { target: { value: 'Profe' } });
          fireEvent.change(getByLabelText('Correo electrónico'), { target: { value: 'profe@example.com' } });
          fireEvent.change(getByLabelText('Contraseña'), { target: { value: 'password1' } });
        });
        act(() => {
          fireEvent.submit(getByLabelText('Contraseña').closest('form')!);
        });

        setImmediate(() => {
          expect(mockRegister).toHaveBeenCalledWith('Profe', 'profe@example.com', 'password1', 'teacher');
          done();
        });
      });

      it('should map auth/email-already-in-use to a friendly Spanish message', async () => {
        const mockRegister = jest.fn(() => Promise.reject({ code: 'auth/email-already-in-use' }));
        mockUseAppState.mockImplementation(() => ({
          user: null,
          profile: null,
          isAuthReady: true,
          register: mockRegister,
        }));
        const { getByLabelText, getByText } = openRegisterView();

        act(() => {
          fireEvent.change(getByLabelText('Nombre completo'), { target: { value: 'Ana' } });
          fireEvent.change(getByLabelText('Correo electrónico'), { target: { value: 'ana@example.com' } });
          fireEvent.change(getByLabelText('Contraseña'), { target: { value: 'password1' } });
        });
        act(() => {
          fireEvent.submit(getByLabelText('Contraseña').closest('form')!);
        });

        const element = await waitForElement(() =>
          getByText('Ya existe una cuenta con este correo. Inicia sesión para continuar.')
        );
        expect(element).toBeTruthy();
      });

      it('should map auth/weak-password to a friendly Spanish message', async () => {
        const mockRegister = jest.fn(() => Promise.reject({ code: 'auth/weak-password' }));
        mockUseAppState.mockImplementation(() => ({
          user: null,
          profile: null,
          isAuthReady: true,
          register: mockRegister,
        }));
        const { getByLabelText, getByText } = openRegisterView();

        act(() => {
          fireEvent.change(getByLabelText('Nombre completo'), { target: { value: 'Ana' } });
          fireEvent.change(getByLabelText('Correo electrónico'), { target: { value: 'ana@example.com' } });
          fireEvent.change(getByLabelText('Contraseña'), { target: { value: '123' } });
        });
        act(() => {
          fireEvent.submit(getByLabelText('Contraseña').closest('form')!);
        });

        const element = await waitForElement(() =>
          getByText('La contraseña es demasiado débil. Usa al menos 6 caracteres.')
        );
        expect(element).toBeTruthy();
      });

      it('should switch back to the login view', () => {
        mockUseAppState.mockImplementation(() => ({ user: null, profile: null, isAuthReady: true }));
        const { getByText, queryByLabelText } = openRegisterView();

        expect(queryByLabelText('Nombre completo')).toBeTruthy();
        act(() => {
          fireEvent.click(getByText('Iniciar sesión'));
        });
        expect(queryByLabelText('Nombre completo')).toBeNull();
        expect(getByText('Continuar con Google')).toBeTruthy();
      });
    });

    describe('the profile-completion step (authenticated user without a profile)', () => {
      it('should show only the role selector and confirm button', () => {
        mockUseAppState.mockImplementation(() => ({
          user: { displayName: 'Test User' },
          profile: null,
          isAuthReady: true,
        }));
        const { getByText, getByTestId, queryByLabelText } = render(<LoginPage />);

        expect(mockReplace).not.toHaveBeenCalled();
        expect(getByText('¿Cómo vas a usar Attendia?')).toBeTruthy();
        expect(getByTestId('role-option-estudiante').getAttribute('aria-pressed')).toBe('true');
        expect(getByText('Confirmar y continuar')).toBeTruthy();
        // No auth forms in the completion step.
        expect(queryByLabelText('Correo electrónico')).toBeNull();
        expect(queryByLabelText('Contraseña')).toBeNull();
      });

      it('should call completeProfile with the selected role', done => {
        const mockCompleteProfile = jest.fn(() => Promise.resolve());
        mockUseAppState.mockImplementation(() => ({
          user: { displayName: 'Test User' },
          profile: null,
          isAuthReady: true,
          completeProfile: mockCompleteProfile,
        }));
        const { getByText, getByTestId } = render(<LoginPage />);

        act(() => {
          fireEvent.click(getByTestId('role-option-profesor'));
        });
        act(() => {
          fireEvent.submit(getByText('Confirmar y continuar').closest('form')!);
        });

        setImmediate(() => {
          expect(mockCompleteProfile).toHaveBeenCalledWith('teacher');
          done();
        });
      });
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

    describe('role cards', () => {
      it('should render both role cards', () => {
        process.env.REACT_APP_SET_AUTH = 'passcode';
        mockUseAppState.mockImplementation(() => ({ user: null, signIn: () => Promise.resolve(), isAuthReady: true }));
        const { getByTestId, getByText } = render(<LoginPage />);
        expect(getByTestId('role-card-profesor')).toBeTruthy();
        expect(getByTestId('role-card-estudiante')).toBeTruthy();
        expect(getByText('Profesor')).toBeTruthy();
        expect(getByText('Estudiante')).toBeTruthy();
      });

      it('should allow selecting student role card', () => {
        process.env.REACT_APP_SET_AUTH = 'passcode';
        mockUseAppState.mockImplementation(() => ({ user: null, signIn: () => Promise.resolve(), isAuthReady: true }));
        const { getByTestId, getByText } = render(<LoginPage />);

        expect(getByText('Elige tu rol para iniciar el flujo correspondiente.')).toBeTruthy();
        expect(getByTestId('role-card-profesor').getAttribute('aria-pressed')).toBe('true');
        fireEvent.click(getByTestId('role-card-estudiante'));
        expect(getByTestId('role-card-profesor').getAttribute('aria-pressed')).toBe('false');
        expect(getByTestId('role-card-estudiante').getAttribute('aria-pressed')).toBe('true');
      });

      it('should pass selected student role on sign in', done => {
        process.env.REACT_APP_SET_AUTH = 'passcode';
        mockUseAppState.mockImplementation(() => ({ user: null, signIn: () => Promise.resolve(), isAuthReady: true }));
        const { getByTestId, getByLabelText, getByText } = render(<LoginPage />);

        fireEvent.click(getByTestId('role-card-estudiante'));
        act(() => {
          fireEvent.change(getByLabelText('Código de acceso'), { target: { value: '1234' } });
        });
        act(() => {
          fireEvent.submit(getByText('Ingresar'));
        });

        setImmediate(() => {
          expect(mockReplace).toHaveBeenCalledWith({ pathname: '/', state: { preJoinRole: 'student' } });
          done();
        });
      });
    });
  });

  it('should redirect to "/" when auth is disabled', () => {
    delete process.env.REACT_APP_SET_AUTH;
    mockUseAppState.mockImplementation(() => ({ user: null, signIn: () => Promise.resolve(), isAuthReady: true }));
    render(<LoginPage />);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
