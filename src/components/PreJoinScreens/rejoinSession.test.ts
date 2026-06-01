import { clearRejoinSession, getResumableSession, readRejoinSession, saveRejoinSession } from './rejoinSession';

// jsdom (this Jest stack) does not reliably provide sessionStorage, so polyfill
// a minimal in-memory implementation that mirrors the localStorage polyfill in setupTests.
class MemoryStorage {
  store = {} as { [key: string]: string };
  getItem(key: string) {
    return key in this.store ? this.store[key] : null;
  }
  setItem(key: string, value: string) {
    this.store[key] = value;
  }
  removeItem(key: string) {
    delete this.store[key];
  }
}

Object.defineProperty(window, 'sessionStorage', { value: new MemoryStorage(), writable: true });

describe('rejoinSession persistence', () => {
  beforeEach(() => {
    (window.sessionStorage as any).store = {};
  });

  it('round-trips a saved session through read', () => {
    saveRejoinSession({ roomName: 'Andres', identity: 'Andres [Profesor]' });
    expect(readRejoinSession()).toEqual({ roomName: 'Andres', identity: 'Andres [Profesor]' });
  });

  it('returns null when nothing has been saved', () => {
    expect(readRejoinSession()).toBeNull();
  });

  it('returns null when the stored value is not valid JSON', () => {
    window.sessionStorage.setItem('twilio-video-rejoin-session', '{not json');
    expect(readRejoinSession()).toBeNull();
  });

  it('returns null when the stored shape is missing required fields', () => {
    window.sessionStorage.setItem('twilio-video-rejoin-session', JSON.stringify({ roomName: 'Andres' }));
    expect(readRejoinSession()).toBeNull();
  });

  it('clears a saved session', () => {
    saveRejoinSession({ roomName: 'Andres', identity: 'Ana' });
    clearRejoinSession();
    expect(readRejoinSession()).toBeNull();
  });

  describe('getResumableSession', () => {
    it('returns null when there is no URL room name', () => {
      saveRejoinSession({ roomName: 'Andres', identity: 'Ana' });
      expect(getResumableSession(undefined)).toBeNull();
      expect(getResumableSession('')).toBeNull();
    });

    it('returns null when no session is stored', () => {
      expect(getResumableSession('Andres')).toBeNull();
    });

    it('returns the session when its room matches the current URL room', () => {
      saveRejoinSession({ roomName: 'Andres', identity: 'Andres [Profesor]' });
      expect(getResumableSession('Andres')).toEqual({ roomName: 'Andres', identity: 'Andres [Profesor]' });
    });

    it('returns null when the stored session belongs to a different room', () => {
      saveRejoinSession({ roomName: 'Andres', identity: 'Andres [Profesor]' });
      expect(getResumableSession('otra-sala')).toBeNull();
    });
  });
});
