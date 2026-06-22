import { useCallback, useEffect, useRef, useState } from 'react';
import { LocalDataTrack } from 'twilio-video';
import useVideoContext from '../useVideoContext/useVideoContext';
import { ProctoringAlert } from '../../components/AttentionProvider/types';

/**
 * Classroom proctoring-warning signaling over a Twilio LocalDataTrack.
 *
 * Transport rationale: mirrors useRaiseHand / useModeration / useAttentionTelemetry —
 * a DataTrack is part of Video core, so it is always available even when
 * Conversations/chat is disabled. There is NO server involved (SDK-as-state, same
 * as the rest of the classroom layer).
 *
 * IMPORTANT — proctoring warning by convention, NOT a security boundary. The
 * professor cannot punish or lock a student's client; "sending a warning" is just
 * a REQUEST that the target client surfaces as a toast. A modified client could
 * ignore it. This mirrors the room-access guard and the role-is-a-suffix model: a
 * classroom UX guardrail, not enforcement.
 *
 * Protocol:
 * - { type: 'proctoring-warning', identity, kind } — the professor warns `identity`
 *   about a proctoring condition (`kind`). Only the targeted client reacts; the
 *   sender identity is the Twilio participant, never the payload.
 */

interface ProctoringWarningMessage {
  type: 'proctoring-warning';
  identity: string;
  kind: ProctoringAlert['kind'];
}

type WarningMessage = ProctoringWarningMessage;

export interface ProctoringWarningsApi {
  /** Professor action: warn `identity` about a proctoring `kind`. */
  sendWarning: (identity: string, kind: ProctoringAlert['kind']) => void;
  /** Increments each time the professor warns THIS participant (drives a toast). */
  warnedByProfessorCount: number;
  /** The kind of the most recent warning aimed at THIS participant (drives toast copy). */
  lastWarningKind: ProctoringAlert['kind'] | null;
}

export default function useProctoringWarnings(): ProctoringWarningsApi {
  const { room } = useVideoContext();
  const [warnedByProfessorCount, setWarnedByProfessorCount] = useState(0);
  const [lastWarningKind, setLastWarningKind] = useState<ProctoringAlert['kind'] | null>(null);
  const dataTrackRef = useRef<LocalDataTrack | null>(null);

  const send = useCallback((message: WarningMessage) => {
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

  // Receive proctoring-warning messages from remote participants (the professor).
  useEffect(() => {
    if (!room || !room.localParticipant) return;
    const localIdentity = room.localParticipant.identity;
    const cleanups: Array<() => void> = [];
    const attachedTracks = new Set<unknown>();

    const listen = (emitter: any, event: string, handler: (...args: any[]) => void) => {
      emitter.on(event, handler);
      cleanups.push(() => emitter.off(event, handler));
    };

    const handleMessage = (raw: unknown) => {
      if (typeof raw !== 'string') return;
      let message: WarningMessage;
      try {
        message = JSON.parse(raw);
      } catch {
        return;
      }

      if (
        message.type === 'proctoring-warning' &&
        typeof message.identity === 'string' &&
        typeof message.kind === 'string' &&
        message.identity === localIdentity
      ) {
        setLastWarningKind(message.kind);
        setWarnedByProfessorCount(count => count + 1);
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

  const sendWarning = useCallback(
    (identity: string, kind: ProctoringAlert['kind']) => {
      send({ type: 'proctoring-warning', identity, kind });
    },
    [send]
  );

  return { sendWarning, warnedByProfessorCount, lastWarningKind };
}
