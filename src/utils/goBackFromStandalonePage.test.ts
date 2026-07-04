import goBackFromStandalonePage from './goBackFromStandalonePage';

describe('goBackFromStandalonePage', () => {
  const originalLocation = window.location;
  let assignMock: jest.Mock;
  let closeMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    assignMock = jest.fn();
    closeMock = jest.fn();
    // jsdom's location.assign is not implemented — replace it with a mock.
    delete (window as any).location;
    (window as any).location = { ...originalLocation, assign: assignMock };
    window.close = closeMock;
  });

  afterEach(() => {
    jest.useRealTimers();
    (window as any).location = originalLocation;
  });

  function setHistoryLength(length: number) {
    Object.defineProperty(window.history, 'length', { configurable: true, value: length });
  }

  it('goes back in history when a prior entry exists', () => {
    setHistoryLength(3);
    const backSpy = jest.spyOn(window.history, 'back').mockImplementation(() => undefined);

    goBackFromStandalonePage();

    expect(backSpy).toHaveBeenCalled();
    expect(closeMock).not.toHaveBeenCalled();
    expect(assignMock).not.toHaveBeenCalled();
    backSpy.mockRestore();
  });

  it('closes the tab when there is no history (opened via window.open)', () => {
    setHistoryLength(1);
    Object.defineProperty(window, 'closed', { configurable: true, value: true });

    goBackFromStandalonePage();
    jest.runAllTimers();

    expect(closeMock).toHaveBeenCalled();
    expect(assignMock).not.toHaveBeenCalled();
  });

  it('falls back to /login when the browser refuses to close the tab', () => {
    setHistoryLength(1);
    Object.defineProperty(window, 'closed', { configurable: true, value: false });

    goBackFromStandalonePage();
    jest.runAllTimers();

    expect(closeMock).toHaveBeenCalled();
    expect(assignMock).toHaveBeenCalledWith('/login');
  });
});
