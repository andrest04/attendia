import { useEffect, useMemo, useRef, useState } from 'react';
import useVideoContext from '../useVideoContext/useVideoContext';
import useClassDataChannel from '../useClassDataChannel/useClassDataChannel';
import useLatest from '../useLatest/useLatest';
import {
  AttentionBackfillMessage,
  AttentionBackfillSample,
  AttentionTelemetryMessage,
  isFromTeacher,
} from '../useClassDataChannel/classProtocol';
import { appendBackfillSample, chunkBackfill, isBackfillMessage } from './attentionBackfill';
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
 * Pending heartbeat ("camera on, no reading yet"):
 * - While the camera is on but capture is not producing samples (MediaPipe still loading, or it
 *   failed to load), the hook beats { index 0, faces 0, cameraOff false, pending true } at the
 *   same cadence, so the professor sees "Analizando…" instead of nothing (which used to read as
 *   "Cámara apagada"). `pending` is an ADDITIVE optional wire field: older receivers ignore it
 *   (they see a no-face sample), and messages from older senders (no field) parse as not pending.
 *   Real samples never carry it, so their bytes are unchanged.
 *
 * Staleness TTL:
 * - Any remote entry not refreshed within STALE_TTL_MS is swept out. A camera-off
 *   student keeps heartbeating so it survives; a silently-crashed/disconnected
 *   student stops all sends and expires. This is the general fix for frozen values.
 *
 * DataTracks do NOT replay messages sent before a peer subscribed; the ~1 Hz
 * cadence means any late joiner will receive fresh data within 1 second.
 *
 * Backfill (no teacher in the room):
 * - While the capture measures and NO teacher participant is connected, a student keeps a bounded
 *   local buffer of {t, index} (one sample per 10 s, 3 h cap). When a teacher (re)connects the
 *   buffer is sent over the RELIABLE channel as chunked additive `attention-backfill` messages
 *   (resent at +3 s and +10 s because the teacher may subscribe to our track late; the receiver
 *   merge is idempotent), then cleared. The reliable track is only published while there is
 *   something buffered. Teachers never buffer; the receiver (a teacher) trusts the sending
 *   participant, never the payload identity. Fully inert when `enabled` is false.
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

// When the buffered readings are (re)sent after a teacher connects: now, and twice more so a
// late subscription of the teacher to our reliable track cannot lose them. The last one clears.
const BACKFILL_SEND_DELAYS_MS = [0, 3000, 10000];

const hasTeacher = (room: { participants?: Map<string, { identity: string }> } | null | undefined): boolean => {
  let found = false;
  room?.participants?.forEach(p => {
    if (isFromTeacher(p)) found = true;
  });
  return found;
};

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
  /** True when the camera is on but the sender's analysis has no reading yet (loading/failed). */
  pending: boolean;
}

/** Internal entry: RemoteAttention plus the receive timestamp used for TTL expiry. */
interface StoredRemoteAttention extends RemoteAttention {
  /** Date.now() of the last refresh; stripped before exposing to consumers. */
  receivedAt: number;
}

/**
 * The telemetry message as it travels on the wire: the shared protocol shape plus the additive,
 * optional `pending` flag (only present on the "no reading yet" heartbeat).
 */
export type AttentionTelemetryWireMessage = AttentionTelemetryMessage & { pending?: boolean };

