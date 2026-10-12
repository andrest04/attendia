type StorageArea = 'sessionStorage' | 'localStorage';

interface StorageSlotOptions<T> {
  key: string;
  /** `sessionStorage` survives a refresh but dies with the tab; `localStorage` outlives it. */
  area?: StorageArea;
  /** Turns whatever was stored into a `T`, or `null` when it is not valid (old shape, hand-edited...). */
  parse: (stored: unknown) => T | null;
}

export interface StorageSlot<T> {
  read(): T | null;
  write(value: T): void;
  clear(): void;
}

/**
 * One JSON value kept in browser storage under a key. The session persistence modules (auto-rejoin,
 * attention consent, dashboard handoff, scheduled class context, onboarding flag) all repeated the
 * same ritual: try/catch around every access because storage can be unavailable (private mode,
 * blocked cookies), and a shape check on read. These are conveniences, so a storage failure must
 * never break the flow: reads fail to `null`, writes and clears fail silently.
 *
 * The storage object is resolved on EVERY call, never captured at import: tests (and some
 * browsers) swap `window.sessionStorage` after modules load.
 */
export function createStorageSlot<T>({ key, area = 'sessionStorage', parse }: StorageSlotOptions<T>): StorageSlot<T> {
  return {
    read() {
      try {
        const raw = window[area].getItem(key);
        return raw ? parse(JSON.parse(raw)) : null;
      } catch {
        return null;
      }
    },
    write(value) {
      try {
        window[area].setItem(key, JSON.stringify(value));
      } catch {
        // See the class comment: never throw from storage access.
      }
    },
    clear() {
      try {
        window[area].removeItem(key);
      } catch {
        // See above.
      }
    },
  };
}
