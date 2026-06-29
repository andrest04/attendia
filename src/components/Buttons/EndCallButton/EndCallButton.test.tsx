import React from 'react';
import { shallow } from 'enzyme';

import EndCallButton from './EndCallButton';
import { clearRejoinSession } from '../../PreJoinScreens/rejoinSession';

const mockVideoContext: { room: { disconnect: jest.Mock } | null } = {
  room: {
    disconnect: jest.fn(),
  },
};

jest.mock('../../../hooks/useVideoContext/useVideoContext', () => () => mockVideoContext);
jest.mock('../../PreJoinScreens/rejoinSession', () => ({
  clearRejoinSession: jest.fn(),
}));

const mockClearRejoinSession = clearRejoinSession as jest.Mock;

describe('End Call button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVideoContext.room = { disconnect: jest.fn() };
  });

  it('should disconnect from the room when clicked', () => {
    const wrapper = shallow(<EndCallButton />);
    wrapper.simulate('click');
    expect(mockVideoContext.room!.disconnect).toHaveBeenCalled();
  });

  it('should clear the rejoin session before disconnecting', () => {
    const wrapper = shallow(<EndCallButton />);
    wrapper.simulate('click');
    expect(mockClearRejoinSession).toHaveBeenCalled();
  });

  it('does not throw when clicked while room is already null and still clears the rejoin session', () => {
    // A page refresh / double-click race can disconnect the room first (via
    // 'beforeunload'), leaving room null. Clicking "Salir" must not throw.
    mockVideoContext.room = null;
    const wrapper = shallow(<EndCallButton />);
    expect(() => wrapper.simulate('click')).not.toThrow();
    expect(mockClearRejoinSession).toHaveBeenCalled();
  });
});
