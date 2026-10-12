import { replaceUrlWithoutNavigation } from './replaceUrlWithoutNavigation';

describe('replaceUrlWithoutNavigation', () => {
  const originalLocation = window.location;
  const originalReplaceState = window.history.replaceState;
  let replaceState: jest.Mock;

  const setOrigin = (origin: string) => {
    // @ts-ignore jsdom lets the test swap location for a plain object
    delete window.location;
    // @ts-ignore
    window.location = { ...originalLocation, origin };
  };

  beforeEach(() => {
    replaceState = jest.fn();
    Object.defineProperty(window.history, 'replaceState', { configurable: true, value: replaceState });
    setOrigin('https://attendia.test');
  });

  afterEach(() => {
    Object.defineProperty(window.history, 'replaceState', { configurable: true, value: originalReplaceState });
    // @ts-ignore
    window.location = originalLocation;
    delete (window as { STORYBOOK_ENV?: unknown }).STORYBOOK_ENV;
  });

  it('replaces the url in place, without a history entry', () => {
    replaceUrlWithoutNavigation('/room/algebra?x=1');

    expect(replaceState).toHaveBeenCalledWith(null, '', '/room/algebra?x=1');
  });

  it('leaves the url alone on a twil.io deployment', () => {
    setOrigin('https://video-app-1234-twil.io');

    replaceUrlWithoutNavigation('/room/algebra');

    expect(replaceState).not.toHaveBeenCalled();
  });

  it('leaves the url alone inside Storybook', () => {
    (window as { STORYBOOK_ENV?: unknown }).STORYBOOK_ENV = true;

    replaceUrlWithoutNavigation('/room/algebra');

    expect(replaceState).not.toHaveBeenCalled();
  });
});
