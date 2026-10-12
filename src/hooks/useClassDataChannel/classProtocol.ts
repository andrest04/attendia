import { Room } from 'twilio-video';
import { ProctoringAlert } from '../../components/AttentionProvider/types';

/**
 * The wire protocol of the classroom data channel: every message that travels over the
 * shared DataTrack, declared in ONE place. It used to be spread over five hooks, each
 * declaring its own message type and re-deriving "is this aimed at me?".
 *
 * All messages are JSON objects discriminated by `type`. The sender is NEVER read from the
 * payload — it is the Twilio participant the message arrived from. Messages aimed at one
 * participant carry the target's `identity`.
 *
 * The wire format is a contract with browsers that may still run an older build: add
 * optional fields, do not rename or repurpose existing ones.
 */

/** A participant toggled their own raised hand. */
export interface RaiseHandMessage {
  type: 'raise-hand';
  raised: boolean;
}

/** The professor gave `identity` the turn. */
export interface GrantTurnMessage {
  type: 'grant-turn';
  identity: string;
}

/** The professor asks `identity` to mute their own microphone. */
export interface MuteAudioMessage {
  type: 'mute-audio';
  identity: string;
}

/** The professor warns `identity` about a proctoring condition. */
export interface ProctoringWarningMessage {
  type: 'proctoring-warning';
  identity: string;
  kind: ProctoringAlert['kind'];
}

/** The professor ended the session for everyone. */
export interface SessionEndedMessage {
  type: 'session-ended';
}

/** A participant's own ~1 Hz attention snapshot. */
export interface AttentionTelemetryMessage {
  type: 'attention-telemetry';
  index: number;
  multiface: boolean;
  faces: number;
  cameraOff: boolean;
  /** True when this device cannot run the CV pipeline at all (mobile). */
  unsupported: boolean;
}

export type ClassMessage =
  | RaiseHandMessage
  | GrantTurnMessage
  | MuteAudioMessage
  | ProctoringWarningMessage
  | SessionEndedMessage
  | AttentionTelemetryMessage;

/** Whether a targeted message (one carrying an `identity`) is aimed at the local participant. */
export function isAddressedToMe(message: { identity?: unknown }, room: Room | null | undefined): boolean {
  return typeof message.identity === 'string' && message.identity === room?.localParticipant?.identity;
}
