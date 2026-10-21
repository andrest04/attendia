import React from 'react';
import { act, renderHook } from '@testing-library/react-hooks';
import { ScreenShareGrantProvider, usePublishScreenShareGrant, useScreenShareGrant } from './screenShareGrantContext';

describe('screenShareGrantContext', () => {
  it('has no opinion without a provider (null = not gated)', () => {
    const { result } = renderHook(() => useScreenShareGrant());
    expect(result.current).toBeNull();
  });

  it('starts NOT allowed under a provider and follows what Room publishes', () => {
    let allowed = false;
    const wrapper = ({ children }: { children?: React.ReactNode }) => (
      <ScreenShareGrantProvider>{children}</ScreenShareGrantProvider>
    );
    const { result, rerender } = renderHook(
      () => {
        usePublishScreenShareGrant(allowed);
        return useScreenShareGrant();
      },
      { wrapper }
    );
    expect(result.current).toBe(false);
    allowed = true;
    act(() => rerender());
    expect(result.current).toBe(true);
  });
});
