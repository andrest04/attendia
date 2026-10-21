import { Room } from 'twilio-video';
import { isTeacherIdentity } from '../../classSession/classSessionTypes';
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

/**
 * The professor asks `identity` to turn their microphone ON. Only a request: the target
 * client never enables the track itself, the student does it from a prompt (their gesture).
 */
export interface UnmuteRequestMessage {
  type: 'request-unmute';
  identity: string;
}

/** The professor asks `identity` to turn their own camera off (forced; the client obeys). */
export interface MuteVideoMessage {
  type: 'mute-video';
  identity: string;
}

/**
 * The professor suggests `identity` turn their camera ON. Only a request: the target client
 * never publishes the camera itself, the student does it from a prompt (their gesture).
 */
export interface VideoRequestMessage {
  type: 'request-video';
  identity: string;
}

/** The professor allows or revokes screen sharing for `identity`. Students default to NOT allowed. */
export interface GrantScreenShareMessage {
  type: 'grant-screenshare';
  identity: string;
  allowed: boolean;
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

/** One buffered attention reading: epoch ms and the 0-100 index. */
export interface AttentionBackfillSample {
  t: number;
  index: number;
}

/**
 * A student's readings taken while no teacher was in the room, sent (reliably, in chunks) when
 * a teacher connects. The sender is the Twilio participant; `identity` is informational and a
 * receiver ignores a payload that names someone else.
 */
export interface AttentionBackfillMessage {
  type: 'attention-backfill';
  identity: string;
  samples: AttentionBackfillSample[];
}

export type ClassMessage =
  | RaiseHandMessage
  | GrantTurnMessage
  | MuteAudioMessage
  | UnmuteRequestMessage
  | MuteVideoMessage
  | VideoRequestMessage
  | GrantScreenShareMessage
  | ProctoringWarningMessage
  | SessionEndedMessage
  | AttentionTelemetryMessage
  | AttentionBackfillMessage;

/** Whether a targeted message (one carrying an `identity`) is aimed at the local participant. */
export function isAddressedToMe(message: { identity?: unknown }, room: Room | null | undefined): boolean {
  return typeof message.identity === 'string' && message.identity === room?.localParticipant?.identity;
}

/**
 * Whether the participant a message arrived from is a teacher. Teacher-to-student commands
 * (end session, mute, proctoring warning, grant turn) must only be obeyed when this holds;
 * the sender is always the Twilio participant, never the payload.
 */
export function isFromTeacher(participant: { identity?: string } | null | undefined): boolean {
  return isTeacherIdentity(participant?.identity);
}
