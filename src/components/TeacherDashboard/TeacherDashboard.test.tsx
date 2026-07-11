import React from 'react';
import { shallow } from 'enzyme';
import TeacherDashboard from './TeacherDashboard';
import DashboardHeader from './DashboardHeader';
import DashboardSidebar from './DashboardSidebar';
import ClassesTab from './ClassesTab';
import HistoryTab from './HistoryTab';
import ResourcesTab from './ResourcesTab';
import CalendarTab from './CalendarTab';
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
    }));
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

  it('switches tabs when the sidebar reports a tab change', () => {
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} onStartBlankClass={jest.fn()} />);

    wrapper.find(DashboardSidebar).prop('onTabChange')('historial');
    wrapper.update();
    expect(wrapper.find(HistoryTab).exists()).toBe(true);

    wrapper.find(DashboardSidebar).prop('onTabChange')('recursos');
    wrapper.update();
    expect(wrapper.find(ResourcesTab).exists()).toBe(true);

    wrapper.find(DashboardSidebar).prop('onTabChange')('calendario');
    wrapper.update();
    expect(wrapper.find(CalendarTab).exists()).toBe(true);
  });

  it('wires the sidebar "Iniciar clase" button to onStartBlankClass', () => {
    const onStartBlankClass = jest.fn();
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} onStartBlankClass={onStartBlankClass} />);

    wrapper.find(DashboardSidebar).prop('onStartBlankClass')();
    expect(onStartBlankClass).toHaveBeenCalled();
  });

  it('passes the app state signOut through to the sidebar', () => {
    const wrapper = shallow(<TeacherDashboard onStartClass={jest.fn()} onStartBlankClass={jest.fn()} />);
    expect(wrapper.find(DashboardSidebar).prop('onSignOut')).toBe(mockSignOut);
  });
});

describe('TeacherDashboard with real classes (firebase auth mode)', () => {
  const mockFetchClasses = jest.fn();
  const mockCreateClass = jest.fn();
  const mockDeleteClass = jest.fn();

  beforeEach(() => {
    mockFetchClasses.mockReset().mockResolvedValue([]);
    mockCreateClass.mockReset();
    mockDeleteClass.mockReset();
    mockUseAppState.mockImplementation(() => ({
      signOut: mockSignOut,
      user: { displayName: 'Andrés Torres' },
      fetchClasses: mockFetchClasses,
      createClass: mockCreateClass,
      deleteClass: mockDeleteClass,
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
});
