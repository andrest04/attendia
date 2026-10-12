import { createContext } from 'react';
import { Participant, RemoteParticipant } from 'twilio-video';

/**
 * Room state that many components read at once and that is derived from room events:
 * who is connected, who is the dominant speaker, who is sharing their screen.
 *
 * Without this, every consumer of useParticipants / useDominantSpeaker /
 * useScreenShareParticipant attached its OWN set of listeners to the room (nine or more
 * instances of each on a desktop call). ParticipantProvider subscribes once and shares the
 * result; the hooks fall back to their own subscription when no provider is present
 * (unit tests, Storybook), so they stay usable anywhere.
 *
 * Kept in its own module, with no hook imports, so the hooks and the provider can both
 * import it without a cycle.
 */
export interface IRoomState {
  participants: RemoteParticipant[];
  dominantSpeaker: RemoteParticipant | null;
  screenShareParticipant: Participant | undefined;
}

export const RoomStateContext = createContext<IRoomState | null>(null);
