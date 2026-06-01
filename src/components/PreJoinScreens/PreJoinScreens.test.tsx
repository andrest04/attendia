import React from 'react';
import { act } from 'react-dom/test-utils';
import DeviceSelectionScreen from './DeviceSelectionScreen/DeviceSelectionScreen';
import MediaErrorSnackbar from './MediaErrorSnackbar/MediaErrorSnackbar';
import { mount, shallow } from 'enzyme';
import PreJoinScreens from './PreJoinScreens';
import RoomNameScreen from './RoomNameScreen/RoomNameScreen';
import { useLocation, useParams } from 'react-router-dom';
import { useAppState } from '../../state';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import { setImmediate } from 'timers';

// @ts-ignore
delete window.location;

// @ts-ignore
window.location = {
  pathname: '',
  search: '',
  origin: '',
};

const mockReplaceState = jest.fn();
Object.defineProperty(window.history, 'replaceState', { value: mockReplaceState });

jest.mock('../../state');
jest.mock('react-router-dom', () => ({ useParams: jest.fn(), useLocation: jest.fn() }));
jest.mock('../../hooks/useVideoContext/useVideoContext');
jest.mock('../../hooks/useChatContext/useChatContext', () => () => ({ connect: jest.fn() }));
jest.mock('./MediaErrorSnackbar/MediaErrorSnackbar', () => () => null);
const mockUseAppState = useAppState as jest.Mock<any>;
const mockUseParams = useParams as jest.Mock<any>;
const mockUseLocation = useLocation as jest.Mock<any>;
const mockUseVideoContext = useVideoContext as jest.Mock<any>;

jest.mock('../IntroContainer/IntroContainer', () => ({ children }: { children: React.ReactNode }) => children);
jest.mock('./RoomNameScreen/RoomNameScreen', () => () => null);
jest.mock('./DeviceSelectionScreen/DeviceSelectionScreen', () => () => null);

