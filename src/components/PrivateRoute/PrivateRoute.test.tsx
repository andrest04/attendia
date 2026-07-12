import React from 'react';
import PrivateRoute from './PrivateRoute';
import { useAppState } from '../../state';
import { mount } from 'enzyme';
import { MemoryRouter } from 'react-router-dom';

const mockUseAppState = useAppState as jest.Mock<any>;

jest.mock('../../state');

const MockComponent = () => <h1>test</h1>;

describe('the PrivateRoute component', () => {
  describe('when isAuthReady is true', () => {
    it('should redirect to /login when there is no user', () => {
      mockUseAppState.mockImplementation(() => ({ user: false, isAuthReady: true }));
      const wrapper = mount(
        <MemoryRouter initialEntries={['/']}>
          <PrivateRoute exact path="/">
            <MockComponent />
          </PrivateRoute>
        </MemoryRouter>
      );
      const history = wrapper.find('Router').prop('history') as any;
      expect(history.location.pathname).toEqual('/login');
      expect(wrapper.exists(MockComponent)).toBe(false);
    });

    it('should render children when there is a user with a profile', () => {
      mockUseAppState.mockImplementation(() => ({
        user: {},
        profile: { displayName: 'Test', email: 'test@example.com', role: 'teacher' },
        isAuthReady: true,
      }));
      const wrapper = mount(
        <MemoryRouter initialEntries={['/']}>
          <PrivateRoute exact path="/">
            <MockComponent />
          </PrivateRoute>
        </MemoryRouter>
      );
      const history = wrapper.find('Router').prop('history') as any;
      expect(history.location.pathname).toEqual('/');
      expect(wrapper.exists(MockComponent)).toBe(true);
    });

    it('should redirect to /login when the user has no profile', () => {
      mockUseAppState.mockImplementation(() => ({ user: {}, profile: null, isAuthReady: true }));
      const wrapper = mount(
        <MemoryRouter initialEntries={['/']}>
          <PrivateRoute exact path="/">
            <MockComponent />
          </PrivateRoute>
        </MemoryRouter>
      );
      const history = wrapper.find('Router').prop('history') as any;
      expect(history.location.pathname).toEqual('/login');
      expect(wrapper.exists(MockComponent)).toBe(false);
    });
  });

  describe('when isAuthReady is false', () => {
    it('should not render children', () => {
      mockUseAppState.mockImplementation(() => ({ user: false, isAuthReady: false }));
      const wrapper = mount(
        <MemoryRouter initialEntries={['/']}>
          <PrivateRoute exact path="/">
            <MockComponent />
          </PrivateRoute>
        </MemoryRouter>
      );
      const history = wrapper.find('Router').prop('history') as any;
      expect(history.location.pathname).toEqual('/');
      expect(wrapper.exists(MockComponent)).toBe(false);
    });
  });
});
