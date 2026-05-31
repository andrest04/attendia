import { act, renderHook } from '@testing-library/react-hooks';
import useConnectionQuality, { mapEffectiveType } from './useConnectionQuality';

describe('mapEffectiveType', () => {
  it('maps 4g to good', () => {
    expect(mapEffectiveType('4g')).toBe('good');
  });

  it('maps 3g to medium', () => {
    expect(mapEffectiveType('3g')).toBe('medium');
  });

  it('maps 2g and slow-2g to poor', () => {
    expect(mapEffectiveType('2g')).toBe('poor');
    expect(mapEffectiveType('slow-2g')).toBe('poor');
  });

  it('maps unknown/undefined values to unknown', () => {
    expect(mapEffectiveType(undefined)).toBe('unknown');
    expect(mapEffectiveType('5g')).toBe('unknown');
  });
});

describe('useConnectionQuality', () => {
  const originalConnection = Object.getOwnPropertyDescriptor(navigator, 'connection');

  function mockConnection(effectiveType?: string) {
    const listeners: Record<string, Array<() => void>> = {};
    const connection = {
      effectiveType,
      addEventListener: jest.fn((type: string, cb: () => void) => {
        (listeners[type] = listeners[type] || []).push(cb);
      }),
      removeEventListener: jest.fn(),
      // Test helper to simulate a network change.
      _emit(type: string) {
        (listeners[type] || []).forEach(cb => cb());
      },
      _set(next?: string) {
        (connection as any).effectiveType = next;
      },
    };
    Object.defineProperty(navigator, 'connection', { value: connection, configurable: true });
    return connection;
  }

  afterEach(() => {
    if (originalConnection) {
      Object.defineProperty(navigator, 'connection', originalConnection);
    } else {
      // @ts-ignore — remove the property we added for the test.
      delete (navigator as any).connection;
    }
  });

  it('reports unknown when the Network Information API is unavailable', () => {
    // @ts-ignore
    delete (navigator as any).connection;
    const { result } = renderHook(() => useConnectionQuality());
    expect(result.current.quality).toBe('unknown');
    expect(result.current.label).toBe('Verificando…');
  });

  it('derives quality from the current effectiveType', () => {
    mockConnection('4g');
    const { result } = renderHook(() => useConnectionQuality());
    expect(result.current.quality).toBe('good');
    expect(result.current.label).toBe('Conexión buena');
  });

  it('updates when the connection changes', () => {
    const connection = mockConnection('3g');
    const { result } = renderHook(() => useConnectionQuality());
    expect(result.current.quality).toBe('medium');

    act(() => {
      connection._set('2g');
      connection._emit('change');
    });
    expect(result.current.quality).toBe('poor');
  });

  it('removes its listener on unmount', () => {
    const connection = mockConnection('4g');
    const { unmount } = renderHook(() => useConnectionQuality());
    unmount();
    expect(connection.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
