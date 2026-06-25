import React from 'react';
import DeviceSelectionScreen from './DeviceSelectionScreen';
import CircularProgress from '@material-ui/core/CircularProgress';
import Button from '@material-ui/core/Button';
import { shallow } from 'enzyme';
import { Steps } from '../PreJoinScreens';
import { useAppState } from '../../../state';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';
import ToggleVideoButton from '../../Buttons/ToggleVideoButton/ToggleVideoButton';
import ToggleAudioButton from '../../Buttons/ToggleAudioButton/ToggleAudioButton';
import useLightingCheck from '../../../hooks/useLightingCheck/useLightingCheck';
import { setImmediate } from 'timers';

jest.mock('../../../hooks/useLightingCheck/useLightingCheck');
const mockUseLightingCheck = useLightingCheck as jest.Mock;
// Module-level default so any render (incl. before beforeEach runs) gets a valid object.
mockUseLightingCheck.mockReturnValue({ status: 'analyzing', luminance: null });

const mockUseAppState = useAppState as jest.Mock<any>;
const mockUseVideoContext = useVideoContext as jest.Mock<any>;

const mockConnect = jest.fn();
const mockChatConnect = jest.fn(() => Promise.resolve());
const mockGetToken = jest.fn(() => Promise.resolve({ token: 'mockToken' }));

jest.mock('../../../hooks/useChatContext/useChatContext', () => () => ({ connect: mockChatConnect }));
jest.mock('../../../hooks/useVideoContext/useVideoContext');
jest.mock('../../../state');

mockUseAppState.mockImplementation(() => ({ getToken: mockGetToken, isFetching: false }));
mockUseVideoContext.mockImplementation(() => ({
  connect: mockConnect,
  isAcquiringLocalTracks: false,
  isConnecting: false,
  localTracks: [],
}));

