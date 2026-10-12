import React, { createContext } from 'react';
import { renderHook } from '@testing-library/react-hooks';
import useRequiredContext from './useRequiredContext';

const ThingContext = createContext<{ name: string } | null>(null);

describe('the useRequiredContext hook', () => {
  it('returns the provided value', () => {
    const wrapper: React.FC = ({ children }) => (
      <ThingContext.Provider value={{ name: 'thing' }}>{children}</ThingContext.Provider>
    );
    const { result } = renderHook(() => useRequiredContext(ThingContext, 'useThing', 'a ThingProvider'), { wrapper });
    expect(result.current).toEqual({ name: 'thing' });
  });

  it('throws an error naming the hook and the provider when used outside the provider', () => {
    const { result } = renderHook(() => useRequiredContext(ThingContext, 'useThing', 'a ThingProvider'));
    expect(result.error.message).toBe('useThing must be used within a ThingProvider');
  });
});
