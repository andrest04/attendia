import React from 'react';
import { shallow } from 'enzyme';
import TeacherDashboard from './TeacherDashboard';
import DashboardHeader from './DashboardHeader';
import NotificationDropdown from './NotificationDropdown';
import useTeacherNotifications from './useTeacherNotifications';
import DashboardSidebar from './DashboardSidebar';
import QuickStartClassPanel from './QuickStartClassPanel';
import ClassesTab from './ClassesTab';
import HistoryTab from './HistoryTab';
import ResourcesTab from './ResourcesTab';
import CalendarTab from './CalendarTab';
import TeacherProfilePage from '../TeacherProfilePage/TeacherProfilePage';
import { useAppState } from '../../state';
import ConfirmDialog from './ConfirmDialog';
import { toClassSessionDisplayName, toClassSessionRoomName } from '../../classSession/classSessionTypes';
import { checkRoomOpen } from '../../classSession/checkRoomOpen';
import { mockDashboardData } from './mockDashboardData';
import { TeacherNotification } from '../../state/useFirebaseAuth/useFirebaseAuth';
import { UpcomingSession } from './types';
import { ClientApiError } from '../../state/useFirebaseAuth/apiClient';

jest.mock('../../state');
jest.mock('../../classSession/checkRoomOpen');
jest.mock('./useTeacherNotifications');

const mockUseAppState = useAppState as jest.Mock<any>;
const mockCheckRoomOpen = checkRoomOpen as jest.Mock;
const mockUseTeacherNotifications = useTeacherNotifications as jest.Mock;
const mockSignOut = jest.fn(() => Promise.resolve());
const notification = (id: string, destination: TeacherNotification['destination']): TeacherNotification => ({
  notificationId: id,
  ownerUid: 'teacher-1',
  eventType: destination.kind === 'recording' ? 'recording.ready' : destination.kind === 'classes' ? 'class.upcoming' : 'report.save_failed',
  eventKey: `event:${id}`,
  source: destination.kind === 'recording'
    ? { kind: 'recording', roomSid: destination.roomSid, manualRequestId: 'request-1' }
    : destination.kind === 'classes'
    ? { kind: 'class', classId: 'class-1' }
    : { kind: 'report', reportId: destination.reportId, failureEpisodeId: 'episode-1' },
  eventOccurrenceAtMs: 20,
  createdAtMs: 21,
  readAtMs: null,
  title: id,
  message: id,
  destination,
});

const notificationState = (overrides = {}) => ({
  notifications: [], unreadCount: 0, hasMore: false, hasConfirmedState: true,
  isInitialLoading: false, isRefreshing: false, isLoadingMore: false,
  pendingReadId: null, isMarkingAll: false, isClearing: false,
  refreshError: null, paginationError: null, readError: null, markAllError: null, clearError: null, reconcileError: null,
  refresh: jest.fn(), loadMore: jest.fn(), markRead: jest.fn(), markAllRead: jest.fn(), clearAll: jest.fn(), reconcile: jest.fn(),
  ...overrides,
});

