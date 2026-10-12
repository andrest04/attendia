import React from 'react';
import { shallow } from 'enzyme';
import { AppRoutes, VideoApp } from './index';
import PrivateRoute from './components/PrivateRoute/PrivateRoute';

jest.mock('react-dom', () => ({ render: jest.fn() }));
jest.mock('swiper/react', () => ({ Swiper: jest.fn(), SwiperSlide: jest.fn() }));
jest.mock('swiper/modules', () => ({ Pagination: jest.fn() }));

describe('AppRoutes', () => {
  it('registers the private teacher profile route', () => {
    const wrapper = shallow(<AppRoutes />);
    const profileRoute = wrapper
      .find(PrivateRoute)
      .filterWhere(route => [].concat(route.prop('path') as any).includes('/profile' as never));

    expect(profileRoute).toHaveLength(1);
    expect(profileRoute.prop('exact')).toBe(true);
    expect(profileRoute.find(VideoApp).exists()).toBe(true);
  });

  it('renders the room app for the lobby and every dashboard tab, exactly', () => {
    const wrapper = shallow(<AppRoutes />);
    const roomAppRoute = wrapper
      .find(PrivateRoute)
      .filterWhere(route => route.prop('exact') === true && route.find(VideoApp).exists());

    expect(roomAppRoute).toHaveLength(1);
    expect(roomAppRoute.prop('path')).toEqual(
      expect.arrayContaining([
        '/',
        '/profile',
        '/dashboard/clases',
        '/dashboard/historial',
        '/dashboard/recursos',
        '/dashboard/calendario',
      ])
    );
  });

  it('renders the room app for a room deep link, not exactly', () => {
    const wrapper = shallow(<AppRoutes />);
    const roomRoute = wrapper.find(PrivateRoute).filter('[path="/room/:URLRoomName"]');

    expect(roomRoute).toHaveLength(1);
    expect(roomRoute.prop('exact')).toBeUndefined();
    expect(roomRoute.find(VideoApp).exists()).toBe(true);
  });

  it('keeps the standalone pages out of the room app', () => {
    const wrapper = shallow(<AppRoutes />);
    const standalone = wrapper.find(PrivateRoute).filterWhere(route => !route.find(VideoApp).exists());

    expect(standalone.map(route => route.prop('path'))).toEqual([
      '/report/:roomSid',
      '/history',
      '/dashboard/recursos/:resourceId/ver',
      '/recording/:roomSid',
    ]);
  });
});