function isAttentionTelemetryMessage(
  value: unknown
): value is Omit<AttentionTelemetryMessage, 'cameraOff' | 'unsupported'> & {
  cameraOff?: boolean;
  unsupported?: boolean;
  pending?: boolean;
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

/**
 * What the local device is telling the room about itself:
 * - `measuring`: the capture loop produces real samples (broadcast by the capture effect);
 * - `camera-off`: no capture loop — heartbeat an explicit camera-off beat;
 * - `unsupported`: the device cannot run the pipeline (mobile) — heartbeat "unsupported".
 * The two flags the provider passes can never both be true; if they were, `unsupported` wins.
 */
type LocalAttentionStatus = 'measuring' | 'camera-off' | 'unsupported';

const localStatus = (cameraOff: boolean, unsupported: boolean): LocalAttentionStatus =>
  unsupported ? 'unsupported' : cameraOff ? 'camera-off' : 'measuring';

/** A real sample from the capture loop. */
const measuredMessage = (result: AttentionCaptureResult): AttentionTelemetryMessage => ({
  type: 'attention-telemetry',
  index: result.index,
  multiface: result.multiface,
  faces: result.faces,
  cameraOff: false,
  unsupported: false,
});

/** A heartbeat with no measurement behind it: it only says WHY there is none. */
const beaconMessage = (status: 'camera-off' | 'unsupported' | 'pending'): AttentionTelemetryWireMessage => ({
  type: 'attention-telemetry',
  index: 0,
  multiface: false,
  faces: 0,
  cameraOff: status === 'camera-off',
  unsupported: status === 'unsupported',
  // Only the pending beat carries the field, so camera-off/unsupported beats stay byte-identical.
  ...(status === 'pending' ? { pending: true } : {}),
});

/** Sends `message` immediately and then every `intervalMs` while `active`. */
function useHeartbeat(
  active: boolean,
  message: AttentionTelemetryWireMessage,
  send: (m: AttentionTelemetryWireMessage) => void,
  intervalMs: number
) {
  const messageRef = useLatest(message);
  useEffect(() => {
    if (!active) return;
    const beat = () => send(messageRef.current);
    beat();
    const id = window.setInterval(beat, intervalMs);
    return () => window.clearInterval(id);
  }, [active, send, intervalMs, messageRef]);
}

/**
 * @param enabled When false the hook is fully inert — no data track is published, nothing is
 *   received and no sweep runs. The provider passes false while the CV pipeline is off (the
 *   default), so a deployment that never turned the feature on pays nothing for it.
 */
export default function useAttentionTelemetry(
  localResult?: AttentionCaptureResult,
  cameraOff: boolean = false,
  unsupported: boolean = false,
  enabled: boolean = true,
  onBackfill?: (identity: string, samples: unknown) => void
): RemoteAttention[] {
  const { room } = useVideoContext();
  const [remoteAttention, setRemoteAttention] = useState<Map<string, StoredRemoteAttention>>(new Map());
  const status = localStatus(cameraOff, unsupported);
  const onBackfillRef = useLatest(onBackfill);
  const localIdentity = room?.localParticipant?.identity;
  const isLocalTeacher = isFromTeacher({ identity: localIdentity });

  // Backfill state: who counts as a teacher in the room right now, and the student's own buffer.
  const teacherIds = useRef<Set<string>>(new Set());
  const [teacherPresent, setTeacherPresent] = useState(() => hasTeacher(room));
  const bufferRef = useRef<AttentionBackfillSample[]>([]);
  const [hasBuffer, setHasBuffer] = useState(false);

  // Unreliable + unordered track: this is "latest value wins" telemetry, not a
  // delivery-guaranteed event. See the header comment for why reliable delivery
  // collapses the group index to 0 under congestion.
  const { send } = useClassDataChannel<AttentionTelemetryWireMessage | AttentionBackfillMessage>({
    enabled,
    trackOptions: { ordered: false, maxRetransmits: 0 },
    onMessage: (parsed, participant) => {
      if (isBackfillMessage(parsed)) {
        // Only a teacher consumes backfill, and only from students; the sender is the Twilio
        // participant, so a payload naming someone else is simply ignored.
        if (isLocalTeacher && !isFromTeacher(participant))
          onBackfillRef.current?.(participant.identity, parsed.samples);
        return;
      }
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
        // Backward compatible: older senders omit pending → a real (or no-face) sample.
        pending: parsed.pending === true,
        receivedAt: Date.now(),
      };

      setRemoteAttention(prev => {
        const next = new Map(prev);
        next.set(identity, entry);
        return next;
      });
    },
    onParticipantConnected: participant => {
      if (isFromTeacher(participant)) {
        teacherIds.current.add(participant.identity);
        setTeacherPresent(true);
      }
    },
    onParticipantDisconnected: participant => {
      if (teacherIds.current.delete(participant.identity)) setTeacherPresent(teacherIds.current.size > 0);
      setRemoteAttention(prev => {
        const next = new Map(prev);
        next.delete(participant.identity);
        return next;
      });
    },
  });

  // Re-sync who is a teacher when the room changes (the events only cover later arrivals).
  useEffect(() => {
    const ids = new Set<string>();
    room?.participants?.forEach(p => {
      if (isFromTeacher(p)) ids.add(p.identity);
    });
    teacherIds.current = ids;
    setTeacherPresent(ids.size > 0);
  }, [room]);

  // Reliable channel for the backfill hand-over: published only while there is something buffered.
  const { send: sendReliable } = useClassDataChannel<AttentionBackfillMessage>({
    enabled: enabled && !isLocalTeacher && hasBuffer,
    onMessage: () => undefined,
  });

  // Buffer our own measured readings while no teacher is in the room.
  useEffect(() => {
    if (!enabled || isLocalTeacher || teacherPresent || status !== 'measuring') return;
    if (!localResult || localResult.capture !== 'active' || localResult.faces < 1) return;
    const next = appendBackfillSample(bufferRef.current, { t: Date.now(), index: localResult.index });
    if (next !== bufferRef.current) {
      bufferRef.current = next;
      setHasBuffer(true);
    }
  }, [enabled, isLocalTeacher, teacherPresent, status, localResult]);

  // A teacher is here: hand the buffer over (idempotent resends), then drop it.
  useEffect(() => {
    if (!enabled || isLocalTeacher || !teacherPresent || !hasBuffer || !localIdentity) return;
    const sendAll = () => chunkBackfill(localIdentity, bufferRef.current).forEach(sendReliable);
    const timers = BACKFILL_SEND_DELAYS_MS.map((delay, i) => {
      const run = () => {
        sendAll();
        if (i === BACKFILL_SEND_DELAYS_MS.length - 1) {
          bufferRef.current = [];
          setHasBuffer(false);
        }
      };
      if (delay === 0) {
        run();
        return undefined;
      }
      return window.setTimeout(run, delay);
    });
    return () => timers.forEach(id => id !== undefined && window.clearTimeout(id));
  }, [enabled, isLocalTeacher, teacherPresent, hasBuffer, localIdentity, sendReliable]);

  // Broadcast local attention whenever capture is active.
  useEffect(() => {
    if (!localResult || localResult.capture !== 'active') return;
    send(measuredMessage(localResult));
  }, [localResult, send]);

  // Camera-off heartbeat: while the local camera is off, capture is inactive and would stop
  // broadcasting entirely. Send an explicit camera-off signal immediately and then on an
  // interval so the professor sees "Cámara apagada" instead of a frozen last value, and
  // late-joining professors learn about it within 1 second.
  useHeartbeat(status === 'camera-off', beaconMessage('camera-off'), send, CAMERA_OFF_HEARTBEAT_MS);

  // Unsupported-device heartbeat: a mobile student never runs capture (the CV pipeline is
  // desktop-only), so without this it would broadcast nothing and be invisible to the professor
  // — indistinguishable from "not joined". Beat an explicit unsupported signal so the professor
  // sees "No medible (celular)" instead of silence. Mirrors the camera-off heartbeat.
  useHeartbeat(status === 'unsupported', beaconMessage('unsupported'), send, CAMERA_OFF_HEARTBEAT_MS);

  // Pending heartbeat: the camera is on but capture produces no samples — MediaPipe is still
  // loading or failed to load. Without it the student would send nothing and the professor would
  // read "Cámara apagada". Stops as soon as capture is active (real samples take over).
  const capturing = Boolean(localResult && localResult.capture === 'active');
  useHeartbeat(
    enabled && status === 'measuring' && !capturing,
    beaconMessage('pending'),
    send,
    CAMERA_OFF_HEARTBEAT_MS
  );

  // Staleness sweep: drop entries not refreshed within STALE_TTL_MS. A participant
  // that goes silent (crash, abrupt drop without a disconnect event) expires; a
  // camera-off participant keeps heartbeating, so it survives and stays flagged.
  useEffect(() => {
    if (!room || !enabled) return;
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
  }, [room, enabled]);

  // Convert the map to a stable array for consumers, stripping the internal receivedAt
  // timestamp (consumers must not see transport bookkeeping). Memoized on the map so consumers
  // only see a new array when the data actually changed.
  return useMemo(() => Array.from(remoteAttention.values()).map(({ receivedAt, ...rest }) => rest), [remoteAttention]);
}
