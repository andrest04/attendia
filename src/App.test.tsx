import React from 'react';
import App from './App';
import MenuBar from './components/MenuBar/MenuBar';
import PreJoinScreens from './components/PreJoinScreens/PreJoinScreens';
import Room from './components/Room/Room';
import SessionEndedScreen from './components/SessionEndedScreen/SessionEndedScreen';
import TeacherDashboard from './components/TeacherDashboard';
import TeacherProfilePage from './components/TeacherProfilePage/TeacherProfilePage';
import useInitialRole from './components/TeacherDashboard/useInitialRole';
import { saveDashboardHandoff, clearDashboardHandoff } from './components/TeacherDashboard/dashboardHandoffSession';
import { shallow } from 'enzyme';
import useHeight from './hooks/useHeight/useHeight';
import useRoomState from './hooks/useRoomState/useRoomState';
import { useAppState } from './state';
import { useMediaQuery } from '@material-ui/core';
import { useHistory, useLocation } from 'react-router-dom';

jest.mock('swiper/react', () => ({
  Swiper: jest.fn(),
  SwiperSlide: jest.fn(),
}));

jest.mock('swiper/modules', () => ({
  Pagination: jest.fn(),
}));

jest.mock('./hooks/useRoomState/useRoomState');
jest.mock('./hooks/useHeight/useHeight');
jest.mock('./state');
jest.mock('./components/TeacherDashboard/useInitialRole');
jest.mock('@material-ui/core', () => {
  const actual = jest.requireActual('@material-ui/core');
  return { ...actual, useMediaQuery: jest.fn() };
});
jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useLocation: jest.fn(),
}));

const mockUseRoomState = useRoomState as jest.Mock<any>;
const mockUseHeight = useHeight as jest.Mock<any>;
const mockUseAppState = useAppState as jest.Mock<any>;
const mockUseMediaQuery = useMediaQuery as jest.Mock<any>;
const mockUseInitialRole = useInitialRole as jest.Mock<any>;
const mockUseHistory = useHistory as jest.Mock<any>;
const mockUseLocation = useLocation as jest.Mock<any>;
const mockHistoryPush = jest.fn();

mockUseHeight.mockImplementation(() => '500px');
mockUseMediaQuery.mockImplementation(() => false);
mockUseAppState.mockImplementation(() => ({ sessionEndedByProfessor: false }));
// Existing tests below all assert directly on PreJoinScreens/Room, so default to the
// student role (dashboard inactive) unless a test opts into the teacher landing page.
mockUseInitialRole.mockImplementation(() => 'student');
mockUseHistory.mockImplementation(() => ({ push: mockHistoryPush }));
mockUseLocation.mockImplementation(() => ({ pathname: '/' }));

