import React from 'react';
import { Button, Link, Menu, MenuItem, Typography } from '@material-ui/core';
import { shallow } from 'enzyme';
import { useAppState } from '../../../state';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';
import UserMenu from './UserMenu';
import CreatePasswordDialog from './CreatePasswordDialog/CreatePasswordDialog';

jest.mock('../../../state');
jest.mock('../../../hooks/useVideoContext/useVideoContext');

const mockUseAppState = useAppState as jest.Mock<any>;
const mockUseVideoContext = useVideoContext as jest.Mock<any>;

describe('the UserMenu component', () => {
  const mockTrack = { stop: jest.fn() };
  mockUseVideoContext.mockImplementation(() => ({ localTracks: [mockTrack] }));
  const mockSignOut = jest.fn(() => Promise.resolve());
  mockUseAppState.mockImplementation(() => ({
    user: { displayName: 'Test User' },
    signOut: mockSignOut,
  }));

  describe('when logged in with firebase', () => {
    beforeAll(() => {
      process.env.REACT_APP_SET_AUTH = 'firebase';
    });

    it('should open the menu when clicked', () => {
      const wrapper = shallow(<UserMenu />);
      expect(wrapper.find(Menu).prop('open')).toBe(false);
      wrapper.find(Button).simulate('click');
      expect(wrapper.find(Menu).prop('open')).toBe(true);
    });

    it('should stop all tracks and signout when the Logout button is clicked', () => {
      const wrapper = shallow(<UserMenu />);
      wrapper
        .find(MenuItem)
        .last()
        .simulate('click');
      expect(mockTrack.stop).toHaveBeenCalled();
      expect(mockSignOut).toHaveBeenCalled();
    });

    describe('the "Crear contraseña" menu item', () => {
      const menuItemLabels = (wrapper: any) =>
        wrapper.find(MenuItem).map((item: any) => item.find(Typography).prop('children'));

      afterEach(() => {
        // Restore the describe-level user so the other tests keep their mock.
        mockUseAppState.mockImplementation(() => ({
          user: { displayName: 'Test User' },
          signOut: mockSignOut,
        }));
      });

      it('should render for a user whose only provider is google.com', () => {
        mockUseAppState.mockImplementation(() => ({
          user: {
            displayName: 'Test User',
            email: 'test@example.com',
            providerData: [{ providerId: 'google.com' }],
          },
          signOut: mockSignOut,
        }));

        const wrapper = shallow(<UserMenu />);
        expect(menuItemLabels(wrapper)).toEqual(['Crear contraseña', 'Cerrar sesión']);
      });

      it('should not render when the user already has the password provider', () => {
        mockUseAppState.mockImplementation(() => ({
          user: {
            displayName: 'Test User',
            email: 'test@example.com',
            providerData: [{ providerId: 'google.com' }, { providerId: 'password' }],
          },
          signOut: mockSignOut,
        }));

        const wrapper = shallow(<UserMenu />);
        expect(menuItemLabels(wrapper)).toEqual(['Cerrar sesión']);
      });

      it('should close the menu and open the dialog when clicked', () => {
        mockUseAppState.mockImplementation(() => ({
          user: {
            displayName: 'Test User',
            email: 'test@example.com',
            providerData: [{ providerId: 'google.com' }],
          },
          signOut: mockSignOut,
        }));

        const wrapper = shallow(<UserMenu />);
        expect(wrapper.find(CreatePasswordDialog).prop('open')).toBe(false);

        wrapper.find(Button).simulate('click');
        wrapper
          .find(MenuItem)
          .first()
          .simulate('click');

        expect(wrapper.find(Menu).prop('open')).toBe(false);
        expect(wrapper.find(CreatePasswordDialog).prop('open')).toBe(true);
      });
    });
  });

  describe('when logged in with passcode auth', () => {
    beforeAll(() => {
      process.env.REACT_APP_SET_AUTH = 'passcode';
    });

    it('should stop all tracks and signout when the Logout link is clicked', () => {
      const wrapper = shallow(<UserMenu />);
      wrapper.find(Link).simulate('click');
      expect(mockTrack.stop).toHaveBeenCalled();
      expect(mockSignOut).toHaveBeenCalled();
    });
  });
});
