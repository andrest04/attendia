import React from 'react';
import MediaErrorSnackBar, { getSnackbarContent } from './MediaErrorSnackbar';
import { shallow } from 'enzyme';
import useDevices from '../../../hooks/useDevices/useDevices';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';

jest.mock('../../../hooks/useVideoContext/useVideoContext');
jest.mock('../../../hooks/useDevices/useDevices');

const mockUseVideoContext = useVideoContext as jest.Mock<any>;
const mockUseDevices = useDevices as jest.Mock<any>;

describe('the MediaErrorSnackBar', () => {
  beforeEach(() => {
    mockUseVideoContext.mockImplementation(() => ({ isAcquiringLocalTracks: false }));
    mockUseDevices.mockImplementation(() => ({ hasAudioInputDevices: true, hasVideoInputDevices: true }));
  });

  it('should be closed by default', () => {
    const wrapper = shallow(<MediaErrorSnackBar />);
    expect(wrapper.prop('open')).toBe(false);
  });

  it('should open when there is an error', () => {
    const wrapper = shallow(<MediaErrorSnackBar error={new Error('testError')} />);
    expect(wrapper.prop('open')).toBe(true);
  });

  it('should open when there are no audio devices', () => {
    mockUseDevices.mockImplementation(() => ({ hasAudioInputDevices: false, hasVideoInputDevices: true }));
    const wrapper = shallow(<MediaErrorSnackBar />);
    expect(wrapper.prop('open')).toBe(true);
  });

  it('should open when there are no video devices', () => {
    mockUseDevices.mockImplementation(() => ({ hasAudioInputDevices: true, hasVideoInputDevices: false }));
    const wrapper = shallow(<MediaErrorSnackBar />);
    expect(wrapper.prop('open')).toBe(true);
  });

  it('should not open when there local tracks are being acquired', () => {
    mockUseVideoContext.mockImplementation(() => ({ isAcquiringLocalTracks: true }));
    const wrapper = shallow(<MediaErrorSnackBar error={new Error('testError')} />);
    expect(wrapper.prop('open')).toBe(false);
  });

  it('should close after the handleClose function is called', () => {
    const wrapper = shallow(<MediaErrorSnackBar error={new Error('testError')} />);
    expect(wrapper.prop('open')).toBe(true);
    wrapper.prop('handleClose')(); // Close snackbar
    expect(wrapper.prop('open')).toBe(false);
  });
});

describe('the getSnackbarContent function', () => {
  it('return empty strings by default', () => {
    const results = getSnackbarContent(true, true);
    expect(results).toMatchInlineSnapshot(`
      {
        "headline": "",
        "message": "",
      }
    `);
  });

  it('should return the correct content when there are no audio devices', () => {
    const results = getSnackbarContent(false, true);
    expect(results).toMatchInlineSnapshot(`
      {
        "headline": "No se detectó micrófono:",
        "message": "Los demás participantes no podrán escucharte.",
      }
    `);
  });

  it('should return the correct content when there are no video devices', () => {
    const results = getSnackbarContent(true, false);
    expect(results).toMatchInlineSnapshot(`
      {
        "headline": "No se detectó cámara:",
        "message": "Los demás participantes no podrán verte.",
      }
    `);
  });

  it('should return the correct content when there are no audio or video devices', () => {
    const results = getSnackbarContent(false, false);
    expect(results).toMatchInlineSnapshot(`
      {
        "headline": "No se detectó cámara ni micrófono:",
        "message": "Los demás participantes no podrán verte ni escucharte.",
      }
    `);
  });

  it('should return the correct content when there is a NotAllowedError', () => {
    const error = new Error();
    error.name = 'NotAllowedError';
    const results = getSnackbarContent(true, true, error);
    expect(results).toMatchInlineSnapshot(`
      {
        "headline": "No se puede acceder a los medios:",
        "message": "El usuario denegó el permiso para usar el audio y el video. Por favor, concede acceso al micrófono y la cámara en el navegador.",
      }
    `);
  });

  it('should return the correct content when there is a NotAllowedError with "Permission denied by syste" message', () => {
    const error = new Error('Permission denied by system');
    error.name = 'NotAllowedError';
    const results = getSnackbarContent(true, true, error);
    expect(results).toMatchInlineSnapshot(`
      {
        "headline": "No se puede acceder a los medios:",
        "message": "El sistema operativo bloqueó el acceso del navegador al micrófono o la cámara. Verifica la configuración de privacidad del sistema.",
      }
    `);
  });

  it('should return the correct content when there is a NotFoundError', () => {
    const error = new Error();
    error.name = 'NotFoundError';
    const results = getSnackbarContent(true, true, error);
    expect(results).toMatchInlineSnapshot(`
      {
        "headline": "No se encontró micrófono ni cámara:",
        "message": "El navegador no puede acceder al micrófono o la cámara. Asegúrate de que los dispositivos estén conectados y habilitados.",
      }
    `);
  });

  it('should return the correct content when there is any other kind of error', () => {
    const error = new Error('Any other device errors');
    error.name = 'OtherDeviceError';
    const results = getSnackbarContent(true, true, error);
    expect(results).toMatchInlineSnapshot(`
      {
        "headline": "Error al acceder a los medios:",
        "message": "OtherDeviceError Any other device errors",
      }
    `);
  });

  it('should return the correct content when there is a CameraPermissionsDenied error', () => {
    const error = new Error('CameraPermissionsDenied');
    const results = getSnackbarContent(true, true, error);
    expect(results).toMatchInlineSnapshot(`
      {
        "headline": "No se puede acceder a los medios:",
        "message": "El usuario denegó el permiso para usar el video. Por favor, concede acceso a la cámara en el navegador.",
      }
    `);
  });

  it('should return the correct content when there is a MicrophonePermissionsDenied error', () => {
    const error = new Error('MicrophonePermissionsDenied');
    const results = getSnackbarContent(true, true, error);
    expect(results).toMatchInlineSnapshot(`
      {
        "headline": "No se puede acceder a los medios:",
        "message": "El usuario denegó el permiso para usar el audio. Por favor, concede acceso al micrófono en el navegador.",
      }
    `);
  });
});
