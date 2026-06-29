import { useCallback, useState } from 'react';
import useVideoContext from '../useVideoContext/useVideoContext';
import useClassDataChannel from '../useClassDataChannel/useClassDataChannel';

/**
 * Classroom moderation signaling over a Twilio LocalDataTrack.
 *
 * Transport rationale: mirrors useRaiseHand / useAttentionTelemetry — a DataTrack
 * is part of Video core, so it is always available even when Conversations/chat is
 * disabled. There is NO server involved (SDK-as-state, same as the rest). The shared
 * DataTrack scaffold lives in useClassDataChannel; this hook only adds the protocol.
 *
 * IMPORTANT — moderation by convention, NOT a security boundary. A professor cannot
 * reach into another browser and disable its microphone directly: muting is a
 * REQUEST that the target client honors by disabling its OWN local audio track.
 * A modified client could ignore it. This mirrors the room-access guard and the
 * role-is-a-suffix model: a classroom UX guardrail, not enforcement.
 *
 * Browser constraint shaping the design: re-enabling someone's mic without their
 * gesture is invasive, so the professor only MUTES. Students re-enable themselves
 * (the Zoom default). There is intentionally no "force unmute".
 *
 * Protocol:
 * - { type: 'mute-audio', identity } — the professor asks `identity` to mute. Only
 *   the targeted client acts (disables its own audio); the sender identity is the
 *   Twilio participant, never the payload.
 */

interface MuteAudioMessage {
  type: 'mute-audio';
  identity: string;
}

type ModerationMessage = MuteAudioMessage;

export interface ModerationApi {
  /** Professor action: ask `identity` to mute their microphone. */
  muteParticipant: (identity: string) => void;
  /** Increments each time the professor mutes THIS participant (drives a toast). */
  mutedByProfessorCount: number;
}

export default function useModeration(): ModerationApi {
  const { room } = useVideoContext();
  const [mutedByProfessorCount, setMutedByProfessorCount] = useState(0);

  const { send } = useClassDataChannel<ModerationMessage>({
    onMessage: message => {
      const localParticipant = room?.localParticipant;
      if (!localParticipant) return;
      if (
        message.type === 'mute-audio' &&
        typeof message.identity === 'string' &&
        message.identity === localParticipant.identity
      ) {
        // Honor the request by disabling our OWN audio track (soft mute — the track
        // stays published, so the student can re-enable it from their mic button).
        // Only act on tracks that are actually enabled, and bump the count (which
        // drives the toast) only when audio was actually silenced — muting an
        // already-muted mic is a no-op and must not notify the student.
        let didMute = false;
        localParticipant.audioTracks.forEach((publication: any) => {
          const track = publication.track;
          if (track?.isEnabled) {
            track.disable();
            didMute = true;
          }
        });
        if (didMute) {
          setMutedByProfessorCount(count => count + 1);
        }
      }
    },
  });

  const muteParticipant = useCallback(
    (identity: string) => {
      send({ type: 'mute-audio', identity });
    },
    [send]
  );

  return { muteParticipant, mutedByProfessorCount };
}
