import React from 'react';
import { shallow } from 'enzyme';
import TeacherDashboard from './TeacherDashboard';
import DashboardHeader from './DashboardHeader';
import DashboardSidebar from './DashboardSidebar';
import ClassesTab from './ClassesTab';
import HistoryTab from './HistoryTab';
import ResourcesTab from './ResourcesTab';
import CalendarTab from './CalendarTab';
import TeacherProfilePage from '../TeacherProfilePage/TeacherProfilePage';
import { useAppState } from '../../state';
import { toClassSessionDisplayName, toClassSessionRoomName } from '../PreJoinScreens/classSessionTypes';
import { mockDashboardData } from './mockDashboardData';

jest.mock('../../state');

const mockUseAppState = useAppState as jest.Mock<any>;
const mockSignOut = jest.fn(() => Promise.resolve());

describe('TeacherDashboard', () => {
  beforeEach(() => {
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

  it('renders the mocked stat cards when fetchAttentionReports is unavailable', () => {
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} onStartBlankClass={jest.fn()} />);

    expect(wrapper.find(ClassesTab).prop('stats')).toEqual(mockDashboardData.stats);
  });

  // ── Real professor identity (header + session name) ──────────────────────────
  // The dashboard used to show/send the mocked "Prof. García" identity even for a
  // real signed-in user, which is confusing (looks like a different account) and,
  // worse, leaked into the REAL onStartClass navigation as the room identity.

  it('shows the signed-in user displayName and initials in the header, not the mock', () => {
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} onStartBlankClass={jest.fn()} />);

    expect(wrapper.find(DashboardHeader).prop('professorName')).toBe('Andrés Torres');
    expect(wrapper.find(DashboardHeader).prop('professorInitials')).toBe('AT');
  });

  it('prefers the profile displayName over the auth user displayName for identity', () => {
    mockUseAppState.mockImplementation(() => ({
      signOut: mockSignOut,
      user: { displayName: 'Auth Name' },
      profile: { displayName: 'Profile Name' },
    }));
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} onStartBlankClass={jest.fn()} />);

    expect(wrapper.find(DashboardHeader).prop('professorName')).toBe('Profile Name');
  });

  it('falls back to the mock professor name when no user/profile displayName is available', () => {
    mockUseAppState.mockImplementation(() => ({ signOut: mockSignOut }));
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} onStartBlankClass={jest.fn()} />);

    expect(wrapper.find(DashboardHeader).prop('professorName')).toBe(mockDashboardData.professorName);
  });

  it('passes the signed-in user photoURL through to the header', () => {
    mockUseAppState.mockImplementation(() => ({
      signOut: mockSignOut,
      user: { displayName: 'Andrés Torres', photoURL: 'https://example.com/photo.jpg' },
    }));
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} onStartBlankClass={jest.fn()} />);

    expect(wrapper.find(DashboardHeader).prop('professorPhotoURL')).toBe('https://example.com/photo.jpg');
  });

  it('prefers the saved profile avatar over the Google avatar', () => {
    mockUseAppState.mockImplementation(() => ({
      signOut: mockSignOut,
      user: { displayName: 'Andrés Torres', photoURL: 'https://example.com/google.jpg' },
      profile: { displayName: 'Andrés Torres', avatarDataUrl: 'data:image/jpeg;base64,AA==' },
    }));
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} onStartBlankClass={jest.fn()} />);

    expect(wrapper.find(DashboardHeader).prop('professorPhotoURL')).toBe('data:image/jpeg;base64,AA==');
  });

  it('renders no photo when the signed-in user has none', () => {
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} onStartBlankClass={jest.fn()} />);

    expect(wrapper.find(DashboardHeader).prop('professorPhotoURL')).toBeUndefined();
  });

  it('feeds the real professor name (not the mock) into ClassesTab for onStartClass', () => {
    const onStartClass = jest.fn();
    const wrapper = shallow(<TeacherDashboard onStartClass={onStartClass} onStartBlankClass={jest.fn()} />);

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
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} onStartBlankClass={jest.fn()} />);
    expect(wrapper.find(ClassesTab).exists()).toBe(true);
    expect(wrapper.find(HistoryTab).exists()).toBe(false);
    expect(wrapper.find(ResourcesTab).exists()).toBe(false);
    expect(wrapper.find(CalendarTab).exists()).toBe(false);
  });

  it('renders Perfil inside the dashboard content without adding it to the sidebar', () => {
    const onReturnToClasses = jest.fn();
    const wrapper = shallow(
      <TeacherDashboard
        onStartClass={jest.fn()}
        onStartBlankClass={jest.fn()}
        showProfile
        onReturnToClasses={onReturnToClasses}
      />
    );

    expect(wrapper.find(TeacherProfilePage).prop('onReturnToClasses')).toBe(onReturnToClasses);
    expect(wrapper.find(ClassesTab).exists()).toBe(false);
    expect(wrapper.find(DashboardSidebar).prop('activeTab')).toBeUndefined();
  });

  it('renders the tab that matches the activeTab prop', () => {
    expect(
      shallow(<TeacherDashboard onStartClass={jest.fn()} onStartBlankClass={jest.fn()} activeTab="historial" />)
        .find(HistoryTab)
        .exists()
    ).toBe(true);
    expect(
      shallow(<TeacherDashboard onStartClass={jest.fn()} onStartBlankClass={jest.fn()} activeTab="recursos" />)
        .find(ResourcesTab)
        .exists()
    ).toBe(true);
    expect(
      shallow(<TeacherDashboard onStartClass={jest.fn()} onStartBlankClass={jest.fn()} activeTab="calendario" />)
        .find(CalendarTab)
        .exists()
    ).toBe(true);
  });

  it("forwards the sidebar's tab change to the onTabChange prop", () => {
    const onTabChange = jest.fn();
    const wrapper = shallow(
      <TeacherDashboard onStartClass={jest.fn()} onStartBlankClass={jest.fn()} onTabChange={onTabChange} />
    );

    wrapper.find(DashboardSidebar).prop('onTabChange')('historial');
    expect(onTabChange).toHaveBeenCalledWith('historial');
  });

  it('wires the sidebar "Iniciar clase" button to onStartBlankClass', () => {
    const onStartBlankClass = jest.fn();
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} onStartBlankClass={onStartBlankClass} />);

    wrapper.find(DashboardSidebar).prop('onStartBlankClass')();
    expect(onStartBlankClass).toHaveBeenCalled();
  });

  it('clears pending reports before delegating sign-out to app state', () => {
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} onStartBlankClass={jest.fn()} />);
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
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} onStartBlankClass={jest.fn()} />);

    expect(wrapper.find(ClassesTab).prop('onCreateClass')).toBeInstanceOf(Function);
    expect(wrapper.find(ClassesTab).prop('onCancelClass')).toBeInstanceOf(Function);
  });

  it('calls the real start endpoint before handing a calendar class to prejoin', async () => {
    const onStartClass = jest.fn();
    const classRecord = {
      id: 'class-1',
      title: 'Álgebra',
      roomName: 'algebra',
      scheduledAtMs: 1751554800000,
      studentCount: 20,
    };
    mockStartClass.mockResolvedValue(undefined);
    const wrapper = shallow(
      <TeacherDashboard onStartClass={onStartClass} onStartBlankClass={jest.fn()} activeTab="calendario" />
    );

    wrapper.find(CalendarTab).prop('onStartClass')(classRecord);
    await Promise.resolve();

    expect(mockStartClass).toHaveBeenCalledWith('class-1', 'algebra');
    expect(onStartClass).toHaveBeenCalledWith({ roomName: 'algebra', name: 'Andrés Torres', classId: 'class-1' });
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
  // from an empty report list, with hours-taught still copied from the mock)
  // rather than the fetch-on-mount call itself.
  it('computes the three real stat values (zeros for an empty report list) and keeps hours-taught mocked', () => {
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} onStartBlankClass={jest.fn()} />);

    const stats = wrapper.find(ClassesTab).prop('stats');
    expect(stats[0]).toEqual({ ...mockDashboardData.stats[0], value: '0' });
    expect(stats[1]).toEqual({ ...mockDashboardData.stats[1], value: '0' });
    expect(stats[2]).toEqual({ ...mockDashboardData.stats[2], value: '0%' });
    expect(stats[3]).toEqual(mockDashboardData.stats[3]);
  });
});