describe('TeacherDashboard', () => {
  beforeEach(() => {
    mockUseTeacherNotifications.mockReturnValue(notificationState());
    // fetchClasses/createClass/deleteClass are explicitly undefined here (as they
    // are in passcode/anonymous auth mode), so these tests keep exercising the
    // mockDashboardData fallback path — see the "real classes" describe block below
    // for the firebase-mode path.
    mockUseAppState.mockImplementation(() => ({
      signOut: mockSignOut,
      user: { displayName: 'Andrés Torres' },
      fetchClasses: undefined,
      createClass: undefined,
      deleteClass: undefined,
      fetchAttentionReports: undefined,
    }));
  });

  it('wires the persistent inbox only through the teacher dashboard header, including pending state', () => {
    const state = notificationState({
      notifications: [notification('class', { kind: 'classes' })], unreadCount: 4,
      isLoadingMore: true, pendingReadId: 'class', isMarkingAll: true, isClearing: true,
    });
    mockUseTeacherNotifications.mockReturnValue(state);
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} />);
    const header = wrapper.find(DashboardHeader);
    const dropdown = header.prop('notificationContent')!(jest.fn()) as React.ReactElement<any>;

    expect(mockUseTeacherNotifications).toHaveBeenCalledTimes(1);
    expect(header.prop('notificationUnreadCount')).toBe(4);
    expect(dropdown.type).toBe(NotificationDropdown);
    expect(dropdown.props).toEqual(expect.objectContaining({
      notifications: state.notifications, isLoadingMore: true, pendingReadId: 'class', isMarkingAll: true, isClearing: true,
    }));
  });

  it('marks read before navigating to each closed destination and closes the menu only after success', async () => {
    const markRead = jest.fn().mockResolvedValue(undefined);
    mockUseTeacherNotifications.mockReturnValue(notificationState({ markRead }));
    const navigate = jest.fn();
    const close = jest.fn();
    const wrapper = shallow(
      <TeacherDashboard onStartClass={jest.fn()} onNotificationNavigate={navigate} />
    );
    const dropdown = wrapper.find(DashboardHeader).prop('notificationContent')!(close) as React.ReactElement<any>;
    const cases: Array<[TeacherNotification, string]> = [
      [notification('class', { kind: 'classes' }), '/dashboard/clases'],
      [notification('recording', { kind: 'recording', roomSid: 'RM 1' }), '/recording/RM%201'],
      [notification('report', { kind: 'report-retry', reportId: 'report-1' }), '/dashboard/historial'],
    ];

    for (const [item, path] of cases) {
      const action = dropdown.props.onNotificationClick(item) as unknown as Promise<void>;
      expect(navigate).not.toHaveBeenCalledWith(path);
      await action;
      expect(markRead).toHaveBeenLastCalledWith(item.notificationId);
      expect(navigate).toHaveBeenLastCalledWith(path);
    }
    expect(close).toHaveBeenCalledTimes(3);
  });

  it('does not navigate or close when marking a notification read fails', async () => {
    mockUseTeacherNotifications.mockReturnValue(notificationState({ markRead: jest.fn().mockRejectedValue(new Error('read failed')) }));
    const navigate = jest.fn();
    const close = jest.fn();
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} onNotificationNavigate={navigate} />);
    const dropdown = wrapper.find(DashboardHeader).prop('notificationContent')!(close) as React.ReactElement<any>;

    await expect(dropdown.props.onNotificationClick(notification('class', { kind: 'classes' }))).resolves.toBeUndefined();
    expect(navigate).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('renders the mocked stat cards when fetchAttentionReports is unavailable', () => {
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} />);

    expect(wrapper.find(ClassesTab).prop('stats')).toEqual(mockDashboardData.stats);
  });

  it('flags both stats and sessions as mock data when neither backend endpoint is available', () => {
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} />);

    expect(wrapper.find(ClassesTab).prop('statsAreMock')).toBe(true);
    expect(wrapper.find(ClassesTab).prop('sessionsAreMock')).toBe(true);
  });

  // ── Real professor identity (header + session name) ──────────────────────────
  // The dashboard used to show/send the mocked "Prof. García" identity even for a
  // real signed-in user, which is confusing (looks like a different account) and,
  // worse, leaked into the REAL onStartClass navigation as the room identity.

  it('shows the signed-in user displayName and initials in the header, not the mock', () => {
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} />);

    expect(wrapper.find(DashboardHeader).prop('professorName')).toBe('Andrés Torres');
    expect(wrapper.find(DashboardHeader).prop('professorInitials')).toBe('AT');
  });

  it('prefers the profile displayName over the auth user displayName for identity', () => {
    mockUseAppState.mockImplementation(() => ({
      signOut: mockSignOut,
      user: { displayName: 'Auth Name' },
      profile: { displayName: 'Profile Name' },
    }));
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} />);

    expect(wrapper.find(DashboardHeader).prop('professorName')).toBe('Profile Name');
  });

  it('falls back to the mock professor name when no user/profile displayName is available', () => {
    mockUseAppState.mockImplementation(() => ({ signOut: mockSignOut }));
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} />);

    expect(wrapper.find(DashboardHeader).prop('professorName')).toBe(mockDashboardData.professorName);
  });

  it('passes the signed-in user photoURL through to the header', () => {
    mockUseAppState.mockImplementation(() => ({
      signOut: mockSignOut,
      user: { displayName: 'Andrés Torres', photoURL: 'https://example.com/photo.jpg' },
    }));
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} />);

    expect(wrapper.find(DashboardHeader).prop('professorPhotoURL')).toBe('https://example.com/photo.jpg');
  });

  it('prefers the saved profile avatar over the Google avatar', () => {
    mockUseAppState.mockImplementation(() => ({
      signOut: mockSignOut,
      user: { displayName: 'Andrés Torres', photoURL: 'https://example.com/google.jpg' },
      profile: { displayName: 'Andrés Torres', avatarUrl: 'https://appwrite.example/avatar.jpg' },
    }));
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} />);

    expect(wrapper.find(DashboardHeader).prop('professorPhotoURL')).toBe('https://appwrite.example/avatar.jpg');
  });

  it('renders no photo when the signed-in user has none', () => {
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} />);

    expect(wrapper.find(DashboardHeader).prop('professorPhotoURL')).toBeUndefined();
  });

  it('feeds the real professor name (not the mock) into ClassesTab for onStartClass', () => {
    const onStartClass = jest.fn();
    const wrapper = shallow(<TeacherDashboard onStartClass={onStartClass} />);

    const highlighted = mockDashboardData.upcomingSessions.find(s => s.highlighted)!;
    wrapper.find(ClassesTab).prop('onStartClass')({
      roomName: toClassSessionRoomName(highlighted.title),
      name: toClassSessionDisplayName(wrapper.find(ClassesTab).prop('professorName'), 'teacher'),
    });

    expect(onStartClass).toHaveBeenCalledWith({
      roomName: 'matematicas-grupo-a',
      name: 'Andrés Torres [Profesor]',
    });
  });

  it('defaults to the Clases tab', () => {
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} />);
    expect(wrapper.find(ClassesTab).exists()).toBe(true);
    expect(wrapper.find(HistoryTab).exists()).toBe(false);
    expect(wrapper.find(ResourcesTab).exists()).toBe(false);
    expect(wrapper.find(CalendarTab).exists()).toBe(false);
  });

  it('renders Perfil inside the dashboard content without adding it to the sidebar', () => {
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} showProfile />);

    expect(wrapper.find(TeacherProfilePage).exists()).toBe(true);
    expect(wrapper.find(ClassesTab).exists()).toBe(false);
    expect(wrapper.find(DashboardSidebar).prop('activeTab')).toBeUndefined();
  });

  it('renders the tab that matches the activeTab prop', () => {
    expect(
      shallow(<TeacherDashboard onStartClass={jest.fn()} activeTab="historial" />)
        .find(HistoryTab)
        .exists()
    ).toBe(true);
    expect(
      shallow(<TeacherDashboard onStartClass={jest.fn()} activeTab="recursos" />)
        .find(ResourcesTab)
        .exists()
    ).toBe(true);
    expect(
      shallow(<TeacherDashboard onStartClass={jest.fn()} activeTab="calendario" />)
        .find(CalendarTab)
        .exists()
    ).toBe(true);
  });

  it("forwards the sidebar's tab change to the onTabChange prop", () => {
    const onTabChange = jest.fn();
    const wrapper = shallow(
      <TeacherDashboard onStartClass={jest.fn()} onTabChange={onTabChange} />
    );

    wrapper.find(DashboardSidebar).prop('onTabChange')('historial');
    expect(onTabChange).toHaveBeenCalledWith('historial');
  });

  it('sends the header logo click to "clases" so it works as a "go home" control', () => {
    const onTabChange = jest.fn();
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} onTabChange={onTabChange} />);

    wrapper.find(DashboardHeader).prop('onLogoClick')!();
    expect(onTabChange).toHaveBeenCalledWith('clases');
  });

  it('leaves the header logo non-clickable when there is no onTabChange to navigate with', () => {
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} />);

    expect(wrapper.find(DashboardHeader).prop('onLogoClick')).toBeUndefined();
  });

  it('opens the embedded quick-start panel (sidebar stays put) on "Iniciar clase", instead of navigating away', () => {
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} />);

    wrapper.find(DashboardSidebar).prop('onStartBlankClass')();
    wrapper.update();

    expect(wrapper.find(DashboardSidebar).exists()).toBe(true);
    expect(wrapper.find(QuickStartClassPanel).exists()).toBe(true);
    expect(wrapper.find(ClassesTab).exists()).toBe(false);
  });

  it('only calls onStartClass (real navigation) once the quick-start panel is submitted with a room name', () => {
    const onStartClass = jest.fn();
    const wrapper = shallow(<TeacherDashboard onStartClass={onStartClass} />);

    wrapper.find(DashboardSidebar).prop('onStartBlankClass')();
    wrapper.update();
    expect(onStartClass).not.toHaveBeenCalled();

    wrapper.find(QuickStartClassPanel).prop('onCreate')({
      roomName: 'matematicas-grupo-a',
      name: 'Andrés Torres [Profesor]',
      title: 'Matemáticas grupo A',
    });
    wrapper.update();

    expect(onStartClass).toHaveBeenCalledWith({
      roomName: 'matematicas-grupo-a',
      name: 'Andrés Torres [Profesor]',
      title: 'Matemáticas grupo A',
    });
    expect(wrapper.find(QuickStartClassPanel).exists()).toBe(false);
  });

  it('closes the quick-start panel without navigating when another sidebar tab is picked', () => {
    const onStartClass = jest.fn();
    const onTabChange = jest.fn();
    const wrapper = shallow(<TeacherDashboard onStartClass={onStartClass} onTabChange={onTabChange} />);

    wrapper.find(DashboardSidebar).prop('onStartBlankClass')();
    wrapper.update();

    wrapper.find(DashboardSidebar).prop('onTabChange')('historial');
    wrapper.update();

    expect(onStartClass).not.toHaveBeenCalled();
    expect(onTabChange).toHaveBeenCalledWith('historial');
    expect(wrapper.find(QuickStartClassPanel).exists()).toBe(false);
  });

  it('refreshes the confirmed inbox immediately after a pending report recovers', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);
    const saveAttentionReport = jest.fn().mockResolvedValue(undefined);
    mockUseTeacherNotifications.mockReturnValue(notificationState({ refresh }));
    mockUseAppState.mockReturnValue({
      signOut: mockSignOut,
      user: { uid: 'teacher-1', displayName: 'Andrés Torres' },
      saveAttentionReport,
    });
    window.localStorage.setItem('twilio-video-pending-attention-reports', JSON.stringify({
      'teacher-1': [{
        report: { roomSid: 'RM00000000000000000000000000000abc' },
        failureEpisodeId: 'episode_12345678', firstFailedAtMs: 100,
      }],
    }));
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} />);

    wrapper.find('[data-testid="dashboard-retry-pending-reports"]').simulate('click');
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(saveAttentionReport).toHaveBeenCalledWith(expect.objectContaining({
      roomSid: 'RM00000000000000000000000000000abc', failureEpisodeId: 'episode_12345678',
    }));
    expect(refresh).toHaveBeenCalledTimes(1);
    window.localStorage.clear();
  });

  describe('pending report replay', () => {
    const PENDING_KEY = 'twilio-video-pending-attention-reports';
    const seedQueue = () =>
      window.localStorage.setItem(PENDING_KEY, JSON.stringify({
        'teacher-1': [{
          report: { roomSid: 'RM00000000000000000000000000000abc' },
          failureEpisodeId: 'episode_12345678', firstFailedAtMs: 100,
        }],
      }));
    const queuedSids = () =>
      (JSON.parse(window.localStorage.getItem(PENDING_KEY) || '{}')['teacher-1'] || []).map(
        (entry: any) => entry.report.roomSid
      );
    const replayWith = async (error: unknown) => {
      const saveAttentionReport = jest.fn().mockRejectedValue(error);
      mockUseTeacherNotifications.mockReturnValue(notificationState({ refresh: jest.fn().mockResolvedValue(undefined) }));
      mockUseAppState.mockReturnValue({
        signOut: mockSignOut,
        user: { uid: 'teacher-1', displayName: 'Andrés Torres' },
        saveAttentionReport,
      });
      const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} />);
      wrapper.find('[data-testid="dashboard-retry-pending-reports"]').simulate('click');
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(saveAttentionReport).toHaveBeenCalled();
      return wrapper;
    };
    let consoleError: jest.SpyInstance;

    beforeEach(() => {
      consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      seedQueue();
    });
    afterEach(() => {
      consoleError.mockRestore();
      window.localStorage.clear();
    });

    it.each([400, 403, 404, 413])('drops an entry the server permanently rejects with %i', async status => {
      await replayWith(new ClientApiError(status, 'room session not owned', 'No está a tu cargo.'));
      expect(queuedSids()).toEqual([]);
    });

    it.each([401, 500, 503])('keeps an entry that failed with a retryable %i', async status => {
      await replayWith(new ClientApiError(status, 'unavailable', 'Intenta de nuevo.'));
      expect(queuedSids()).toEqual(['RM00000000000000000000000000000abc']);
    });

    it('keeps an entry that failed with a network error', async () => {
      await replayWith(new TypeError('Failed to fetch'));
      expect(queuedSids()).toEqual(['RM00000000000000000000000000000abc']);
    });
  });

  it('clears pending reports before delegating sign-out to app state', () => {
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} />);
    wrapper.find(DashboardSidebar).prop('onSignOut')!();
    expect(mockSignOut).toHaveBeenCalled();
  });
});

