import React from 'react';
import { shallow } from 'enzyme';
import SessionEndedScreen from './SessionEndedScreen';
import { useAppState } from '../../state';

jest.mock('../../state');

const mockedAppState = useAppState as jest.Mock<any>;

describe('SessionEndedScreen', () => {
  let setSessionEndedByProfessor: jest.Mock;

  beforeEach(() => {
    setSessionEndedByProfessor = jest.fn();
    mockedAppState.mockImplementation(() => ({ setSessionEndedByProfessor }));
  });

  it('renders the ended message', () => {
    const wrapper = shallow(<SessionEndedScreen />);
    expect(wrapper.find('[data-testid="session-ended-screen"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('La sesión finalizó');
  });

  it('clears the ended flag when "Volver al inicio" is clicked', () => {
    const wrapper = shallow(<SessionEndedScreen />);
    wrapper.find('[data-testid="session-ended-home"]').simulate('click');
    expect(setSessionEndedByProfessor).toHaveBeenCalledWith(false);
  });
});