describe('the App component', () => {
  afterEach(() => {
    clearDashboardHandoff();
    mockHistoryPush.mockClear();
  });
  it('shows the session-ended screen once the teacher ends the session for everyone', () => {
    mockUseRoomState.mockImplementation(() => 'disconnected');
    mockUseAppState.mockImplementationOnce(() => ({ sessionEndedByProfessor: true }));
    const wrapper = shallow(<App />);

    expect(wrapper.find(SessionEndedScreen).exists()).toBe(true);
    expect(wrapper.find(PreJoinScreens).exists()).toBe(false);
    expect(wrapper.find(Room).exists()).toBe(false);
  });

  it('should render correctly when disconnected from a room', () => {
    mockUseRoomState.mockImplementation(() => 'disconnected');
    const wrapper = shallow(<App />);

    expect(wrapper.find(PreJoinScreens).exists()).toBe(true);
    expect(wrapper.find(Room).exists()).toBe(false);
    expect(wrapper.find(MenuBar).exists()).toBe(false);
  });

  it('should hide fixed desktop MenuBar when connected on desktop', () => {
    mockUseRoomState.mockImplementation(() => 'connected');
    const wrapper = shallow(<App />);

    expect(wrapper.find(PreJoinScreens).exists()).toBe(false);
    expect(wrapper.find(Room).exists()).toBe(true);
    expect(wrapper.find(MenuBar).exists()).toBe(false);
  });

  it('should keep fixed MenuBar when connected on mobile', () => {
    mockUseRoomState.mockImplementation(() => 'connected');
    mockUseMediaQuery.mockImplementationOnce(() => true);
    const wrapper = shallow(<App />);
    expect(wrapper.find(MenuBar).exists()).toBe(true);
  });

  it('should set the height of the main container using the useHeight hook', () => {
    const wrapper = shallow(<App />);
    expect(wrapper.prop('style')).toEqual({ height: '500px' });
  });

  describe('the teacher landing dashboard', () => {
    it('mounts Perfil within the dashboard shell for the protected profile route', () => {
      mockUseInitialRole.mockImplementationOnce(() => 'teacher');
      mockUseRoomState.mockImplementation(() => 'disconnected');
      mockUseLocation.mockImplementationOnce(() => ({ pathname: '/profile' }));
      const wrapper = shallow(<App />);

      expect(wrapper.find(TeacherDashboard).prop('showProfile')).toBe(true);
    });

    it('mounts the shared profile page without the teacher dashboard for students', () => {
      mockUseRoomState.mockImplementation(() => 'disconnected');
      mockUseLocation.mockImplementationOnce(() => ({ pathname: '/profile' }));
      const wrapper = shallow(<App />);

      expect(wrapper.find(TeacherProfilePage).exists()).toBe(true);
      expect(wrapper.find(TeacherDashboard).exists()).toBe(false);
    });

    it('derives the active tab from a /dashboard/* route, even without dashboardActive', () => {
      mockUseInitialRole.mockImplementationOnce(() => 'teacher');
      mockUseRoomState.mockImplementation(() => 'disconnected');
      mockUseLocation.mockImplementationOnce(() => ({ pathname: '/dashboard/historial' }));
      const wrapper = shallow(<App />);

      expect(wrapper.find(TeacherDashboard).prop('activeTab')).toBe('historial');
      expect(wrapper.find(TeacherDashboard).prop('showProfile')).toBe(false);
    });

    it('shows a student the lobby, not the teacher dashboard, on a /dashboard/* route', () => {
      mockUseRoomState.mockImplementation(() => 'disconnected');
      mockUseLocation.mockImplementationOnce(() => ({ pathname: '/dashboard/clases' }));
      const wrapper = shallow(<App />);

      expect(wrapper.find(TeacherDashboard).exists()).toBe(false);
      expect(wrapper.find(PreJoinScreens).exists()).toBe(true);
    });

    it('shows the quick-start panel on its own /dashboard/iniciar-clase route', () => {
      mockUseInitialRole.mockImplementationOnce(() => 'teacher');
      mockUseRoomState.mockImplementation(() => 'disconnected');
      mockUseLocation.mockImplementationOnce(() => ({ pathname: '/dashboard/iniciar-clase' }));
      const wrapper = shallow(<App />);

      expect(wrapper.find(TeacherDashboard).prop('showQuickStart')).toBe(true);
      expect(wrapper.find(TeacherDashboard).prop('showProfile')).toBe(false);
    });

    it('does not show the quick-start panel on a regular tab route', () => {
      mockUseInitialRole.mockImplementationOnce(() => 'teacher');
      mockUseRoomState.mockImplementation(() => 'disconnected');
      mockUseLocation.mockImplementationOnce(() => ({ pathname: '/dashboard/clases' }));
      const wrapper = shallow(<App />);

      expect(wrapper.find(TeacherDashboard).prop('showQuickStart')).toBe(false);
    });

    it('pushes the quick-start route when the dashboard asks to open it', () => {
      mockUseInitialRole.mockImplementationOnce(() => 'teacher');
      mockUseRoomState.mockImplementation(() => 'disconnected');
      const wrapper = shallow(<App />);

      wrapper.find(TeacherDashboard).prop('onOpenQuickStart')!();
      expect(mockHistoryPush).toHaveBeenCalledWith('/dashboard/iniciar-clase');
    });

    it('leaves the quick-start route for the lobby when a class is started from it', () => {
      mockUseInitialRole.mockImplementationOnce(() => 'teacher');
      mockUseRoomState.mockImplementation(() => 'disconnected');
      mockUseLocation.mockImplementationOnce(() => ({ pathname: '/dashboard/iniciar-clase' }));
      const wrapper = shallow(<App />);

      wrapper.find(TeacherDashboard).prop('onStartClass')({ roomName: 'mat-a', name: 'Prof. García [Profesor]' });

      expect(mockHistoryPush).toHaveBeenCalledWith('/');
    });

    it('pushes the matching /dashboard/* route when onTabChange fires', () => {
      mockUseInitialRole.mockImplementationOnce(() => 'teacher');
      mockUseRoomState.mockImplementation(() => 'disconnected');
      const wrapper = shallow(<App />);

      wrapper.find(TeacherDashboard).prop('onTabChange')!('recursos');
      expect(mockHistoryPush).toHaveBeenCalledWith('/dashboard/recursos');
    });
    it('shows the TeacherDashboard instead of PreJoinScreens when the initial role is teacher', () => {
      mockUseInitialRole.mockImplementationOnce(() => 'teacher');
      mockUseRoomState.mockImplementation(() => 'disconnected');
      const wrapper = shallow(<App />);

      expect(wrapper.find(TeacherDashboard).exists()).toBe(true);
      expect(wrapper.find(PreJoinScreens).exists()).toBe(false);
    });

    it('drops into PreJoinScreens with the picked session once onStartClass fires', () => {
      mockUseInitialRole.mockImplementationOnce(() => 'teacher');
      mockUseRoomState.mockImplementation(() => 'disconnected');
      const wrapper = shallow(<App />);

      wrapper.find(TeacherDashboard).prop('onStartClass')({ roomName: 'mat-a', name: 'Prof. García [Profesor]' });
      wrapper.update();

      expect(wrapper.find(TeacherDashboard).exists()).toBe(false);
      expect(wrapper.find(PreJoinScreens).prop('initialClassSession')).toEqual({
        roomName: 'mat-a',
        name: 'Prof. García [Profesor]',
      });
    });

    it('restores a persisted selected class to the prejoin device-selection contract after refresh', () => {
      saveDashboardHandoff({ roomName: 'mat-a', name: 'Prof. García [Profesor]' });
      mockUseInitialRole.mockImplementationOnce(() => 'teacher');
      mockUseRoomState.mockImplementation(() => 'disconnected');

      const wrapper = shallow(<App />);

      expect(wrapper.find(TeacherDashboard).exists()).toBe(false);
      expect(wrapper.find(PreJoinScreens).prop('initialClassSession')).toEqual({
        roomName: 'mat-a',
        name: 'Prof. García [Profesor]',
      });
    });

    // The "return to the dashboard once the class ends" reset relies on a useEffect, which
    // enzyme's shallow renderer never flushes — that behavior is covered instead by
    // useDashboardHandoff.test.ts (renderHook, real effects) since App.tsx now delegates the
    // whole dashboard/pendingSession state machine to that hook.
  });
});