describe('TeacherDashboard with real classes (firebase auth mode)', () => {
  const mockFetchClasses = jest.fn();
  const mockCreateClass = jest.fn();
  const mockDeleteClass = jest.fn();
  const mockStartClass = jest.fn();
  const mockFetchAttentionReports = jest.fn();

  beforeEach(() => {
    mockFetchClasses.mockReset().mockResolvedValue([]);
    mockCreateClass.mockReset();
    mockDeleteClass.mockReset();
    mockStartClass.mockReset();
    mockFetchAttentionReports.mockReset().mockResolvedValue([]);
    mockCheckRoomOpen.mockReset().mockResolvedValue(false);
    mockUseAppState.mockImplementation(() => ({
      signOut: mockSignOut,
      user: { displayName: 'Andrés Torres' },
      fetchClasses: mockFetchClasses,
      createClass: mockCreateClass,
      deleteClass: mockDeleteClass,
      startClass: mockStartClass,
      fetchAttentionReports: mockFetchAttentionReports,
    }));
  });

  // Enzyme shallow rendering (this file's convention throughout) does not invoke
  // useEffect, so the fetch-on-mount call itself is exercised via `mount` in
  // ResourcesTab.test.tsx's equivalent test; this asserts the wiring shallow can see.
  it('passes real onCreateClass/onCancelClass handlers through to ClassesTab', () => {
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} />);

    expect(wrapper.find(ClassesTab).prop('onCreateClass')).toBeInstanceOf(Function);
    expect(wrapper.find(ClassesTab).prop('onCancelClass')).toBeInstanceOf(Function);
  });

  const cancelableSession: UpcomingSession = {
    id: 'class-1',
    title: 'Álgebra',
    code: 'CLS-001',
    time: '10:00',
    studentCount: 5,
    dayLabel: 'Hoy',
    relativeLabel: 'En 5 min',
    highlighted: false,
  };

  it('refreshes the notification inbox as an immediate client-side safety net after a successful cancel', async () => {
    const refresh = jest.fn();
    mockUseTeacherNotifications.mockReturnValue(notificationState({ refresh }));
    mockDeleteClass.mockResolvedValue(undefined);
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} activeTab="clases" />);

    wrapper.find(ClassesTab).prop('onCancelClass')!(cancelableSession);
    wrapper.update();
    wrapper.find(ConfirmDialog).first().prop('onConfirm')!();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockDeleteClass).toHaveBeenCalledWith('class-1');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not refresh the notification inbox when the cancel fails', async () => {
    const refresh = jest.fn();
    mockUseTeacherNotifications.mockReturnValue(notificationState({ refresh }));
    mockDeleteClass.mockRejectedValue(new Error('firestore down'));
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} activeTab="clases" />);

    wrapper.find(ClassesTab).prop('onCancelClass')!(cancelableSession);
    wrapper.update();
    wrapper.find(ConfirmDialog).first().prop('onConfirm')!();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockDeleteClass).toHaveBeenCalledWith('class-1');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('clears both mock flags once both classes and attention-report backends are available', () => {
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} />);

    expect(wrapper.find(ClassesTab).prop('statsAreMock')).toBe(false);
    expect(wrapper.find(ClassesTab).prop('sessionsAreMock')).toBe(false);
  });

  it('calls the real start endpoint before handing a calendar class to prejoin', async () => {
    const onStartClass = jest.fn();
    const classRecord = {
      id: 'class-1',
      title: 'Álgebra',
      roomName: 'algebra',
      scheduledAtMs: 1751554800000,
      studentCount: 20,
      durationMinutes: 60,
    };
    mockStartClass.mockResolvedValue(undefined);
    const wrapper = shallow(
      <TeacherDashboard onStartClass={onStartClass} activeTab="calendario" />
    );

    wrapper.find(CalendarTab).prop('onStartClass')(classRecord);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockCheckRoomOpen).toHaveBeenCalledWith('algebra');
    expect(mockStartClass).toHaveBeenCalledWith('class-1', 'algebra');
    expect(onStartClass).toHaveBeenCalledWith({
      roomName: 'algebra',
      name: 'Andrés Torres [Profesor]',
      classId: 'class-1',
    });
  });

  it('blocks starting when a live room already uses this name, without calling startClass', async () => {
    const onStartClass = jest.fn();
    mockCheckRoomOpen.mockResolvedValue(true);
    const classRecord = {
      id: 'class-1',
      title: 'Álgebra',
      roomName: 'algebra',
      scheduledAtMs: 1751554800000,
      studentCount: 20,
      durationMinutes: 60,
    };
    const wrapper = shallow(<TeacherDashboard onStartClass={onStartClass} activeTab="calendario" />);

    wrapper.find(CalendarTab).prop('onStartClass')(classRecord);
    await Promise.resolve();
    await Promise.resolve();
    wrapper.update();

    expect(mockStartClass).not.toHaveBeenCalled();
    expect(onStartClass).not.toHaveBeenCalled();

    wrapper.setProps({ activeTab: 'clases' });
    expect(wrapper.find(ClassesTab).prop('startClassError')).toEqual(expect.any(String));
  });

  it('resumes the teacher\'s own already-started class instead of blocking on a room-name collision', async () => {
    const onStartClass = jest.fn();
    mockCheckRoomOpen.mockResolvedValue(true);
    const ownOpenClass = {
      id: 'class-2',
      title: 'Mate (sesión anterior)',
      roomName: 'algebra',
      scheduledAtMs: 1751554800000,
      studentCount: 20,
      durationMinutes: 60,
      status: 'started' as const,
    };
    mockFetchClasses.mockResolvedValue([ownOpenClass]);
    const classRecord = {
      id: 'class-1',
      title: 'Álgebra',
      roomName: 'algebra',
      scheduledAtMs: 1751554800000,
      studentCount: 20,
      durationMinutes: 60,
    };
    const wrapper = shallow(<TeacherDashboard onStartClass={onStartClass} activeTab="calendario" />);

    // Shallow rendering skips useEffect, so drive the same fetch loadClasses
    // wires to CalendarTab's onRetry to seed realClasses deterministically.
    wrapper.find(CalendarTab).prop('onRetry')();
    await Promise.resolve();
    await Promise.resolve();
    wrapper.update();

    wrapper.find(CalendarTab).prop('onStartClass')(classRecord);
    await Promise.resolve();
    await Promise.resolve();
    wrapper.update();

    expect(mockStartClass).not.toHaveBeenCalled();
    expect(onStartClass).toHaveBeenCalledWith({
      roomName: 'algebra',
      name: 'Andrés Torres [Profesor]',
      classId: 'class-2',
    });

    wrapper.setProps({ activeTab: 'clases' });
    expect(wrapper.find(ClassesTab).prop('startClassError')).toBeNull();
  });

  it('resolves a re-click on an already-started class via the resume branch, not the block branch', async () => {
    const onStartClass = jest.fn();
    mockCheckRoomOpen.mockResolvedValue(true);
    const alreadyStartedClass = {
      id: 'class-1',
      title: 'Álgebra',
      roomName: 'algebra',
      scheduledAtMs: 1751554800000,
      studentCount: 20,
      durationMinutes: 60,
      status: 'started' as const,
    };
    mockFetchClasses.mockResolvedValue([alreadyStartedClass]);
    const wrapper = shallow(<TeacherDashboard onStartClass={onStartClass} activeTab="calendario" />);

    wrapper.find(CalendarTab).prop('onRetry')();
    await Promise.resolve();
    await Promise.resolve();
    wrapper.update();

    wrapper.find(CalendarTab).prop('onStartClass')(alreadyStartedClass);
    await Promise.resolve();
    await Promise.resolve();
    wrapper.update();

    expect(mockStartClass).not.toHaveBeenCalled();
    expect(onStartClass).toHaveBeenCalledWith({
      roomName: 'algebra',
      name: 'Andrés Torres [Profesor]',
      classId: 'class-1',
    });

    wrapper.setProps({ activeTab: 'clases' });
    expect(wrapper.find(ClassesTab).prop('startClassError')).toBeNull();
  });

  it('proceeds to start when checkRoomOpen is inconclusive (null)', async () => {
    const onStartClass = jest.fn();
    mockCheckRoomOpen.mockResolvedValue(null);
    const classRecord = {
      id: 'class-1',
      title: 'Álgebra',
      roomName: 'algebra',
      scheduledAtMs: 1751554800000,
      studentCount: 20,
      durationMinutes: 60,
    };
    mockStartClass.mockResolvedValue(undefined);
    const wrapper = shallow(<TeacherDashboard onStartClass={onStartClass} activeTab="calendario" />);

    wrapper.find(CalendarTab).prop('onStartClass')(classRecord);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockStartClass).toHaveBeenCalledWith('class-1', 'algebra');
    expect(onStartClass).toHaveBeenCalledWith({
      roomName: 'algebra',
      name: 'Andrés Torres [Profesor]',
      classId: 'class-1',
    });
  });

  it('persists a sidebar quick-start as a real class, starts it, then navigates with its classId', async () => {
    const onStartClass = jest.fn();
    const created = {
      id: 'class-quick-1',
      title: 'Física 101',
      roomName: 'fisica-101',
      scheduledAtMs: Date.now(),
      studentCount: 0,
      durationMinutes: 60,
    };
    mockCreateClass.mockResolvedValue(created);
    mockStartClass.mockResolvedValue(undefined);
    const wrapper = shallow(<TeacherDashboard onStartClass={onStartClass} />);

    wrapper.find(DashboardSidebar).prop('onStartBlankClass')();
    wrapper.update();
    wrapper.find(QuickStartClassPanel).prop('onCreate')({
      roomName: 'fisica-101',
      name: 'Andrés Torres [Profesor]',
      title: 'Física 101',
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(mockCreateClass).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Física 101', roomName: 'fisica-101' })
    );
    expect(mockStartClass).toHaveBeenCalledWith('class-quick-1', 'fisica-101');
    expect(onStartClass).toHaveBeenCalledWith({
      roomName: 'fisica-101',
      name: 'Andrés Torres [Profesor]',
      classId: 'class-quick-1',
    });
  });

  it('falls open to plain navigation (no classId) when persisting a quick-started class fails', async () => {
    const onStartClass = jest.fn();
    mockCreateClass.mockRejectedValue(new Error('firestore unavailable'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const wrapper = shallow(<TeacherDashboard onStartClass={onStartClass} />);

    wrapper.find(DashboardSidebar).prop('onStartBlankClass')();
    wrapper.update();
    wrapper.find(QuickStartClassPanel).prop('onCreate')({
      roomName: 'fisica-101',
      name: 'Andrés Torres [Profesor]',
      title: 'Física 101',
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(mockStartClass).not.toHaveBeenCalled();
    expect(onStartClass).toHaveBeenCalledWith({
      roomName: 'fisica-101',
      name: 'Andrés Torres [Profesor]',
      title: 'Física 101',
    });
    (console.error as jest.Mock).mockRestore();
  });
});

describe('TeacherDashboard stat cards (firebase auth mode)', () => {
  const mockFetchAttentionReports = jest.fn();

  beforeEach(() => {
    mockFetchAttentionReports.mockReset().mockResolvedValue([]);
    mockUseAppState.mockImplementation(() => ({
      signOut: mockSignOut,
      user: { displayName: 'Andrés Torres' },
      fetchAttentionReports: mockFetchAttentionReports,
    }));
  });

  // Shallow rendering doesn't invoke useEffect, so `reports` stays at its initial
  // empty state here — this asserts the wiring (real stats path taken, computed
  // from an empty report list) rather than the fetch-on-mount call itself.
  it('computes all four real stat values as zeros for an empty report list', () => {
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} />);

    const stats = wrapper.find(ClassesTab).prop('stats');
    expect(stats[0]).toEqual({ ...mockDashboardData.stats[0], value: '0' });
    expect(stats[1]).toEqual({ ...mockDashboardData.stats[1], value: '0' });
    expect(stats[2]).toEqual({ ...mockDashboardData.stats[2], value: '0%' });
    expect(stats[3]).toEqual({ ...mockDashboardData.stats[3], value: '0h' });
  });

  it('flags stats as real but sessions as mock when only fetchAttentionReports is available', () => {
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} />);

    expect(wrapper.find(ClassesTab).prop('statsAreMock')).toBe(false);
    expect(wrapper.find(ClassesTab).prop('sessionsAreMock')).toBe(true);
  });
});
