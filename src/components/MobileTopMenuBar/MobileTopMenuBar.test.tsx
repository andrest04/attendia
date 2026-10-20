import React from 'react';
import { shallow } from 'enzyme';
import MobileTopMenuBar from './MobileTopMenuBar';
import EndCallButton from '../Buttons/EndCallButton/EndCallButton';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import { useSessionEndApi } from '../../hooks/useSessionEnd/sessionEndContext';

jest.mock('../../hooks/useVideoContext/useVideoContext');
jest.mock('../../hooks/useSessionEnd/sessionEndContext');

const mockUseVideoContext = useVideoContext as jest.Mock<any>;
const mockUseSessionEndApi = useSessionEndApi as jest.Mock<any>;

const sessionEnd = { endSessionForAll: jest.fn(), leaveWithoutEnding: jest.fn(), isEnding: true };
const withIdentity = (identity: string) =>
  mockUseVideoContext.mockImplementation(() => ({ room: { name: 'Sala', localParticipant: { identity } } }));

describe('the MobileTopMenuBar component', () => {
  beforeEach(() => mockUseSessionEndApi.mockImplementation(() => sessionEnd));

  it('gives a teacher the end-for-all / leave actions and the busy flag', () => {
    withIdentity('Ana [Profesor]');
    const end = shallow(<MobileTopMenuBar />).find(EndCallButton);
    expect(end.prop('onEndForAll')).toBe(sessionEnd.endSessionForAll);
    expect(end.prop('onLeave')).toBe(sessionEnd.leaveWithoutEnding);
    expect(end.prop('isEnding')).toBe(true);
  });

  it('leaves the EndCallButton plain for a student', () => {
    withIdentity('student-bob');
    const end = shallow(<MobileTopMenuBar />).find(EndCallButton);
    expect(end.prop('onEndForAll')).toBeUndefined();
    expect(end.prop('onLeave')).toBeUndefined();
  });
});
