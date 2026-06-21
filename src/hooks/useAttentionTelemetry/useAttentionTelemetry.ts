import { useCallback, useEffect, useRef, useState } from 'react';
import { LocalDataTrack } from 'twilio-video';
import useVideoContext from '../useVideoContext/useVideoContext';
import { AttentionCaptureResult } from '../useAttentionCapture/useAttentionCapture';

/**
 * Classroom attention telemetry transport over a Twilio LocalDataTrack.
 *
 * Transport rationale: mirrors useRaiseHand — DataTracks are always available
 * within the Video SDK regardless of whether Conversations is enabled.
 *
 * Layer 3 of the CV pipeline graduation:
 * - Layer 1: pure heuristics in attentionHeuristics.ts
 * - Layer 2: useAttentionCapture — local camera analysis
 * - Layer 3 (THIS): DataTrack transport — broadcast + aggregate remote results
 * - Layer 4 (TODO): AttentionProvider swap — wire remoteAttention into existing UI
 *
 * Protocol:
 * - { type: 'attention-telemetry', index, multiface, faces, cameraOff } — a
 *   participant broadcasts their own attention snapshot at ~1 Hz (driven by the
 *   capture hook). The sender's identity is taken from the Twilio participant,
 *   never the payload. `cameraOff` is optional for backward compatibility with
 *   older senders (defaults to false when absent).
 *
 * Camera-off heartbeat:
 * - When the local camera is off there is no capture loop, so the participant
 *   would silently stop broadcasting and the professor would freeze on the last
 *   value. Instead, while cameraOff is true the hook sends a dedicated heartbeat
 *   (index 0, cameraOff true) at CAMERA_OFF_HEARTBEAT_MS so the remote entry
 *   stays fresh AND explicitly flagged as camera-off (not stale).
 *
 * Staleness TTL:
 * - Any remote entry not refreshed within STALE_TTL_MS is swept out. A camera-off
 *   student keeps heartbeating so it survives; a silently-crashed/disconnected
 *   student stops all sends and expires. This is the general fix for frozen values.
 *
 * DataTracks do NOT replay messages sent before a peer subscribed; the ~1 Hz
 * cadence means any late joiner will receive fresh data within 1 second.
 *
 * This hook is a SINGLETON — call it once in Room.tsx, not inside every tile.
 */

// Interval (ms) at which a camera-off heartbeat is re-broadcast while the local
// camera is off — keeps the remote entry fresh and explicitly camera-off.
const CAMERA_OFF_HEARTBEAT_MS = 1000;

// A remote entry not refreshed within this window is considered stale and dropped.
const STALE_TTL_MS = 5000;

// How often the staleness sweep runs.
const STALE_SWEEP_MS = 1000;

interface AttentionTelemetryMessage {
  type: 'attention-telemetry';
  index: number;
  multiface: boolean;
  faces: number;
  cameraOff: boolean;
}

export interface RemoteAttention {
  /** Maps to the Twilio participant identity string. */
  identity: string;
  /** Aggregate attention index 0-100. */
  index: number;
  /** Proctoring flag: more than one face detected. */
  multiface: boolean;
  /** Raw face count; Layer 4 derives level from index using attentionLevel(). */
  faces: number;
  /** True when the participant's camera is off (no attention data). */
  cameraOff: boolean;
}

/** Internal entry: RemoteAttention plus the receive timestamp used for TTL expiry. */
interface StoredRemoteAttention extends RemoteAttention {
  /** Date.now() of the last refresh; stripped before exposing to consumers. */
  receivedAt: number;
}

function isAttentionTelemetryMessage(
  value: unknown
): value is Omit<AttentionTelemetryMessage, 'cameraOff'> & { cameraOff?: boolean } {
  if (typeof value !== 'object' || value === null) return false;
  const msg = value as Record<string, unknown>;
  return (
    msg.type === 'attention-telemetry' &&
    typeof msg.index === 'number' &&
    typeof msg.multiface === 'boolean' &&
    typeof msg.faces === 'number'
  );
}

