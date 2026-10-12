import { createStorageSlot } from './createStorageSlot';

const parseNumber = (stored: unknown) => (typeof stored === 'number' ? stored : null);

const swapStorage = (area: 'sessionStorage' | 'localStorage', replacement: Partial<Storage>) =>
  Object.defineProperty(window, area, { configurable: true, value: replacement });

describe('createStorageSlot', () => {
  const realSession = window.sessionStorage;
  const realLocal = window.localStorage;

  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: realSession });
    Object.defineProperty(window, 'localStorage', { configurable: true, value: realLocal });
  });

  it('round-trips a value under its key', () => {
    const slot = createStorageSlot({ key: 'k', parse: parseNumber });

    slot.write(42);

    expect(window.sessionStorage.getItem('k')).toBe('42');
    expect(slot.read()).toBe(42);
  });

  it('is empty until written and after clear', () => {
    const slot = createStorageSlot({ key: 'k', parse: parseNumber });
    expect(slot.read()).toBeNull();

    slot.write(1);
    slot.clear();

    expect(slot.read()).toBeNull();
    expect(window.sessionStorage.getItem('k')).toBeNull();
  });

  it('keeps independent keys independent', () => {
    const a = createStorageSlot({ key: 'a', parse: parseNumber });
    const b = createStorageSlot({ key: 'b', parse: parseNumber });

    a.write(1);
    b.write(2);
    a.clear();

    expect(a.read()).toBeNull();
    expect(b.read()).toBe(2);
  });

  it('can use localStorage instead of sessionStorage', () => {
    const slot = createStorageSlot({ key: 'k', area: 'localStorage', parse: parseNumber });

    slot.write(7);

    expect(window.localStorage.getItem('k')).toBe('7');
    expect(window.sessionStorage.getItem('k')).toBeNull();
    expect(slot.read()).toBe(7);
  });

  it('reads null when the stored value does not parse into a T', () => {
    window.sessionStorage.setItem('k', JSON.stringify('not a number'));

    expect(createStorageSlot({ key: 'k', parse: parseNumber }).read()).toBeNull();
  });

  it('reads null when the stored text is not valid JSON', () => {
    window.sessionStorage.setItem('k', '{broken');

    expect(createStorageSlot({ key: 'k', parse: parseNumber }).read()).toBeNull();
  });

  it('reads null when parse throws', () => {
    window.sessionStorage.setItem('k', '1');
    const slot = createStorageSlot<number>({
      key: 'k',
      parse: () => {
        throw new Error('boom');
      },
    });

    expect(slot.read()).toBeNull();
  });

  it('never throws when storage is unavailable', () => {
    const slot = createStorageSlot({ key: 'k', parse: parseNumber });
    const broken = () => {
      throw new Error('SecurityError');
    };
    swapStorage('sessionStorage', { getItem: broken, setItem: broken, removeItem: broken });

    expect(() => slot.write(1)).not.toThrow();
    expect(slot.read()).toBeNull();
    expect(() => slot.clear()).not.toThrow();
  });

  it('resolves the storage on every call, not at creation', () => {
    const slot = createStorageSlot({ key: 'k', parse: parseNumber });
    const fake: { [key: string]: string } = {};
    swapStorage('sessionStorage', {
      getItem: (key: string) => (key in fake ? fake[key] : null),
      setItem: (key: string, value: string) => {
        fake[key] = value;
      },
    });

    slot.write(5);

    expect(fake.k).toBe('5');
    expect(slot.read()).toBe(5);
  });
});
