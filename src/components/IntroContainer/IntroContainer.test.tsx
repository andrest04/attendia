import React from 'react';
import IntroContainer from './IntroContainer';
import DashboardHeader from '../TeacherDashboard/DashboardHeader';
import { shallow } from 'enzyme';
import { useLocation } from 'react-router-dom';
import { useAppState } from '../../state';

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
  it('should show the profile chip when a user object exists and the pathname is not /login', () => {
    mockUseLocation.mockImplementation(() => ({ pathname: '/test' }));
    mockUseAppState.mockImplementation(() => ({ user: {} }));

    const wrapper = shallow(
      <IntroContainer>
        <span>Test Content</span>
      </IntroContainer>
    );

    expect(wrapper.find(DashboardHeader).prop('showProfile')).toBe(true);
  });

  it('should hide the profile chip when the pathname is /login', () => {
    mockUseLocation.mockImplementation(() => ({ pathname: '/login' }));
    mockUseAppState.mockImplementation(() => ({ user: {} }));

    const wrapper = shallow(
      <IntroContainer>
        <span>Test Content</span>
      </IntroContainer>
    );

    expect(wrapper.find(DashboardHeader).prop('showProfile')).toBe(false);
  });

  it('should hide the profile chip when onReturnToDashboard is provided ("Volver al panel" is already the way back)', () => {
    mockUseLocation.mockImplementation(() => ({ pathname: '/test' }));
    mockUseAppState.mockImplementation(() => ({ user: {} }));

    const wrapper = shallow(
      <IntroContainer onReturnToDashboard={jest.fn()}>
        <span>Test Content</span>
      </IntroContainer>
    );

    expect(wrapper.find(DashboardHeader).prop('showProfile')).toBe(false);
  });

  it('should hide the profile chip when a user object does not exist', () => {
    mockUseLocation.mockImplementation(() => ({ pathname: '/test' }));
    mockUseAppState.mockImplementation(() => ({ user: undefined }));

    const wrapper = shallow(
      <IntroContainer>
        <span>Test Content</span>
      </IntroContainer>
    );

    expect(wrapper.find(DashboardHeader).prop('showProfile')).toBe(false);
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

      wrapper.find(DashboardHeader).prop('onLogoClick')!();

      expect(mockHistoryPush).toHaveBeenCalledWith({ pathname: '/', state: { preJoinRole: 'student' } });
    });

    it('navigates to the lobby without role state when homeRole is not provided', () => {
      const wrapper = shallow(
        <IntroContainer>
          <span>Test Content</span>
        </IntroContainer>
      );

      wrapper.find(DashboardHeader).prop('onLogoClick')!();

      expect(mockHistoryPush).toHaveBeenCalledWith({ pathname: '/', state: undefined });
    });
  });

  describe('the "Volver al panel" back-to-dashboard link', () => {
    it('renders above the content card and calls onReturnToDashboard when clicked', () => {
      const onReturnToDashboard = jest.fn();
      const wrapper = shallow(
        <IntroContainer onReturnToDashboard={onReturnToDashboard}>
          <span>Test Content</span>
        </IntroContainer>
      );

      const backLink = wrapper.find('[data-testid="back-to-dashboard"]');
      expect(backLink.exists()).toBe(true);
      expect(backLink.text()).toContain('Volver al panel');

      backLink.simulate('click');
      expect(onReturnToDashboard).toHaveBeenCalledTimes(1);
    });

    it('does not render when onReturnToDashboard is not provided', () => {
      const wrapper = shallow(
        <IntroContainer>
          <span>Test Content</span>
        </IntroContainer>
      );

      expect(wrapper.find('[data-testid="back-to-dashboard"]').exists()).toBe(false);
    });
  });
});
