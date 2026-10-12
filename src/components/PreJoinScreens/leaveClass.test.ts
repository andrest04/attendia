import { leaveClass } from './leaveClass';
import { clearRejoinSession } from './rejoinSession';

jest.mock('./rejoinSession', () => ({ clearRejoinSession: jest.fn() }));

describe('leaveClass', () => {
  beforeEach(jest.clearAllMocks);

  it('forgets the rejoin session, then disconnects the room', () => {
    const disconnect = jest.fn();

    leaveClass({ disconnect });

    expect(clearRejoinSession).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect((clearRejoinSession as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      disconnect.mock.invocationCallOrder[0]
    );
  });

  it.each([[null], [undefined]])('still forgets the session, without throwing, when the room is %p', room => {
    expect(() => leaveClass(room)).not.toThrow();
    expect(clearRejoinSession).toHaveBeenCalledTimes(1);
  });
});