describe('the PreJoinScreens component', () => {
  beforeEach(jest.clearAllMocks);
  beforeEach(() => {
    mockUseAppState.mockImplementation(() => ({ user: { displayName: 'Test User' } }));
    mockUseParams.mockImplementation(() => ({ URLRoomName: 'testRoom' }));
    mockUseLocation.mockImplementation(() => ({ state: undefined }));
    mockUseVideoContext.mockImplementation(() => ({ getAudioAndVideoTracks: () => Promise.resolve() }));
    // @ts-ignore
    window.location = { ...window.location, origin: '', search: '' };
  });

  it('updates the URL with teacher roomName after create+continue handoff', () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    const wrapper = shallow(<PreJoinScreens />);

    const setClassSessionDraft = wrapper.find(RoomNameScreen).prop('setClassSessionDraft');
    setClassSessionDraft((draft: any) => ({
      ...draft,
      displayName: 'Andres Torres',
      sessionName: 'Sesión Física 101',
      recordingEnabled: true,
      monitoringSensitivity: 'medium',
    }));

    const onCreateClassSession = wrapper.find(RoomNameScreen).prop('onCreateClassSession');
    onCreateClassSession();

    const onContinueToDeviceSelection = wrapper.find(RoomNameScreen).prop('onContinueToDeviceSelection');
    onContinueToDeviceSelection();

    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/room/sesion-fisica-101');
  });

  it('does not update URL for twilio function origin in teacher handoff', () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    // @ts-ignore
    window.location = { ...window.location, origin: 'https://video-app-1234-twil.io' };
    const wrapper = shallow(<PreJoinScreens />);

    wrapper.find(RoomNameScreen).prop('setClassSessionDraft')((draft: any) => ({
      ...draft,
      sessionName: 'Session 1',
      recordingEnabled: true,
      monitoringSensitivity: 'high',
    }));
    wrapper.find(RoomNameScreen).prop('onCreateClassSession')();
    wrapper.find(RoomNameScreen).prop('onContinueToDeviceSelection')();

    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it('switches to DeviceSelection after teacher continue post-create', () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    const wrapper = shallow(<PreJoinScreens />);

    expect(wrapper.find(RoomNameScreen).exists()).toBe(true);
    expect(wrapper.find(DeviceSelectionScreen).exists()).toBe(false);

    wrapper.find(RoomNameScreen).prop('setClassSessionDraft')((draft: any) => ({
      ...draft,
      sessionName: 'Session 1',
      recordingEnabled: true,
      monitoringSensitivity: 'medium',
    }));
    wrapper.find(RoomNameScreen).prop('onCreateClassSession')();
    wrapper.find(RoomNameScreen).prop('onContinueToDeviceSelection')();

    expect(wrapper.find(RoomNameScreen).exists()).toBe(false);
    expect(wrapper.find(DeviceSelectionScreen).exists()).toBe(true);
  });

  it('populates room name from URL and switches to device step for existing displayName', () => {
    const wrapper = mount(<PreJoinScreens />);
    const roomName = wrapper.find(RoomNameScreen).prop('roomName');
    expect(roomName).toBe('testRoom');

    expect(wrapper.find(RoomNameScreen).prop('classSessionDraft').role).toBe('student');
    expect(wrapper.find(RoomNameScreen).exists()).toBe(true);
    expect(wrapper.find(DeviceSelectionScreen).exists()).toBe(false);
  });

  it('keeps roomName step from URL when user displayName is missing', () => {
    mockUseAppState.mockImplementation(() => ({ user: {} }));
    const wrapper = mount(<PreJoinScreens />);
    const roomName = wrapper.find(RoomNameScreen).prop('roomName');
    expect(roomName).toBe('testRoom');
    expect(wrapper.find(RoomNameScreen).prop('classSessionAccess')).toBeNull();

    expect(wrapper.find(RoomNameScreen).exists()).toBe(true);
    expect(wrapper.find(DeviceSelectionScreen).exists()).toBe(false);
  });

  it('continues student flow from link only after explicit continue with name', () => {
    const wrapper = mount(<PreJoinScreens />);

    expect(wrapper.find(RoomNameScreen).prop('classSessionDraft').role).toBe('student');
    act(() => {
      wrapper.find(RoomNameScreen).prop('setName')('Student Name');
    });
    act(() => {
      wrapper.find(RoomNameScreen).prop('onContinueToDeviceSelection')();
    });
    wrapper.update();

    expect(wrapper.find(DeviceSelectionScreen).exists()).toBe(true);
    expect(wrapper.find(DeviceSelectionScreen).prop('name')).toBe('Student Name');
    expect(wrapper.find(DeviceSelectionScreen).prop('roomName')).toBe('testRoom');
  });

  it('continues student flow from manual code entry using joinCode alias of roomName', () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    const wrapper = mount(<PreJoinScreens />);

    expect(wrapper.find(RoomNameScreen).prop('classSessionDraft').role).toBe('teacher');
    act(() => {
      wrapper.find(RoomNameScreen).prop('onSelectRole')('student');
    });
    wrapper.update();
    act(() => {
      wrapper.find(RoomNameScreen).prop('setName')('Ana Student');
      wrapper.find(RoomNameScreen).prop('setStudentJoinCode')('manual-room-42');
    });
    wrapper.update();
    act(() => {
      wrapper.find(RoomNameScreen).prop('onContinueToDeviceSelection')();
    });
    wrapper.update();

    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/room/manual-room-42');
    expect(wrapper.find(DeviceSelectionScreen).prop('name')).toBe('Ana Student');
    expect(wrapper.find(DeviceSelectionScreen).prop('roomName')).toBe('manual-room-42');
  });

  it('continues student flow from a full room link by extracting room segment', () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    const wrapper = mount(<PreJoinScreens />);

    act(() => {
      wrapper.find(RoomNameScreen).prop('onSelectRole')('student');
      wrapper.find(RoomNameScreen).prop('setName')('Ana Student');
      wrapper.find(RoomNameScreen).prop('setStudentJoinCode')(
        'https://example.org/room/fisica-101?lang=es&utm_source=share'
      );
    });
    wrapper.update();

    act(() => {
      wrapper.find(RoomNameScreen).prop('onContinueToDeviceSelection')();
    });
    wrapper.update();

    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/room/fisica-101');
    expect(wrapper.find(DeviceSelectionScreen).prop('roomName')).toBe('fisica-101');
  });

  it('continues student flow from encoded room links and strips querystring', () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    const wrapper = mount(<PreJoinScreens />);

    act(() => {
      wrapper.find(RoomNameScreen).prop('onSelectRole')('student');
      wrapper.find(RoomNameScreen).prop('setName')('Ana Student');
      wrapper.find(RoomNameScreen).prop('setStudentJoinCode')(
        'https://example.org/room/fisica-101%20avanzada?token=abc%3D123'
      );
    });
    wrapper.update();

    act(() => {
      wrapper.find(RoomNameScreen).prop('onContinueToDeviceSelection')();
    });
    wrapper.update();

    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/room/fisica-101%20avanzada');
    expect(wrapper.find(DeviceSelectionScreen).prop('roomName')).toBe('fisica-101 avanzada');
  });

  it('initializes teacher draft and handoff displayName from user displayName', () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    const wrapper = shallow(<PreJoinScreens />);

    const draft = wrapper.find(RoomNameScreen).prop('classSessionDraft');
    expect(draft.role).toBe('teacher');
    expect(draft.displayName).toBe('Test User');
    expect(draft.recordingEnabled).toBe(false);
    expect(draft.monitoringSensitivity).toBe('medium');
    expect(wrapper.find(RoomNameScreen).prop('teacherDisplayName')).toBe('Test User [Profesor]');
  });

  it('initializes student draft role when login selected student', () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    mockUseLocation.mockImplementation(() => ({ state: { preJoinRole: 'student' } }));
    const wrapper = shallow(<PreJoinScreens />);

    expect(wrapper.find(RoomNameScreen).prop('classSessionDraft').role).toBe('student');
  });

  it('prioritizes URLRoomName deep link over login-selected teacher role', () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: 'linked-room' }));
    mockUseLocation.mockImplementation(() => ({ state: { preJoinRole: 'teacher' } }));
    const wrapper = mount(<PreJoinScreens />);

    expect(wrapper.find(RoomNameScreen).prop('classSessionDraft').role).toBe('student');
    expect(wrapper.find(RoomNameScreen).prop('roomName')).toBe('linked-room');
  });

  it('resolves teacher visible identity with suffix after creating class session', () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    const wrapper = shallow(<PreJoinScreens />);

    wrapper.find(RoomNameScreen).prop('setName')('Andres Torres');
    wrapper.find(RoomNameScreen).prop('setClassSessionDraft')((draft: any) => ({
      ...draft,
      displayName: 'Andres Torres',
      sessionName: 'Clase de algebra',
      recordingEnabled: true,
      monitoringSensitivity: 'low',
    }));
    wrapper.find(RoomNameScreen).prop('onCreateClassSession')();
    wrapper.find(RoomNameScreen).prop('onContinueToDeviceSelection')();

    expect(wrapper.find(DeviceSelectionScreen).prop('name')).toBe('Andres Torres [Profesor]');
    expect(wrapper.find(DeviceSelectionScreen).prop('roomName')).toBe('clase-de-algebra');
  });

  it('captures errors from getAudioAndVideoTracks and passes to MediaErrorSnackbar', async () => {
    const mockGetAudioAndVideoTracks = jest.fn(() => Promise.reject('testError'));
    mockUseVideoContext.mockImplementation(() => ({ getAudioAndVideoTracks: mockGetAudioAndVideoTracks }));

    const wrapper = mount(<PreJoinScreens />);
    act(() => {
      wrapper.find(RoomNameScreen).prop('onContinueToDeviceSelection')();
    });

    await act(async () => {
      await new Promise(setImmediate);
      wrapper.update();
    });

    const error = wrapper.find(MediaErrorSnackbar).prop('error');
    expect(error).toBe('testError');
    expect(mockGetAudioAndVideoTracks).toHaveBeenCalledTimes(1);
  });
});
