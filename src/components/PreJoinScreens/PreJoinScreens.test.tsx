import React from 'react';
import { act } from 'react-dom/test-utils';
import DeviceSelectionScreen from './DeviceSelectionScreen/DeviceSelectionScreen';
import IntroContainer from '../IntroContainer/IntroContainer';
import MediaErrorSnackbar from './MediaErrorSnackbar/MediaErrorSnackbar';
import { mount, shallow } from 'enzyme';
import PreJoinScreens from './PreJoinScreens';
import RoomNameScreen from './RoomNameScreen/RoomNameScreen';
import { useLocation, useParams } from 'react-router-dom';
import { useAppState } from '../../state';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import { checkRoomOpen } from './checkRoomOpen';
import { getResumableSession } from './rejoinSession';
import useAutoRejoin from './useAutoRejoin';
import { Steps } from './steps';
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
jest.mock('./checkRoomOpen');
// Only getResumableSession is mocked; the role helpers (isTeacherIdentity, stripTeacherSuffix)
// stay real because they are pure.
jest.mock('./rejoinSession', () => ({
  ...jest.requireActual('./rejoinSession'),
  getResumableSession: jest.fn(),
}));
jest.mock('./useAutoRejoin');
const mockCheckRoomOpen = checkRoomOpen as jest.Mock;
const mockGetResumableSession = getResumableSession as jest.Mock;
const mockUseAutoRejoin = useAutoRejoin as jest.Mock;
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
    mockUseAppState.mockImplementation(() => ({
      user: { displayName: 'Test User' },
      getToken: jest.fn(() => Promise.resolve({ token: 'token' })),
      error: null,
      setError: jest.fn(),
    }));
    mockUseParams.mockImplementation(() => ({ URLRoomName: 'testRoom' }));
    mockUseLocation.mockImplementation(() => ({ state: undefined }));
    mockUseVideoContext.mockImplementation(() => ({
      getAudioAndVideoTracks: () => Promise.resolve(),
      connect: jest.fn(() => Promise.resolve()),
      removeLocalAudioTrack: jest.fn(),
      removeLocalVideoTrack: jest.fn(),
    }));
    // Default: no persisted rejoin session (the common deep-link / fresh-lobby case).
    mockGetResumableSession.mockReturnValue(null);
    // Default: not rejoining, so the lobby renders (existing tests assert on RoomNameScreen).
    mockUseAutoRejoin.mockReturnValue(false);
    // Default: the open-room probe says the room is open so the student flow proceeds.
    mockCheckRoomOpen.mockResolvedValue(true);
    // @ts-ignore
    window.location = { ...window.location, origin: '', search: '' };
  });

  it('updates the URL with teacher roomName after create+continue handoff', async () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    // No collision for the teacher's chosen slug, so it comes back unchanged.
    mockCheckRoomOpen.mockResolvedValue(false);
    const wrapper = shallow(<PreJoinScreens />);

    const setClassSessionDraft = wrapper.find(RoomNameScreen).prop('setClassSessionDraft');
    setClassSessionDraft((draft: any) => ({
      ...draft,
      displayName: 'Andres Torres',
      sessionName: 'Sesión Física 101',
      monitoringSensitivity: 'medium',
    }));

    const onCreateClassSession = wrapper.find(RoomNameScreen).prop('onCreateClassSession');
    await act(async () => {
      await onCreateClassSession();
    });

    const onContinueToDeviceSelection = wrapper.find(RoomNameScreen).prop('onContinueToDeviceSelection');
    onContinueToDeviceSelection();

    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/room/sesion-fisica-101');
  });

  it('does not update URL for twilio function origin in teacher handoff', async () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    mockCheckRoomOpen.mockResolvedValue(false);
    // @ts-ignore
    window.location = { ...window.location, origin: 'https://video-app-1234-twil.io' };
    const wrapper = shallow(<PreJoinScreens />);

    wrapper.find(RoomNameScreen).prop('setClassSessionDraft')((draft: any) => ({
      ...draft,
      sessionName: 'Session 1',
      monitoringSensitivity: 'high',
    }));
    await act(async () => {
      await wrapper.find(RoomNameScreen).prop('onCreateClassSession')();
    });
    wrapper.find(RoomNameScreen).prop('onContinueToDeviceSelection')();

    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it('switches to DeviceSelection after teacher continue post-create', async () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    mockCheckRoomOpen.mockResolvedValue(false);
    const wrapper = shallow(<PreJoinScreens />);

    expect(wrapper.find(RoomNameScreen).exists()).toBe(true);
    expect(wrapper.find(DeviceSelectionScreen).exists()).toBe(false);

    wrapper.find(RoomNameScreen).prop('setClassSessionDraft')((draft: any) => ({
      ...draft,
      sessionName: 'Session 1',
      monitoringSensitivity: 'medium',
    }));
    await act(async () => {
      await wrapper.find(RoomNameScreen).prop('onCreateClassSession')();
    });
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

  it('continues student flow from link only after explicit continue with name', async () => {
    const wrapper = mount(<PreJoinScreens />);

    expect(wrapper.find(RoomNameScreen).prop('classSessionDraft').role).toBe('student');
    act(() => {
      wrapper.find(RoomNameScreen).prop('setName')('Student Name');
    });
    await act(async () => {
      await wrapper.find(RoomNameScreen).prop('onContinueToDeviceSelection')();
    });
    wrapper.update();

    expect(wrapper.find(DeviceSelectionScreen).exists()).toBe(true);
    expect(wrapper.find(DeviceSelectionScreen).prop('name')).toBe('Student Name');
    expect(wrapper.find(DeviceSelectionScreen).prop('roomName')).toBe('testroom');
  });

  it('continues student flow from manual code entry using joinCode alias of roomName', async () => {
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
    await act(async () => {
      await wrapper.find(RoomNameScreen).prop('onContinueToDeviceSelection')();
    });
    wrapper.update();

    expect(mockCheckRoomOpen).toHaveBeenCalledWith('manual-room-42');
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/room/manual-room-42');
    expect(wrapper.find(DeviceSelectionScreen).prop('name')).toBe('Ana Student');
    expect(wrapper.find(DeviceSelectionScreen).prop('roomName')).toBe('manual-room-42');
  });

  it('continues student flow from a full room link by extracting room segment', async () => {
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

    await act(async () => {
      await wrapper.find(RoomNameScreen).prop('onContinueToDeviceSelection')();
    });
    wrapper.update();

    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/room/fisica-101');
    expect(wrapper.find(DeviceSelectionScreen).prop('roomName')).toBe('fisica-101');
  });

  it('continues student flow from encoded room links and strips querystring', async () => {
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

    await act(async () => {
      await wrapper.find(RoomNameScreen).prop('onContinueToDeviceSelection')();
    });
    wrapper.update();

    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/room/fisica-101-avanzada');
    expect(wrapper.find(DeviceSelectionScreen).prop('roomName')).toBe('fisica-101-avanzada');
  });

  it('keeps the student on the room-name step and flags a closed room without navigating', async () => {
    mockCheckRoomOpen.mockResolvedValue(false);
    const wrapper = mount(<PreJoinScreens />);

    act(() => {
      wrapper.find(RoomNameScreen).prop('setName')('Student Name');
    });
    await act(async () => {
      await wrapper.find(RoomNameScreen).prop('onContinueToDeviceSelection')();
    });
    wrapper.update();

    expect(mockCheckRoomOpen).toHaveBeenCalledWith('testroom');
    expect(wrapper.find(DeviceSelectionScreen).exists()).toBe(false);
    expect(wrapper.find(RoomNameScreen).exists()).toBe(true);
    expect(wrapper.find(RoomNameScreen).prop('roomClosedError')).toBe(true);
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it('lets the student proceed when the open-room check is inconclusive (null)', async () => {
    mockCheckRoomOpen.mockResolvedValue(null);
    const wrapper = mount(<PreJoinScreens />);

    act(() => {
      wrapper.find(RoomNameScreen).prop('setName')('Student Name');
    });
    await act(async () => {
      await wrapper.find(RoomNameScreen).prop('onContinueToDeviceSelection')();
    });
    wrapper.update();

    expect(wrapper.find(DeviceSelectionScreen).exists()).toBe(true);
    expect(wrapper.find(DeviceSelectionScreen).prop('roomName')).toBe('testroom');
  });

  it('does not probe room existence again on teacher continue (only the create-time collision check runs)', async () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    mockCheckRoomOpen.mockResolvedValue(false);
    const wrapper = shallow(<PreJoinScreens />);

    wrapper.find(RoomNameScreen).prop('setClassSessionDraft')((draft: any) => ({
      ...draft,
      sessionName: 'Session 1',
      monitoringSensitivity: 'medium',
    }));
    await act(async () => {
      await wrapper.find(RoomNameScreen).prop('onCreateClassSession')();
    });
    expect(mockCheckRoomOpen).toHaveBeenCalledTimes(1);

    mockCheckRoomOpen.mockClear();
    await act(async () => {
      await wrapper.find(RoomNameScreen).prop('onContinueToDeviceSelection')();
    });

    expect(mockCheckRoomOpen).not.toHaveBeenCalled();
    expect(wrapper.find(DeviceSelectionScreen).exists()).toBe(true);
  });

  it('invalidates a created session when the teacher edits the session name', async () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    mockCheckRoomOpen.mockResolvedValue(false);
    const wrapper = mount(<PreJoinScreens />);

    act(() => {
      wrapper.find(RoomNameScreen).prop('setClassSessionDraft')((draft: any) => ({
        ...draft,
        displayName: 'Andres',
        sessionName: 'Clase 1',
        monitoringSensitivity: 'medium',
      }));
    });
    wrapper.update();
    await act(async () => {
      await wrapper.find(RoomNameScreen).prop('onCreateClassSession')();
    });
    wrapper.update();

    expect(wrapper.find(RoomNameScreen).prop('classSessionAccess')).not.toBeNull();

    act(() => {
      wrapper.find(RoomNameScreen).prop('setClassSessionDraft')((draft: any) => ({ ...draft, sessionName: 'Clase 2' }));
    });
    wrapper.update();

    expect(wrapper.find(RoomNameScreen).prop('classSessionAccess')).toBeNull();
  });

  it('initializes teacher draft and handoff displayName from user displayName', () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    const wrapper = shallow(<PreJoinScreens />);

    const draft = wrapper.find(RoomNameScreen).prop('classSessionDraft');
    expect(draft.role).toBe('teacher');
    expect(draft.displayName).toBe('Test User');
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

  // ── Verified profile role (firebase mode) ────────────────────────────────────────
  // When a Firestore-backed profile exists, its role wins over EVERYTHING: deep links,
  // login-selected roles and resumable sessions. Without a profile the legacy chain
  // (covered by the tests above) applies byte-for-byte.

  it('keeps a profile teacher as teacher even on a student deep link', () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: 'linked-room' }));
    mockUseAppState.mockImplementation(() => ({
      user: { displayName: 'Profe' },
      profile: { displayName: 'Profe', email: 'profe@example.com', role: 'teacher' },
    }));
    const wrapper = mount(<PreJoinScreens />);

    expect(wrapper.find(RoomNameScreen).prop('classSessionDraft').role).toBe('teacher');
    expect(wrapper.find(RoomNameScreen).prop('roomName')).toBe('linked-room');
  });

  it('keeps a profile student as student even when login state says teacher', () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    mockUseLocation.mockImplementation(() => ({ state: { preJoinRole: 'teacher' } }));
    mockUseAppState.mockImplementation(() => ({
      user: { displayName: 'Ana' },
      profile: { displayName: 'Ana', email: 'ana@example.com', role: 'student' },
    }));
    const wrapper = mount(<PreJoinScreens />);

    expect(wrapper.find(RoomNameScreen).prop('classSessionDraft').role).toBe('student');
  });

  it('prioritizes the profile role over a resumable session identity', () => {
    mockUseAutoRejoin.mockReturnValue(false);
    mockUseParams.mockImplementation(() => ({ URLRoomName: 'prueba' }));
    mockGetResumableSession.mockReturnValue({ roomName: 'prueba', identity: 'Ana Lopez' });
    mockUseAppState.mockImplementation(() => ({
      user: { displayName: 'Profe' },
      profile: { displayName: 'Profe', email: 'profe@example.com', role: 'teacher' },
    }));
    const wrapper = mount(<PreJoinScreens />);

    expect(wrapper.find(RoomNameScreen).prop('classSessionDraft').role).toBe('teacher');
  });

  it('prefills the editable name from the profile displayName over the auth user displayName', () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    mockUseAppState.mockImplementation(() => ({
      user: { displayName: 'Auth Name' },
      profile: { displayName: 'Profile Name', email: 'profile@example.com', role: 'teacher' },
    }));
    const wrapper = mount(<PreJoinScreens />);

    expect(wrapper.find(RoomNameScreen).prop('name')).toBe('Profile Name');
    expect(wrapper.find(RoomNameScreen).prop('classSessionDraft').displayName).toBe('Profile Name');
  });

  it('resolves teacher visible identity with suffix after creating class session', async () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    mockCheckRoomOpen.mockResolvedValue(false);
    const wrapper = shallow(<PreJoinScreens />);

    wrapper.find(RoomNameScreen).prop('setName')('Andres Torres');
    wrapper.find(RoomNameScreen).prop('setClassSessionDraft')((draft: any) => ({
      ...draft,
      displayName: 'Andres Torres',
      sessionName: 'Clase de algebra',
      monitoringSensitivity: 'low',
    }));
    await act(async () => {
      await wrapper.find(RoomNameScreen).prop('onCreateClassSession')();
    });
    wrapper.find(RoomNameScreen).prop('onContinueToDeviceSelection')();

    expect(wrapper.find(DeviceSelectionScreen).prop('name')).toBe('Andres Torres [Profesor]');
    expect(wrapper.find(DeviceSelectionScreen).prop('roomName')).toBe('clase-de-algebra');
  });

  // These cover the Bug 1 fallback: rejoin did NOT complete, the lobby shows, and the role
  // must come from the persisted identity (not be hardcoded to 'student'). We force the
  // lobby to render (auto-rejoin returns false) while leaving getResumableSession intact so
  // the synchronous role/name resolution still reads the persisted session.
  it('renders the teacher lobby role from a resumable teacher session on refresh', () => {
    mockUseAutoRejoin.mockReturnValue(false);
    mockUseParams.mockImplementation(() => ({ URLRoomName: 'prueba' }));
    mockGetResumableSession.mockReturnValue({ roomName: 'prueba', identity: 'andres [Profesor]' });
    const wrapper = mount(<PreJoinScreens />);

    expect(wrapper.find(RoomNameScreen).prop('classSessionDraft').role).toBe('teacher');
    expect(wrapper.find(RoomNameScreen).prop('roomName')).toBe('prueba');
    // The teacher suffix is stripped for the editable name field; rejoin re-appends it.
    expect(wrapper.find(RoomNameScreen).prop('name')).toBe('andres');
  });

  it('renders the student lobby role for a deep link with no resumable session', () => {
    mockUseAutoRejoin.mockReturnValue(false);
    mockUseParams.mockImplementation(() => ({ URLRoomName: 'prueba' }));
    mockGetResumableSession.mockReturnValue(null);
    const wrapper = mount(<PreJoinScreens />);

    expect(wrapper.find(RoomNameScreen).prop('classSessionDraft').role).toBe('student');
    expect(wrapper.find(RoomNameScreen).prop('roomName')).toBe('prueba');
  });

  it('renders the student lobby role from a resumable student session on refresh', () => {
    mockUseAutoRejoin.mockReturnValue(false);
    mockUseParams.mockImplementation(() => ({ URLRoomName: 'prueba' }));
    mockGetResumableSession.mockReturnValue({ roomName: 'prueba', identity: 'Ana Lopez' });
    const wrapper = mount(<PreJoinScreens />);

    expect(wrapper.find(RoomNameScreen).prop('classSessionDraft').role).toBe('student');
    expect(wrapper.find(RoomNameScreen).prop('name')).toBe('Ana Lopez');
  });

  it('captures errors from getAudioAndVideoTracks and passes to MediaErrorSnackbar', async () => {
    const mockGetAudioAndVideoTracks = jest.fn(() => Promise.reject('testError'));
    mockUseVideoContext.mockImplementation(() => ({ getAudioAndVideoTracks: mockGetAudioAndVideoTracks }));

    const wrapper = mount(<PreJoinScreens />);

    await act(async () => {
      wrapper.find(RoomNameScreen).prop('onContinueToDeviceSelection')();
      await new Promise(setImmediate);
    });
    wrapper.update();

    const error = wrapper.find(MediaErrorSnackbar).prop('error');
    expect(error).toBe('testError');
    expect(mockGetAudioAndVideoTracks).toHaveBeenCalledTimes(1);
  });

  it('releases local media before device selection navigates to the profile', () => {
    const removeLocalAudioTrack = jest.fn();
    const removeLocalVideoTrack = jest.fn();
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    mockUseVideoContext.mockReturnValue({
      getAudioAndVideoTracks: jest.fn(() => Promise.resolve()),
      removeLocalAudioTrack,
      removeLocalVideoTrack,
    });

    const wrapper = shallow(<PreJoinScreens initialClassSession={{ roomName: 'mat-a', name: 'Ana' }} />);
    const onProfileClick = wrapper.find(IntroContainer).prop('onProfileClick');

    expect(onProfileClick).toBeInstanceOf(Function);
    onProfileClick!();
    expect(removeLocalAudioTrack).toHaveBeenCalledTimes(1);
    expect(removeLocalVideoTrack).toHaveBeenCalledTimes(1);
  });

  // ── Back-to-dashboard handoff ─────────────────────────────────────────────────

  it('does not offer onReturnToDashboard to IntroContainer when App.tsx does not provide it', () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    const wrapper = shallow(<PreJoinScreens />);

    expect(wrapper.find(IntroContainer).prop('onReturnToDashboard')).toBeUndefined();
  });

  it('resets the URL to "/" and calls onReturnToDashboard on the room-name step', () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    const onReturnToDashboard = jest.fn();
    const wrapper = shallow(<PreJoinScreens onReturnToDashboard={onReturnToDashboard} />);

    const handler = wrapper.find(IntroContainer).prop('onReturnToDashboard');
    expect(handler).toBeInstanceOf(Function);
    handler!();

    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/');
    expect(onReturnToDashboard).toHaveBeenCalledTimes(1);
  });

  it('does not reset the URL for twilio function origin when returning to the dashboard', () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    // @ts-ignore
    window.location = { ...window.location, origin: 'https://video-app-1234-twil.io' };
    const onReturnToDashboard = jest.fn();
    const wrapper = shallow(<PreJoinScreens onReturnToDashboard={onReturnToDashboard} />);

    wrapper.find(IntroContainer).prop('onReturnToDashboard')!();

    expect(window.history.replaceState).not.toHaveBeenCalled();
    expect(onReturnToDashboard).toHaveBeenCalledTimes(1);
  });

  it('does not surface onReturnToDashboard on the device-selection step (Cancelar covers it there)', () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    const onReturnToDashboard = jest.fn();
    const wrapper = shallow(
      <PreJoinScreens
        initialClassSession={{ roomName: 'mat-a', name: 'Prof. García [Profesor]' }}
        onReturnToDashboard={onReturnToDashboard}
      />
    );

    expect(wrapper.find(IntroContainer).prop('onReturnToDashboard')).toBeUndefined();
  });

  it('routes the device-selection Cancelar to the dashboard when arriving via the dashboard handoff', () => {
    mockUseParams.mockImplementation(() => ({ URLRoomName: undefined }));
    const onReturnToDashboard = jest.fn();
    const wrapper = shallow(
      <PreJoinScreens
        initialClassSession={{ roomName: 'mat-a', name: 'Prof. García [Profesor]' }}
        onReturnToDashboard={onReturnToDashboard}
      />
    );

    const setStep = wrapper.find(DeviceSelectionScreen).prop('setStep');
    setStep(Steps.roomNameStep);

    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/');
    expect(onReturnToDashboard).toHaveBeenCalledTimes(1);
    expect(wrapper.find(RoomNameScreen).exists()).toBe(false);
  });

  it('keeps the normal step-back behavior for a student, ignoring onReturnToDashboard', async () => {
    const onReturnToDashboard = jest.fn();
    const wrapper = mount(<PreJoinScreens onReturnToDashboard={onReturnToDashboard} />);

    act(() => {
      wrapper.find(RoomNameScreen).prop('setName')('Student Name');
    });
    await act(async () => {
      await wrapper.find(RoomNameScreen).prop('onContinueToDeviceSelection')();
    });
    wrapper.update();
    expect(wrapper.find(DeviceSelectionScreen).exists()).toBe(true);

    act(() => {
      wrapper.find(DeviceSelectionScreen).prop('setStep')(Steps.roomNameStep);
    });
    wrapper.update();

    expect(onReturnToDashboard).not.toHaveBeenCalled();
    expect(wrapper.find(RoomNameScreen).exists()).toBe(true);
  });
});
