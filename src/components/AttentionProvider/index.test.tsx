import React from 'react';
import { act, renderHook } from '@testing-library/react-hooks';
import { AttentionProvider, useAttention } from './index';
import { mockAttentionData } from './mockAttentionData';

// ─── Wrapper ──────────────────────────────────────────────────────────────────
const wrapper: React.FC = ({ children }) => <AttentionProvider>{children}</AttentionProvider>;

// ─── useAttention outside provider ────────────────────────────────────────────
describe('useAttention outside a provider', () => {
  it('throws a descriptive error', () => {
    const { result } = renderHook(useAttention);
    expect(result.error?.message).toBe('useAttention must be used within an AttentionProvider');
  });
});

// ─── useAttention inside provider ─────────────────────────────────────────────
describe('useAttention inside AttentionProvider', () => {
  it('exposes source "mock"', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.source).toBe('mock');
  });

  it('exposes the correct groupAttention value from mock data', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.groupAttention).toBe(mockAttentionData.groupAttention);
  });

  it('exposes timeline with the expected length', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.timeline.length).toBe(mockAttentionData.timeline.length);
    expect(result.current.timeline.length).toBeGreaterThanOrEqual(8);
  });

  it('exposes participants array with the expected length', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.participants.length).toBe(mockAttentionData.participants.length);
    expect(result.current.participants.length).toBeGreaterThanOrEqual(4);
  });

  it('has at least one proctoring alert', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.proctoringAlerts.length).toBeGreaterThanOrEqual(1);
  });

  it('exposes the enabled flag as true initially (from mock)', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.enabled).toBe(true);
  });
});

// ─── attentionLevel helper ────────────────────────────────────────────────────
describe('attentionLevel(score) with ranges { lowMax: 40, mediumMax: 70 }', () => {
  it('maps 40 → "low" (boundary)', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.attentionLevel(40)).toBe('low');
  });

  it('maps 0 → "low"', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.attentionLevel(0)).toBe('low');
  });

  it('maps 41 → "medium" (just above lowMax)', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.attentionLevel(41)).toBe('medium');
  });

  it('maps 70 → "medium" (mediumMax boundary)', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.attentionLevel(70)).toBe('medium');
  });

  it('maps 71 → "high" (just above mediumMax)', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.attentionLevel(71)).toBe('high');
  });

  it('maps 100 → "high"', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.attentionLevel(100)).toBe('high');
  });
});

// ─── setEnabled ───────────────────────────────────────────────────────────────
describe('setEnabled', () => {
  it('flips enabled to false when called with false', () => {
    const { result } = renderHook(useAttention, { wrapper });
    expect(result.current.enabled).toBe(true);

    act(() => {
      result.current.setEnabled(false);
    });

    expect(result.current.enabled).toBe(false);
  });

  it('flips enabled back to true', () => {
    const { result } = renderHook(useAttention, { wrapper });

    act(() => {
      result.current.setEnabled(false);
    });
    act(() => {
      result.current.setEnabled(true);
    });

    expect(result.current.enabled).toBe(true);
  });
});
