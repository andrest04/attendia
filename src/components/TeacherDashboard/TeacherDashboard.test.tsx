import React from 'react';
import { shallow } from 'enzyme';
import TeacherDashboard from './TeacherDashboard';
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
    mockUseAppState.mockImplementation(() => ({ signOut: mockSignOut }));
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

  it('wires the highlighted class card CTA to onStartClass via ClassesTab', () => {
    const onStartClass = jest.fn();
    const wrapper = shallow(<TeacherDashboard onStartClass={onStartClass} onStartBlankClass={jest.fn()} />);

    const highlighted = mockDashboardData.upcomingSessions.find(s => s.highlighted)!;
    wrapper.find(ClassesTab).prop('onStartClass')({
      roomName: toClassSessionRoomName(highlighted.title),
      name: toClassSessionDisplayName(mockDashboardData.professorName, 'teacher'),
    });

    expect(onStartClass).toHaveBeenCalledWith({
      roomName: 'matematicas-grupo-a',
      name: 'Prof. García [Profesor]',
    });
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
