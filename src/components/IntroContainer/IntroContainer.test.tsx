import React from 'react';
import IntroContainer from './IntroContainer';
import { shallow } from 'enzyme';
import { useLocation } from 'react-router-dom';
import { useAppState } from '../../state';
import UserMenu from './UserMenu/UserMenu';

const mockHistoryPush = jest.fn();
jest.mock('react-router-dom', () => {
  return {
    useLocation: jest.fn(),
    useHistory: () => ({ push: mockHistoryPush }),
  };
});
jest.mock('../../state');

const mockUseLocation = useLocation as jest.Mock<any>;
const mockUseAppState = useAppState as jest.Mock<any>;

mockUseLocation.mockImplementation(() => ({ pathname: '/' }));
mockUseAppState.mockImplementation(() => ({ user: undefined }));

describe('the IntroContainer component', () => {
  it('should render the UserMenu when a user object exists and the pathname is not /login', () => {
    mockUseLocation.mockImplementation(() => ({ pathname: '/test' }));
    mockUseAppState.mockImplementation(() => ({ user: {} }));

    const wrapper = shallow(
      <IntroContainer>
        <span>Test Content</span>
      </IntroContainer>
    );

    expect(wrapper.find(UserMenu).exists()).toBe(true);
  });

  it('should not render the UserMenu when the pathname is /login', () => {
    mockUseLocation.mockImplementation(() => ({ pathname: '/login' }));
    mockUseAppState.mockImplementation(() => ({ user: {} }));

    const wrapper = shallow(
      <IntroContainer>
        <span>Test Content</span>
      </IntroContainer>
    );

    expect(wrapper.find(UserMenu).exists()).toBe(false);
  });

  it('should not render the UserMenu when a user object does not exist', () => {
    mockUseLocation.mockImplementation(() => ({ pathname: '/test' }));
    mockUseAppState.mockImplementation(() => ({ user: undefined }));

    const wrapper = shallow(
      <IntroContainer>
        <span>Test Content</span>
      </IntroContainer>
    );

    expect(wrapper.find(UserMenu).exists()).toBe(false);
  });

  it('should render children', () => {
    const wrapper = shallow(
      <IntroContainer>
        <div data-testid="child-content">Test Content</div>
      </IntroContainer>
    );

    expect(wrapper.find('[data-testid="child-content"]').text()).toBe('Test Content');
  });

  describe('the header logo "go home" control', () => {
    beforeEach(() => {
      mockHistoryPush.mockClear();
      mockUseLocation.mockImplementation(() => ({ pathname: '/room/prueba' }));
      mockUseAppState.mockImplementation(() => ({ user: undefined }));
    });

    it('navigates to the lobby carrying the role when the logo is clicked', () => {
      const wrapper = shallow(
        <IntroContainer homeRole="student">
          <span>Test Content</span>
        </IntroContainer>
      );

      wrapper.find('button[aria-label="Ir al inicio"]').simulate('click');

      expect(mockHistoryPush).toHaveBeenCalledWith({ pathname: '/', state: { preJoinRole: 'student' } });
    });

    it('navigates to the lobby without role state when homeRole is not provided', () => {
      const wrapper = shallow(
        <IntroContainer>
          <span>Test Content</span>
        </IntroContainer>
      );

      wrapper.find('button[aria-label="Ir al inicio"]').simulate('click');

      expect(mockHistoryPush).toHaveBeenCalledWith({ pathname: '/', state: undefined });
    });
  });
});