export default function useAttentionTelemetry(
  localResult?: AttentionCaptureResult,
  cameraOff: boolean = false
): RemoteAttention[] {
  const { room } = useVideoContext();
  const [remoteAttention, setRemoteAttention] = useState<Map<string, StoredRemoteAttention>>(new Map());
  const dataTrackRef = useRef<LocalDataTrack | null>(null);

  const send = useCallback((message: AttentionTelemetryMessage) => {
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

  // Broadcast local attention whenever capture is active.
  useEffect(() => {
    if (!localResult || localResult.capture !== 'active') return;
    send({
      type: 'attention-telemetry',
      index: localResult.index,
      multiface: localResult.multiface,
      faces: localResult.faces,
      cameraOff: false,
    });
  }, [localResult, send]);

  // Camera-off heartbeat: while the local camera is off, capture is inactive and
  // would stop broadcasting entirely. Send an explicit camera-off signal immediately
  // and then on an interval so the professor sees "Cámara apagada" instead of a
  // frozen last value, and late-joining professors learn about it within 1 second.
  useEffect(() => {
    if (!cameraOff) return;
    const beat = () => send({ type: 'attention-telemetry', index: 0, multiface: false, faces: 0, cameraOff: true });
    beat();
    const id = window.setInterval(beat, CAMERA_OFF_HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [cameraOff, send]);

  // Receive attention-telemetry messages from remote participants.
  useEffect(() => {
    if (!room || !room.localParticipant) return;
    const cleanups: Array<() => void> = [];
    const attachedTracks = new Set<unknown>();

    const listen = (emitter: any, event: string, handler: (...args: any[]) => void) => {
      emitter.on(event, handler);
      cleanups.push(() => emitter.off(event, handler));
    };

    const handleMessage = (raw: unknown, identity: string) => {
      if (typeof raw !== 'string') return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      if (!isAttentionTelemetryMessage(parsed)) return;

      const entry: StoredRemoteAttention = {
        identity,
        index: parsed.index,
        multiface: parsed.multiface,
        faces: parsed.faces,
        // Backward compatible: older senders omit cameraOff → treat as camera on.
        cameraOff: parsed.cameraOff === true,
        receivedAt: Date.now(),
      };

      setRemoteAttention(prev => {
        const next = new Map(prev);
        next.set(identity, entry);
        return next;
      });
    };

    // Guard against double-subscribing the same track (the initial tracks loop and
    // a later trackSubscribed can reference the same object; re-subscribes give new ones).
    const attachDataTrack = (track: any, identity: string) => {
      if (track && track.kind === 'data' && !attachedTracks.has(track)) {
        attachedTracks.add(track);
        listen(track, 'message', (data: unknown) => handleMessage(data, identity));
      }
    };

    const attachParticipant = (participant: any) => {
      listen(participant, 'trackSubscribed', (track: any) => attachDataTrack(track, participant.identity));
      participant.tracks?.forEach((publication: any) => attachDataTrack(publication.track, participant.identity));
    };

    const handleParticipantConnected = (participant: any) => {
      attachParticipant(participant);
    };

    const handleDisconnect = (participant: any) => {
      setRemoteAttention(prev => {
        const next = new Map(prev);
        next.delete(participant.identity);
        return next;
      });
    };

    room.participants.forEach(attachParticipant);
    listen(room, 'participantConnected', handleParticipantConnected);
    listen(room, 'participantDisconnected', handleDisconnect);

    return () => cleanups.forEach(off => off());
  }, [room]);

  // Staleness sweep: drop entries not refreshed within STALE_TTL_MS. A participant
  // that goes silent (crash, abrupt drop without a disconnect event) expires; a
  // camera-off participant keeps heartbeating, so it survives and stays flagged.
  useEffect(() => {
    if (!room) return;
    const id = window.setInterval(() => {
      const cutoff = Date.now() - STALE_TTL_MS;
      setRemoteAttention(prev => {
        let changed = false;
        const next = new Map(prev);
        next.forEach((entry, identity) => {
          if (entry.receivedAt < cutoff) {
            next.delete(identity);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, STALE_SWEEP_MS);
    return () => window.clearInterval(id);
  }, [room]);

  // Convert the map to a stable array for consumers, stripping the internal
  // receivedAt timestamp (consumers must not see transport bookkeeping).
  return Array.from(remoteAttention.values()).map(({ receivedAt, ...rest }) => rest);
}
