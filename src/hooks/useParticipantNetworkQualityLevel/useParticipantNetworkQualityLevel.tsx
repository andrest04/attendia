import { Participant } from 'twilio-video';
import useEmitterState from '../useEmitterState/useEmitterState';

export default function useParticipantNetworkQualityLevel(participant: Participant | null) {
  return useEmitterState<Participant | null, number | null>(
    participant,
    current => (current ? current.networkQualityLevel : null),
    { networkQualityLevelChanged: (_participant, newNetworkQualityLevel: number) => newNetworkQualityLevel },
    { initial: participant?.networkQualityLevel ?? null }
  );
}
