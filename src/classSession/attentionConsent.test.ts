import { saveConsent, hasConsent, clearConsent } from './attentionConsent';

// Mirror the sessionStorage polyfill used in rejoinSession.test.ts
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
  clear() {
    this.store = {};
  }
}

Object.defineProperty(window, 'sessionStorage', { value: new MemoryStorage(), writable: true });

describe('attentionConsent persistence', () => {
  beforeEach(() => {
    (window.sessionStorage as any).store = {};
  });

  it('returns false when no consent has been saved for the room', () => {
    expect(hasConsent('sala-fisica')).toBe(false);
  });

  it('returns true after saving consent for a room', () => {
    saveConsent('sala-fisica');
    expect(hasConsent('sala-fisica')).toBe(true);
  });

  it('does not leak consent across different rooms', () => {
    saveConsent('sala-fisica');
    expect(hasConsent('sala-matematicas')).toBe(false);
  });

  it('round-trips consent through save and read', () => {
    saveConsent('mi-sala-2024');
    expect(hasConsent('mi-sala-2024')).toBe(true);
  });

  it('clears consent for a specific room', () => {
    saveConsent('sala-fisica');
    clearConsent('sala-fisica');
    expect(hasConsent('sala-fisica')).toBe(false);
  });

  it('clearing one room does not affect consent for another room', () => {
    saveConsent('sala-a');
    saveConsent('sala-b');
    clearConsent('sala-a');
    expect(hasConsent('sala-b')).toBe(true);
  });

  it('swallows storage errors on save without throwing', () => {
    const original = window.sessionStorage.setItem;
    (window.sessionStorage as any).setItem = () => {
      throw new Error('storage full');
    };
    expect(() => saveConsent('sala-fisica')).not.toThrow();
    (window.sessionStorage as any).setItem = original;
  });

  it('returns false and swallows errors on read', () => {
    const original = window.sessionStorage.getItem;
    (window.sessionStorage as any).getItem = () => {
      throw new Error('storage error');
    };
    expect(hasConsent('sala-fisica')).toBe(false);
    (window.sessionStorage as any).getItem = original;
  });

  it('swallows storage errors on clear without throwing', () => {
    const original = window.sessionStorage.removeItem;
    (window.sessionStorage as any).removeItem = () => {
      throw new Error('storage error');
    };
    expect(() => clearConsent('sala-fisica')).not.toThrow();
    (window.sessionStorage as any).removeItem = original;
  });

  it('returns false when stored value is corrupted JSON', () => {
    window.sessionStorage.setItem('twilio-video-attention-consent', '{not-json');
    expect(hasConsent('sala-fisica')).toBe(false);
  });
});