describe('the DeviceSelectionScreen component', () => {
  beforeEach(() => {
    process.env.REACT_APP_DISABLE_TWILIO_CONVERSATIONS = 'false';
    jest.clearAllMocks();
    // Default: jsdom has no canvas frame, so the real hook reports 'analyzing'.
    mockUseLightingCheck.mockReturnValue({ status: 'analyzing', luminance: null });
  });

  it('dismisses the lighting warning banner when the × close button is clicked', () => {
    mockUseLightingCheck.mockReturnValue({ status: 'low', luminance: 10 });
    // The banner only makes sense when the camera is actually delivering frames,
    // so provide an unmuted local video track for this scenario.
    mockUseVideoContext.mockReturnValueOnce({
      connect: mockConnect,
      isAcquiringLocalTracks: false,
      isConnecting: false,
      localTracks: [{ kind: 'video', name: 'camera', mediaStreamTrack: { muted: false } }],
    });
    const wrapper = shallow(<DeviceSelectionScreen name="test name" roomName="test room name" setStep={() => {}} />);

    expect(wrapper.find('[aria-label="Cerrar aviso"]').exists()).toBe(true);
    wrapper.find('[aria-label="Cerrar aviso"]').simulate('click');
    expect(wrapper.find('[aria-label="Cerrar aviso"]').exists()).toBe(false);
  });

  it('does not report adequate lighting when the camera track is muted (blocked by the OS)', () => {
    // Even if the luminance read clears the threshold, a muted source means no
    // real frame — the lighting verdict must not be a false positive.
    mockUseLightingCheck.mockReturnValue({ status: 'ok', luminance: 150 });
    mockUseVideoContext.mockReturnValueOnce({
      connect: mockConnect,
      isAcquiringLocalTracks: false,
      isConnecting: false,
      localTracks: [{ kind: 'video', name: 'camera', mediaStreamTrack: { muted: true } }],
    });
    const wrapper = shallow(<DeviceSelectionScreen name="test name" roomName="test room name" setStep={() => {}} />);

    expect(wrapper.text()).toContain('Iluminación (cámara bloqueada)');
    expect(wrapper.text()).not.toContain('Iluminación adecuada');
  });

  describe('when connecting to a room', () => {
    mockUseVideoContext.mockImplementationOnce(() => ({
      connect: mockConnect,
      isAcquiringLocalTracks: false,
      isConnecting: true,
      localTracks: [],
    }));

    const wrapper = shallow(<DeviceSelectionScreen name="test name" roomName="test room name" setStep={() => {}} />);

    it('should show the loading screen', () => {
      expect(wrapper.find(CircularProgress).exists()).toBe(true);
    });

    it('should disable the desktop and mobile toggle video buttons', () => {
      expect(wrapper.find(ToggleVideoButton).every({ disabled: true })).toBe(true);
    });

    it('should disable the desktop and mobile toggle audio buttons', () => {
      expect(wrapper.find(ToggleAudioButton).every({ disabled: true })).toBe(true);
    });
  });

  describe('when acquiring local tracks', () => {
    mockUseVideoContext.mockImplementationOnce(() => ({
      connect: mockConnect,
      isAcquiringLocalTracks: true,
      isConnecting: false,
      localTracks: [],
    }));

    const wrapper = shallow(<DeviceSelectionScreen name="test name" roomName="test room name" setStep={() => {}} />);

    it('should disable the Join Now, toggle video, and toggle audio buttons', () => {
      expect(wrapper.find('[data-cy-join-now]').prop('disabled')).toBe(true);
    });

    it('should disable the desktop and mobile toggle video buttons', () => {
      expect(wrapper.find(ToggleVideoButton).every({ disabled: true })).toBe(true);
    });

    it('should disable the desktop and mobile toggle audio buttons', () => {
      expect(wrapper.find(ToggleAudioButton).every({ disabled: true })).toBe(true);
    });
  });

  describe('when fetching a token', () => {
    mockUseVideoContext.mockImplementationOnce(() => ({
      connect: mockConnect,
      isAcquiringLocalTracks: false,
      isConnecting: false,
      localTracks: [],
    }));
    mockUseAppState.mockImplementationOnce(() => ({ getToken: mockGetToken, isFetching: true }));
    const wrapper = shallow(<DeviceSelectionScreen name="test name" roomName="test room name" setStep={() => {}} />);

    it('should show the loading screen', () => {
      expect(wrapper.find(CircularProgress).exists()).toBe(true);
    });

    it('should disable the desktop and mobile toggle video buttons', () => {
      expect(wrapper.find(ToggleVideoButton).every({ disabled: true })).toBe(true);
    });

    it('should disable the desktop and mobile toggle audio buttons', () => {
      expect(wrapper.find(ToggleAudioButton).every({ disabled: true })).toBe(true);
    });
  });

  it('should not disable the Join Now button by default', () => {
    const wrapper = shallow(<DeviceSelectionScreen name="test name" roomName="test room name" setStep={() => {}} />);
    expect(wrapper.find('[data-cy-join-now]').prop('disabled')).toBe(false);
  });

  it('should show the waiting room subtitle with the class name', () => {
    const wrapper = shallow(<DeviceSelectionScreen name="test name" roomName="test room name" setStep={() => {}} />);
    expect(wrapper.text()).toContain('Verifica tus dispositivos antes de entrar · Clase: test room name');
  });

  it('should go back to the RoomNameScreen when the Cancel button is clicked', () => {
    const mockSetStep = jest.fn();
    const wrapper = shallow(<DeviceSelectionScreen name="test name" roomName="test room name" setStep={mockSetStep} />);
    wrapper
      .find(Button)
      .filterWhere(b => b.prop('children') === 'Cancelar')
      .simulate('click');
    expect(mockSetStep).toHaveBeenCalledWith(Steps.roomNameStep);
  });

  it('should fetch a token and connect to the Video SDK and Conversations SDK when the Join Now button is clicked', done => {
    const wrapper = shallow(<DeviceSelectionScreen name="test name" roomName="test room name" setStep={() => {}} />);
    wrapper.find('[data-cy-join-now]').simulate('click');

    expect(mockGetToken).toHaveBeenCalledWith('test name', 'test room name');
    setImmediate(() => {
      expect(mockConnect).toHaveBeenCalledWith('mockToken');
      expect(mockChatConnect).toHaveBeenCalledWith('mockToken');
      done();
    });
  });

  it('keeps shared S2 boundary by calling getToken(name, roomName) for student inputs', done => {
    const wrapper = shallow(<DeviceSelectionScreen name="Ana Student" roomName="manual-room-42" setStep={() => {}} />);
    wrapper.find('[data-cy-join-now]').simulate('click');

    expect(mockGetToken).toHaveBeenCalledWith('Ana Student', 'manual-room-42');
    setImmediate(() => {
      expect(mockConnect).toHaveBeenCalledWith('mockToken');
      done();
    });
  });

  it('should fetch a token and connect to the Video SDK only when the Join Now button is clicked when the REACT_APP_DISABLE_TWILIO_CONVERSATIONS variable is true', done => {
    process.env.REACT_APP_DISABLE_TWILIO_CONVERSATIONS = 'true';
    const wrapper = shallow(<DeviceSelectionScreen name="test name" roomName="test room name" setStep={() => {}} />);
    wrapper.find('[data-cy-join-now]').simulate('click');

    expect(mockGetToken).toHaveBeenCalledWith('test name', 'test room name');
    setImmediate(() => {
      expect(mockConnect).toHaveBeenCalledWith('mockToken');
      expect(mockChatConnect).not.toHaveBeenCalledWith('mockToken');
      done();
    });
  });
});
