/**
 * AttentionProvider — mock-now / real-later SEAM
 * ─────────────────────────────────────────────
 * This provider is the architectural boundary between the UI and the computer-
 * vision (CV) pipeline. Today it feeds `mockAttentionData` (deterministic,
 * stable). When EP04/05/06 deliver the real CV backend, the live implementation
 * will produce `AttentionData` via streaming updates and replace only the data
 * source here — consumers (S3 "Mi Atención", S4 analytics, S5 proctoring,
 * S6 report) stay unchanged because they read exclusively through `useAttention`.
 *
 * OUT OF SCOPE for this provider:
 * - Signaling actions (raise-hand, give-turn, proctoring responses) are a
 *   separate, deferred channel (DataTrack or Conversations). They will NOT live
 *   here; they belong in a dedicated SignalingProvider or equivalent.
 */

import React, { createContext, useContext, useState } from 'react';
import { AttentionContextValue, AttentionLevel } from './types';
import { mockAttentionData } from './mockAttentionData';

// null! mirrors the pattern used in ChatProvider and ParticipantProvider.
export const AttentionContext = createContext<AttentionContextValue>(null!);

export const AttentionProvider: React.FC = ({ children }) => {
  const [enabled, setEnabled] = useState<boolean>(mockAttentionData.enabled);

  const attentionLevel = (score: number): AttentionLevel => {
    const { lowMax, mediumMax } = mockAttentionData.ranges;
    if (score <= lowMax) return 'low';
    if (score <= mediumMax) return 'medium';
    return 'high';
  };

  const value: AttentionContextValue = {
    ...mockAttentionData,
    enabled,
    setEnabled,
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
