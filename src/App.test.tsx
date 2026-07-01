import React from 'react';
import App from './App';
import MenuBar from './components/MenuBar/MenuBar';
import PreJoinScreens from './components/PreJoinScreens/PreJoinScreens';
import Room from './components/Room/Room';
import SessionEndedScreen from './components/SessionEndedScreen/SessionEndedScreen';
import { shallow } from 'enzyme';
import useHeight from './hooks/useHeight/useHeight';
import useRoomState from './hooks/useRoomState/useRoomState';
import { useAppState } from './state';
import { useMediaQuery } from '@material-ui/core';

jest.mock('swiper/react', () => ({
  Swiper: jest.fn(),
  SwiperSlide: jest.fn(),
}));

jest.mock('swiper', () => ({
  Pagination: jest.fn(),
}));

jest.mock('./hooks/useRoomState/useRoomState');
jest.mock('./hooks/useHeight/useHeight');
jest.mock('./state');
jest.mock('@material-ui/core', () => {
  const actual = jest.requireActual('@material-ui/core');
  return { ...actual, useMediaQuery: jest.fn() };
});

const mockUseRoomState = useRoomState as jest.Mock<any>;
const mockUseHeight = useHeight as jest.Mock<any>;
const mockUseAppState = useAppState as jest.Mock<any>;
const mockUseMediaQuery = useMediaQuery as jest.Mock<any>;

mockUseHeight.mockImplementation(() => '500px');
mockUseMediaQuery.mockImplementation(() => false);
mockUseAppState.mockImplementation(() => ({ sessionEndedByProfessor: false }));

describe('the App component', () => {
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
});
