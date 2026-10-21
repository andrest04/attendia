import { useCallback, useState } from 'react';
import useVideoContext from '../useVideoContext/useVideoContext';
import useClassDataChannel from '../useClassDataChannel/useClassDataChannel';
import {
  isAddressedToMe,
  isFromTeacher,
  MuteAudioMessage,
  UnmuteRequestMessage,
} from '../useClassDataChannel/classProtocol';

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
 * gesture is invasive, so the professor can only MUTE or ASK. There is intentionally no
 * "force unmute": a 'request-unmute' raises a pending prompt on the student's side and the
 * mic is enabled only when the student accepts it (their click).
 *
 * Protocol:
 * - { type: 'mute-audio', identity } — the professor asks `identity` to mute. Only
 *   the targeted client acts (disables its own audio); the sender identity is the
 *   Twilio participant, never the payload.
 * - { type: 'request-unmute', identity } — the professor asks `identity` to turn the mic
 *   ON. The target only records a pending request; it never enables the track on its own.
 */

type ModerationMessage = MuteAudioMessage | UnmuteRequestMessage;

export interface ModerationApi {
  /** Professor action: ask `identity` to mute their microphone. */
  muteParticipant: (identity: string) => void;
  /** Increments each time the professor mutes THIS participant (drives a toast). */
  mutedByProfessorCount: number;
  /** Professor action: ask `identity` to turn their microphone on (the student must accept). */
  requestUnmute: (identity: string) => void;
  /** True while THIS participant has an unanswered "turn your mic on" request from the professor. */
  unmuteRequestPending: boolean;
  /** Student accepted the request: enable the local audio track and clear the request. */
  acceptUnmuteRequest: () => void;
  /** Student declined / closed the prompt: clear the request without touching the mic. */
  dismissUnmuteRequest: () => void;
}

export default function useModeration(): ModerationApi {
  const { room } = useVideoContext();
  const [mutedByProfessorCount, setMutedByProfessorCount] = useState(0);
  const [unmuteRequestPending, setUnmuteRequestPending] = useState(false);

  const { send } = useClassDataChannel<ModerationMessage>({
    onMessage: (message, participant) => {
      const localParticipant = room?.localParticipant;
      if (!localParticipant) return;
      if (message.type === 'mute-audio' && isFromTeacher(participant) && isAddressedToMe(message, room)) {
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
      if (message.type === 'request-unmute' && isFromTeacher(participant) && isAddressedToMe(message, room)) {
        // NEVER enable the track here: only prompt, and only when the mic is actually off.
        let micIsOff = false;
        localParticipant.audioTracks.forEach((publication: any) => {
          if (publication.track && !publication.track.isEnabled) micIsOff = true;
        });
        if (micIsOff) setUnmuteRequestPending(true);
      }
    },
  });

  const muteParticipant = useCallback(
    (identity: string) => {
      send({ type: 'mute-audio', identity });
    },
    [send]
  );

  const requestUnmute = useCallback(
    (identity: string) => {
      send({ type: 'request-unmute', identity });
    },
    [send]
  );

  const acceptUnmuteRequest = useCallback(() => {
    room?.localParticipant?.audioTracks.forEach((publication: any) => {
      if (publication.track && !publication.track.isEnabled) publication.track.enable();
    });
    setUnmuteRequestPending(false);
  }, [room]);

  const dismissUnmuteRequest = useCallback(() => setUnmuteRequestPending(false), []);

  return {
    muteParticipant,
    mutedByProfessorCount,
    requestUnmute,
    unmuteRequestPending,
    acceptUnmuteRequest,
    dismissUnmuteRequest,
  };
}
