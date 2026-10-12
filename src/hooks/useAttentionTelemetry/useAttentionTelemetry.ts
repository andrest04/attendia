import { useEffect, useState } from 'react';
import useVideoContext from '../useVideoContext/useVideoContext';
import useClassDataChannel from '../useClassDataChannel/useClassDataChannel';
import { AttentionTelemetryMessage } from '../useClassDataChannel/classProtocol';
import { AttentionCaptureResult } from '../useAttentionCapture/useAttentionCapture';

/**
 * Classroom attention telemetry transport over a Twilio LocalDataTrack.
 *
 * Transport rationale: mirrors useRaiseHand — DataTracks are always available
 * within the Video SDK regardless of whether Conversations is enabled. UNLIKE
 * raise-hand (a discrete event that must arrive), attention is a 1 Hz "latest
 * value wins" telemetry stream, so the track is published UNRELIABLE and
 * UNORDERED (maxRetransmits:0, ordered:false). Under low bandwidth a reliable
 * track head-of-line-blocks: stale snapshots queue and retransmit ahead of fresh
 * ones, the backlog blows past STALE_TTL_MS, entries get swept, and the professor
 * sees the group index collapse to 0. Unreliable delivery drops the stale frame
 * and lets the next ~30-byte snapshot through — the number survives even when the
 * video tracks are switched off by Twilio's bandwidth profile.
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

export interface RemoteAttention {
  /** Maps to the Twilio participant identity string. */
  identity: string;
  /** Aggregate attention index 0-100. */
  index: number;
  /** Proctoring flag: more than one face detected. */
  multiface: boolean;
  /** Raw face count; 0 = face not detected (index is a decayed placeholder, not real). */
  faces: number;
  /** True when the participant's camera is off (no attention data). */
  cameraOff: boolean;
  /** True when the participant's device cannot run the pipeline at all (mobile). */
  unsupported: boolean;
}

/** Internal entry: RemoteAttention plus the receive timestamp used for TTL expiry. */
interface StoredRemoteAttention extends RemoteAttention {
  /** Date.now() of the last refresh; stripped before exposing to consumers. */
  receivedAt: number;
}

function isAttentionTelemetryMessage(
  value: unknown
): value is Omit<AttentionTelemetryMessage, 'cameraOff' | 'unsupported'> & {
  cameraOff?: boolean;
  unsupported?: boolean;
} {
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
  cameraOff: boolean = false,
  unsupported: boolean = false
): RemoteAttention[] {
  const { room } = useVideoContext();
  const [remoteAttention, setRemoteAttention] = useState<Map<string, StoredRemoteAttention>>(new Map());

  // Unreliable + unordered track: this is "latest value wins" telemetry, not a
  // delivery-guaranteed event. See the header comment for why reliable delivery
  // collapses the group index to 0 under congestion.
  const { send } = useClassDataChannel<AttentionTelemetryMessage>({
    trackOptions: { ordered: false, maxRetransmits: 0 },
    onMessage: (parsed, participant) => {
      if (!isAttentionTelemetryMessage(parsed)) return;
      const identity = participant.identity;
      const entry: StoredRemoteAttention = {
        identity,
        index: parsed.index,
        multiface: parsed.multiface,
        faces: parsed.faces,
        // Backward compatible: older senders omit cameraOff → treat as camera on.
        cameraOff: parsed.cameraOff === true,
        // Backward compatible: older senders omit unsupported → treat as supported.
        unsupported: parsed.unsupported === true,
        receivedAt: Date.now(),
      };

      setRemoteAttention(prev => {
        const next = new Map(prev);
        next.set(identity, entry);
        return next;
      });
    },
    onParticipantDisconnected: participant => {
      setRemoteAttention(prev => {
        const next = new Map(prev);
        next.delete(participant.identity);
        return next;
      });
    },
  });

  // Broadcast local attention whenever capture is active.
  useEffect(() => {
    if (!localResult || localResult.capture !== 'active') return;
    send({
      type: 'attention-telemetry',
      index: localResult.index,
      multiface: localResult.multiface,
      faces: localResult.faces,
      cameraOff: false,
      unsupported: false,
    });
  }, [localResult, send]);

  // Camera-off heartbeat: while the local camera is off, capture is inactive and
  // would stop broadcasting entirely. Send an explicit camera-off signal immediately
  // and then on an interval so the professor sees "Cámara apagada" instead of a
  // frozen last value, and late-joining professors learn about it within 1 second.
  useEffect(() => {
    if (!cameraOff) return;
    const beat = () =>
      send({ type: 'attention-telemetry', index: 0, multiface: false, faces: 0, cameraOff: true, unsupported: false });
    beat();
    const id = window.setInterval(beat, CAMERA_OFF_HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [cameraOff, send]);

  // Unsupported-device heartbeat: a mobile student never runs capture (the CV
  // pipeline is desktop-only), so without this it would broadcast nothing and be
  // invisible to the professor — indistinguishable from "not joined". Beat an
  // explicit unsupported signal so the professor sees "No medible (celular)"
  // instead of silence. Mirrors the camera-off heartbeat.
  useEffect(() => {
    if (!unsupported) return;
    const beat = () =>
      send({ type: 'attention-telemetry', index: 0, multiface: false, faces: 0, cameraOff: false, unsupported: true });
    beat();
    const id = window.setInterval(beat, CAMERA_OFF_HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [unsupported, send]);

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
