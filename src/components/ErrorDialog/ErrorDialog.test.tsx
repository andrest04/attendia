import React from 'react';
import { shallow } from 'enzyme';
import { TwilioError } from 'twilio-video';

import Button from '@material-ui/core/Button';
import { Dialog } from '@material-ui/core';
import DialogContentText from '@material-ui/core/DialogContentText';

import ErrorDialog from './ErrorDialog';
import { ClientApiError } from '../../state/useFirebaseAuth/apiClient';

describe('the ErrorDialog component', () => {
  const message = 'Fake Error message';
  const code = 45345;

  it('should be closed if no error is passed', () => {
    const wrapper = shallow(<ErrorDialog dismissError={() => {}} error={null} />);
    expect(wrapper.find(Dialog).prop('open')).toEqual(false);
  });

  it('should be open if an error is passed', () => {
    const error = {} as TwilioError;
    const wrapper = shallow(<ErrorDialog dismissError={() => {}} error={error} />);
    expect(wrapper.find(Dialog).prop('open')).toEqual(true);
  });

  it('should display error message but not error code is the later does not exist', () => {
    const error = { message } as TwilioError;
    const wrapper = shallow(<ErrorDialog dismissError={() => {}} error={error} />);
    expect(wrapper.find(DialogContentText).text()).toBe(message);
    expect(wrapper.find('code').exists()).toBe(false);
  });

  it('should display error message and error code when both are given', () => {
    const error = { message, code } as TwilioError;
    const wrapper = shallow(<ErrorDialog dismissError={() => {}} error={error} />);
    expect(wrapper.find(DialogContentText).text()).toBe('Ocurrió un error inesperado.');
    expect(wrapper.find('code').exists()).toBe(true);
    expect(wrapper.find('code').text()).toBe(`Código de error: ${code}`);
  });

  it('preserves an ordinary application error', () => {
    const wrapper = shallow(<ErrorDialog dismissError={() => {}} error={new Error('Error de aplicación')} />);
    expect(wrapper.find(DialogContentText).text()).toBe('Error de aplicación');
  });

  it('hides untranslated server text when no Spanish explanation was provided', () => {
    const error = new ClientApiError(500, 'Internal server error', 'Internal server error', false);
    const wrapper = shallow(<ErrorDialog dismissError={() => {}} error={error} />);
    expect(wrapper.find(DialogContentText).text()).toBe('No se pudo completar la solicitud.');
    expect(error.message).toBe('No se pudo completar la solicitud.');
  });

  it('preserves a string API code without treating it as a numeric Twilio code', () => {
    const error = new ClientApiError(403, '20101', 'Explicación del servidor.');
    const wrapper = shallow(<ErrorDialog dismissError={() => {}} error={error} />);
    expect(wrapper.find(DialogContentText).text()).toBe('Explicación del servidor.');
    expect(wrapper.find('code').text()).toBe('Código de error: 20101');
  });

  it('preserves ordinary application errors even with numeric codes', () => {
    const error = Object.assign(new Error('Error de aplicación'), { code: 123 });
    const wrapper = shallow(<ErrorDialog dismissError={() => {}} error={error} />);
    expect(wrapper.find(DialogContentText).text()).toBe('Error de aplicación');
  });

  it('hides unknown browser exception messages', () => {
    const wrapper = shallow(<ErrorDialog dismissError={() => {}} error={new DOMException('raw', 'UnknownError')} />);
    expect(wrapper.find(DialogContentText).text()).toBe('Ocurrió un error inesperado.');
  });

  it('should display an enhanced error message when error code is 20101', () => {
    const error = { message, code: 20101 } as TwilioError;
    const wrapper = shallow(<ErrorDialog dismissError={() => {}} error={error} />);
    expect(wrapper.find(DialogContentText).text()).toBe(
      'No se pudo validar la sesión. Verifica que las credenciales sean correctas.'
    );
    expect(wrapper.find('code').text()).toBe(`Código de error: ${20101}`);
  });

  it('should display an enhanced error message when the error message is "Permission denied by system"', () => {
    const error = { message: 'Permission denied by system', code: 0 } as TwilioError;
    const wrapper = shallow(<ErrorDialog dismissError={() => {}} error={error} />);
    expect(wrapper.find(DialogContentText).text()).toBe(
      'No se puede compartir la pantalla. Verifica que el sistema operativo tenga habilitados los permisos para compartir pantalla.'
    );
  });

  it('should display a Spanish actionable message when the camera is in use (NotReadableError)', () => {
    const error = { message: 'Failed to allocate videosource', name: 'NotReadableError' } as TwilioError;
    const wrapper = shallow(<ErrorDialog dismissError={() => {}} error={error} />);
    expect(wrapper.find(DialogContentText).text()).toBe(
      'No se pudo iniciar la cámara. Cierra otras aplicaciones o pestañas que la estén usando y vuelve a intentar.'
    );
  });

  it('should display a Spanish actionable message when permission is denied (NotAllowedError)', () => {
    const error = { message: 'Permission denied', name: 'NotAllowedError' } as TwilioError;
    const wrapper = shallow(<ErrorDialog dismissError={() => {}} error={error} />);
    expect(wrapper.find(DialogContentText).text()).toBe(
      'El navegador bloqueó el acceso a la cámara o el micrófono. Haz clic en el ícono de la cámara (a la izquierda de la barra de direcciones), permite el acceso y vuelve a intentar.'
    );
  });

  it('should display a Spanish actionable message when no device is found (NotFoundError)', () => {
    const error = { message: 'Requested device not found', name: 'NotFoundError' } as TwilioError;
    const wrapper = shallow(<ErrorDialog dismissError={() => {}} error={error} />);
    expect(wrapper.find(DialogContentText).text()).toBe(
      'No se encontró una cámara o un micrófono. Conecta un dispositivo y vuelve a intentar.'
    );
  });

  it('should invoke dismissError prop when the user clicks on OK button', () => {
    const error = { message, code } as TwilioError;
    const dismissError = jest.fn();
    const wrapper = shallow(<ErrorDialog dismissError={dismissError} error={error} />);
    wrapper.find(Button).simulate('click');
    expect(dismissError).toHaveBeenCalled();
  });
});
