import React from 'react';
import { act, fireEvent, render, waitForElement } from '@testing-library/react';
import CreatePasswordDialog from './CreatePasswordDialog';
import { useAppState } from '../../../state';

jest.mock('../../../state');

const mockUseAppState = useAppState as jest.Mock<any>;

describe('the CreatePasswordDialog component', () => {
  const mockCreatePassword = jest.fn(() => Promise.resolve());
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppState.mockImplementation(() => ({ createPassword: mockCreatePassword }));
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
