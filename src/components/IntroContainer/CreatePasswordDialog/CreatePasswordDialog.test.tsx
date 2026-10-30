import React from 'react';
import { act, fireEvent, render, waitForElement } from '@testing-library/react';
import CreatePasswordDialog from './CreatePasswordDialog';
import { useAppState } from '../../../state';
import i18n from '../../../i18n';

jest.mock('../../../state');

const mockUseAppState = useAppState as jest.Mock<any>;

describe('the CreatePasswordDialog component', () => {
  const mockCreatePassword = jest.fn(() => Promise.resolve());
  const mockOnClose = jest.fn();

  beforeEach(async () => {
    await act(async () => { await i18n.changeLanguage('es'); });
    jest.clearAllMocks();
    mockUseAppState.mockImplementation(() => ({ createPassword: mockCreatePassword }));
  });

  afterEach(async () => {
    await act(async () => { await i18n.changeLanguage('es'); });
  });

  const renderDialog = () => render(<CreatePasswordDialog open={true} onClose={mockOnClose} />);

  const fillAndSubmit = (utils: ReturnType<typeof renderDialog>, password: string, confirmation: string) => {
    act(() => {
      fireEvent.change(utils.getByLabelText('Contraseña nueva'), { target: { value: password } });
      fireEvent.change(utils.getByLabelText('Confirmar contraseña'), { target: { value: confirmation } });
    });
    act(() => {
      fireEvent.submit(utils.getByLabelText('Contraseña nueva').closest('form')!);
    });
  };

  it.each([
    ['abc', 'abc', 'La contraseña es demasiado débil. Usa al menos 6 caracteres.', 'The password is too weak. Use at least 6 characters.'],
    ['password1', 'password2', 'Las contraseñas no coinciden.', 'The passwords do not match.'],
  ])('retranslates validation errors without changing input or submitting', async (password, confirmation, spanish, english) => {
    const ui = renderDialog();
    fillAndSubmit(ui, password, confirmation);
    expect(ui.getByText(spanish)).toBeTruthy();
    await act(async () => { await i18n.changeLanguage('en'); });
    expect(ui.getByText(english)).toBeTruthy();
    expect((ui.getByLabelText('New password') as HTMLInputElement).value).toBe(password);
    expect((ui.getByLabelText('Confirm password') as HTMLInputElement).value).toBe(confirmation);
    await act(async () => { await i18n.changeLanguage('es'); });
    expect(ui.getByText(spanish)).toBeTruthy();
    expect(mockCreatePassword).not.toHaveBeenCalled();
  });

  it.each([
    ['auth/weak-password', 'La contraseña es demasiado débil. Usa al menos 6 caracteres.', 'The password is too weak. Use at least 6 characters.'],
    ['auth/requires-recent-login', 'Por seguridad, cierra sesión y vuelve a entrar con Google antes de crear tu contraseña.', 'For security, sign out and sign in again with Google before creating your password.'],
    ['auth/provider-already-linked', 'Esta cuenta ya tiene una contraseña configurada. Inicia sesión con tu correo y contraseña.', 'This account already has a password. Sign in with your email and password.'],
    ['auth/credential-already-in-use', 'Esta cuenta ya tiene una contraseña configurada. Inicia sesión con tu correo y contraseña.', 'This account already has a password. Sign in with your email and password.'],
    ['auth/email-already-in-use', 'Esta cuenta ya tiene una contraseña configurada. Inicia sesión con tu correo y contraseña.', 'This account already has a password. Sign in with your email and password.'],
    [null, 'No se pudo crear la contraseña. Intenta de nuevo.', 'The password could not be created. Please try again.'],
  ])('retranslates Firebase error %s without retrying', async (code, spanish, english) => {
    mockCreatePassword.mockImplementationOnce(() => Promise.reject(code ? { code } : null));
    const ui = renderDialog();
    fillAndSubmit(ui, 'password1', 'password1');
    await waitForElement(() => ui.getByText(spanish));
    await act(async () => { await i18n.changeLanguage('en'); });
    expect(ui.getByText(english)).toBeTruthy();
    expect((ui.getByLabelText('New password') as HTMLInputElement).value).toBe('password1');
    await act(async () => { await i18n.changeLanguage('es'); });
    expect(ui.getByText(spanish)).toBeTruthy();
    expect(mockCreatePassword).toHaveBeenCalledTimes(1);
  });

  it('should show a validation error for a password shorter than 6 characters', () => {
    const utils = renderDialog();
    fillAndSubmit(utils, 'abc', 'abc');

    expect(utils.getByText('La contraseña es demasiado débil. Usa al menos 6 caracteres.')).toBeTruthy();
    expect(mockCreatePassword).not.toHaveBeenCalled();
  });

  it('should show a validation error when the passwords do not match', () => {
    const utils = renderDialog();
    fillAndSubmit(utils, 'password1', 'password2');

    expect(utils.getByText('Las contraseñas no coinciden.')).toBeTruthy();
    expect(mockCreatePassword).not.toHaveBeenCalled();
  });

  it('should call createPassword and show the success state on submit', async () => {
    const utils = renderDialog();
    fillAndSubmit(utils, 'password1', 'password1');

    expect(mockCreatePassword).toHaveBeenCalledWith('password1');
    await waitForElement(() =>
      utils.getByText('Contraseña creada. Ya puedes iniciar sesión con tu correo y contraseña.')
    );

    act(() => {
      fireEvent.click(utils.getByText('Entendido'));
    });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should map auth/requires-recent-login to the Spanish re-login message', async () => {
    mockCreatePassword.mockImplementationOnce(() => Promise.reject({ code: 'auth/requires-recent-login' }));
    const utils = renderDialog();
    fillAndSubmit(utils, 'password1', 'password1');

    await waitForElement(() =>
      utils.getByText('Por seguridad, cierra sesión y vuelve a entrar con Google antes de crear tu contraseña.')
    );
  });

  it('should close without calling createPassword when Cancelar is clicked', () => {
    const utils = renderDialog();

    act(() => {
      fireEvent.click(utils.getByText('Cancelar'));
    });

    expect(mockOnClose).toHaveBeenCalled();
    expect(mockCreatePassword).not.toHaveBeenCalled();
  });
});
