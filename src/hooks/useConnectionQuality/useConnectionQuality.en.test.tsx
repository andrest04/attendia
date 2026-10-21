import React from 'react';
import { I18nextProvider } from 'react-i18next';
import { renderHook } from '@testing-library/react-hooks';
import { createI18n } from '../../i18n/createI18n';
import useConnectionQuality from './useConnectionQuality';

describe('useConnectionQuality labels', () => {
  const original = Object.getOwnPropertyDescriptor(window.navigator, 'connection');
  afterEach(() => {
    if (original) Object.defineProperty(window.navigator, 'connection', original);
    else delete (window.navigator as any).connection;
  });

  const labelFor = (lng: string) => {
    const instance = createI18n({ detect: false, lng });
    const wrapper = ({ children }: { children?: React.ReactNode }) => (
      <I18nextProvider i18n={instance}>{children}</I18nextProvider>
    );
    return renderHook(() => useConnectionQuality(), { wrapper }).result.current.label;
  };

  it('labels the unknown bucket in both languages', () => {
    delete (window.navigator as any).connection;
    expect(labelFor('es')).toBe('Verificando…');
    expect(labelFor('en')).toBe('Checking…');
  });

  it('labels a poor connection in both languages', () => {
    Object.defineProperty(window.navigator, 'connection', {
      configurable: true,
      value: { effectiveType: '2g', addEventListener: jest.fn(), removeEventListener: jest.fn() },
    });
    expect(labelFor('es')).toBe('Conexión débil');
    expect(labelFor('en')).toBe('Weak connection');
  });
});
