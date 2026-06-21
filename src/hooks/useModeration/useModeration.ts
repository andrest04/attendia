import { useCallback, useEffect, useRef, useState } from 'react';
import { LocalDataTrack } from 'twilio-video';
import useVideoContext from '../useVideoContext/useVideoContext';

/**
 * Classroom moderation signaling over a Twilio LocalDataTrack.
 *
 * Transport rationale: mirrors useRaiseHand / useAttentionTelemetry — a DataTrack
 * is part of Video core, so it is always available even when Conversations/chat is
 * disabled. There is NO server involved (SDK-as-state, same as the rest).
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
  const dataTrackRef = useRef<LocalDataTrack | null>(null);

  const send = useCallback((message: ModerationMessage) => {
    try {
      dataTrackRef.current?.send(JSON.stringify(message));
    } catch {
      // Track not yet connected/subscribed — dropping the signal is acceptable.
    }
  }, []);

  // Publish one LocalDataTrack per room connection. Unpublish is chained onto the
  // publish promise so a fast unmount/remount never unpublishes a track Twilio is
  // still in the middle of publishing (which would leave a dangling publication).
  useEffect(() => {
    if (!room || !room.localParticipant) return;
    const localParticipant = room.localParticipant;
    const dataTrack = new LocalDataTrack();
    dataTrackRef.current = dataTrack;
    const published = Promise.resolve(localParticipant.publishTrack(dataTrack)).catch(() => undefined);
    return () => {
      published.then(() => {
        try {
          localParticipant.unpublishTrack(dataTrack);
        } catch {
          // Already unpublished on disconnect.
        }
      });
      dataTrackRef.current = null;
    };
  }, [room]);

  // Receive moderation messages from remote participants (the professor).
  useEffect(() => {
    if (!room || !room.localParticipant) return;
    const localParticipant = room.localParticipant;
    const localIdentity = localParticipant.identity;
    const cleanups: Array<() => void> = [];
    const attachedTracks = new Set<unknown>();

    const listen = (emitter: any, event: string, handler: (...args: any[]) => void) => {
      emitter.on(event, handler);
      cleanups.push(() => emitter.off(event, handler));
    };

    const muteLocalAudio = (): boolean => {
      // Honor the request by disabling our OWN audio track (soft mute — the track
      // stays published, so the student can re-enable it from their mic button).
      // Only act on tracks that are actually enabled, and report whether anything
      // changed: muting an already-muted mic is a no-op and must not notify the
      // student (there was nothing to silence).
      let didMute = false;
      localParticipant.audioTracks.forEach((publication: any) => {
        const track = publication.track;
        if (track?.isEnabled) {
          track.disable();
          didMute = true;
        }
      });
      return didMute;
    };

    const handleMessage = (raw: unknown) => {
      if (typeof raw !== 'string') return;
      let message: ModerationMessage;
      try {
        message = JSON.parse(raw);
      } catch {
        return;
      }

      if (message.type === 'mute-audio' && typeof message.identity === 'string' && message.identity === localIdentity) {
        // Bump the count (which drives the toast) only when audio was actually
        // silenced — never when the mic was already off.
        if (muteLocalAudio()) {
          setMutedByProfessorCount(count => count + 1);
        }
      }
    };

    // Guard against double-subscribing the same track (the initial tracks loop and
    // a later trackSubscribed can reference the same object; re-subscribes give new ones).
    const attachDataTrack = (track: any) => {
      if (track && track.kind === 'data' && !attachedTracks.has(track)) {
        attachedTracks.add(track);
        listen(track, 'message', (data: unknown) => handleMessage(data));
      }
    };

    const attachParticipant = (participant: any) => {
      listen(participant, 'trackSubscribed', (track: any) => attachDataTrack(track));
      participant.tracks?.forEach((publication: any) => attachDataTrack(publication.track));
    };

    room.participants.forEach(attachParticipant);
    listen(room, 'participantConnected', attachParticipant);
    // No participantDisconnected listener: this hook holds no per-participant state
    // to clean up (unlike the raise-hand queue).

    return () => cleanups.forEach(off => off());
  }, [room]);

  const muteParticipant = useCallback(
    (identity: string) => {
      send({ type: 'mute-audio', identity });
    },
    [send]
  );

  return { muteParticipant, mutedByProfessorCount };
}
