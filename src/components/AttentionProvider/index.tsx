/**
 * AttentionProvider — mock-now / real-later SEAM
 * ─────────────────────────────────────────────
 * This provider is the architectural boundary between the UI and the computer-
 * vision (CV) pipeline. Today it feeds `mockAttentionData` (deterministic,
 * stable). When EP04/05/06 deliver the real CV backend, the live implementation
 * will produce `AttentionData` via streaming updates and replace only the data
 * source here — consumers (S4 analytics, S5 proctoring, S6 report — all
 * professor-facing) stay unchanged because they read exclusively through
 * `useAttention`. Students have NO attention UI and NO control over the
 * analysis (the "Mi Atención" panel and the `enabled` privacy toggle were
 * removed by product decision, 2026-06-12).
 *
 * OUT OF SCOPE for this provider:
 * - Signaling actions (raise-hand, give-turn, proctoring responses) are a
 *   separate, deferred channel (DataTrack or Conversations). They will NOT live
 *   here; they belong in a dedicated SignalingProvider or equivalent.
 */

import React, { createContext, useContext } from 'react';
import { AttentionContextValue, AttentionLevel } from './types';
import { mockAttentionData } from './mockAttentionData';

// null! mirrors the pattern used in ChatProvider and ParticipantProvider.
export const AttentionContext = createContext<AttentionContextValue>(null!);

export const AttentionProvider: React.FC = ({ children }) => {
  const attentionLevel = (score: number): AttentionLevel => {
    const { lowMax, mediumMax } = mockAttentionData.ranges;
    if (score <= lowMax) return 'low';
    if (score <= mediumMax) return 'medium';
    return 'high';
  };

  const value: AttentionContextValue = {
    ...mockAttentionData,
    attentionLevel,
  };

  return <AttentionContext.Provider value={value}>{children}</AttentionContext.Provider>;
};

export function useAttention(): AttentionContextValue {
  const context = useContext(AttentionContext);
  if (!context) {
    throw new Error('useAttention must be used within an AttentionProvider');
  }
  return context;
}
