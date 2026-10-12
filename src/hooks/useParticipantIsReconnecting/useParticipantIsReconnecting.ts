import { Participant } from 'twilio-video';
import useEmitterState from '../useEmitterState/useEmitterState';

export default function useParticipantIsReconnecting(participant: Participant) {
  // A new participant always starts as "not reconnecting".
  return useEmitterState(participant, () => false, {
    reconnecting: () => true,
    reconnected: () => false,
  });
}
