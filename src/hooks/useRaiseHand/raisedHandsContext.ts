import { createContext, useContext } from 'react';

/**
 * Identities (Twilio participant identity) of everyone currently raising their hand,
 * including the local participant. Provided by Room and consumed by the participant
 * tiles (ParticipantInfo / MainParticipantInfo) so each tile can show a raised-hand
 * badge in its corner. Defaults to an empty set so tiles render fine without a
 * provider (unit tests, Storybook).
 */
export const RaisedHandsContext = createContext<Set<string>>(new Set<string>());

/** True when the given participant identity currently has their hand raised. */
export function useRaisedHand(identity: string): boolean {
  return useContext(RaisedHandsContext).has(identity);
}

/**
 * Builds the identity set for the context: the remote raised hands (from
 * useRaiseHand) plus the local participant when their own hand is up.
 */
export function buildRaisedHandIdentities(
  raisedHands: string[],
  isHandRaised: boolean,
  localIdentity?: string
): Set<string> {
  const identities = new Set(raisedHands);
  if (isHandRaised && localIdentity) {
    identities.add(localIdentity);
  }
  return identities;
}
