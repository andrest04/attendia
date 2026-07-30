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
    const profileRoute = wrapper.find(PrivateRoute).filter('[path="/profile"]');

    expect(profileRoute).toHaveLength(1);
    expect(profileRoute.prop('exact')).toBe(true);
    expect(profileRoute.find(VideoApp).exists()).toBe(true);
  });
});
