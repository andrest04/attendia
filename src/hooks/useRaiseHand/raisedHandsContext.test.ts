import { createElement, ReactNode } from 'react';
import { renderHook } from '@testing-library/react-hooks';
import { RaisedHandsContext, buildRaisedHandIdentities, useRaisedHand } from './raisedHandsContext';

describe('buildRaisedHandIdentities', () => {
  it('returns the remote raised hands as a set', () => {
    const set = buildRaisedHandIdentities(['Ana', 'Luis'], false, 'Yo');
    expect(set.has('Ana')).toBe(true);
    expect(set.has('Luis')).toBe(true);
    expect(set.has('Yo')).toBe(false);
    expect(set.size).toBe(2);
  });

  it('adds the local identity when the local hand is raised', () => {
    const set = buildRaisedHandIdentities(['Ana'], true, 'Yo');
    expect(set.has('Yo')).toBe(true);
    expect(set.size).toBe(2);
  });

  it('does not add the local identity when the hand is down', () => {
    const set = buildRaisedHandIdentities([], false, 'Yo');
    expect(set.size).toBe(0);
  });

  it('does not add an undefined local identity even with the hand raised', () => {
    const set = buildRaisedHandIdentities([], true, undefined);
    expect(set.size).toBe(0);
  });
});

describe('useRaisedHand', () => {
  const wrapperWith = (identities: string[]) => ({ children }: { children: ReactNode }) =>
    createElement(RaisedHandsContext.Provider, { value: new Set(identities) }, children);

  it('is true when the identity is in the context set', () => {
    const { result } = renderHook(() => useRaisedHand('Ana'), { wrapper: wrapperWith(['Ana', 'Luis']) });
    expect(result.current).toBe(true);
  });

  it('is false when the identity is not in the context set', () => {
    const { result } = renderHook(() => useRaisedHand('Otro'), { wrapper: wrapperWith(['Ana']) });
    expect(result.current).toBe(false);
  });

  it('defaults to false with no provider', () => {
    const { result } = renderHook(() => useRaisedHand('Ana'));
    expect(result.current).toBe(false);
  });
});
