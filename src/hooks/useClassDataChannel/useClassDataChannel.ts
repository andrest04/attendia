import { useCallback, useEffect, useRef } from 'react';
import { LocalDataTrackOptions, RemoteParticipant } from 'twilio-video';
import useVideoContext from '../useVideoContext/useVideoContext';
import useLatest from '../useLatest/useLatest';
import { ClassChannel, joinClassChannel } from './classChannelBus';

/**
 * Generic classroom data-channel transport over a Twilio LocalDataTrack.
 *
 * The classroom layer has several client-to-client control planes (raise-hand,
 * attention telemetry, moderation, proctoring warnings). They all share the exact
 * same DataTrack scaffold — publish one track per room connection, expose a `send`
 * that JSON-encodes a payload, and run a receive loop that decodes every remote
 * message and dispatches it. This hook owns that scaffold ONCE; each consumer just
 * supplies an `onMessage` handler and filters by its own message `type`.
 *
 * Transport rationale (shared by every consumer): a DataTrack is part of Video
 * core, so it is always available even when Conversations/chat is disabled, and
 * there is NO server involved (SDK-as-state, like the rest of the app).
 *
 * Reliability is a per-consumer choice via `trackOptions`:
 * - Default (omit) → a reliable, ordered track for discrete events that must
 *   arrive (raise-hand, moderation, proctoring warnings).
 * - `{ ordered: false, maxRetransmits: 0 }` → an unreliable, unordered track for
 *   "latest value wins" telemetry (attention). Do NOT make this the default: a
 *   reliable track head-of-line-blocks under congestion and collapses attention
 *   telemetry to 0 (documented low-bandwidth bug).
 *
 * DataTracks do NOT replay messages sent before a peer subscribed, so consumers
 * that need late-join recovery re-announce their state from `onParticipantConnected`.
 *
 * The transport itself — the published track(s) and the receive loop — is shared by every
 * consumer in the same room (see classChannelBus.ts); this hook is each consumer's handle
 * on it. The wire messages are declared in classProtocol.ts.
 */

export interface ClassDataChannelOptions<T> {
  /**
   * Whether to take part in the channel at all. While `false` nothing is published and
   * nothing is listened to — used by consumers whose feature is switched off, so that an
   * idle feature does not cost every participant a data track. Defaults to `true`.
   */
  enabled?: boolean;
  /**
   * Options for the published LocalDataTrack. Omit for a reliable/ordered track;
   * pass `{ ordered: false, maxRetransmits: 0 }` for unreliable telemetry.
   */
  trackOptions?: LocalDataTrackOptions;
  /**
   * Called for every decoded remote message with the sending participant. The
   * sender identity must be taken from `participant.identity`, never the payload.
   * The consumer is responsible for filtering by the message `type` discriminator.
   */
  onMessage: (message: T, participant: RemoteParticipant) => void;
  /** Called after a newly joined participant's data tracks have been attached. */
  onParticipantConnected?: (participant: RemoteParticipant) => void;
  /** Called when a participant disconnects (for per-participant state cleanup). */
  onParticipantDisconnected?: (participant: RemoteParticipant) => void;
}

export interface ClassDataChannelApi<T> {
  /** Broadcast a payload to the room (JSON-encoded). No-op if the track is not ready. */
  send: (payload: T) => void;
}

export default function useClassDataChannel<T>({
  enabled = true,
  trackOptions,
  onMessage,
  onParticipantConnected,
  onParticipantDisconnected,
}: ClassDataChannelOptions<T>): ClassDataChannelApi<T> {
  const { room } = useVideoContext();
  const channelRef = useRef<ClassChannel | null>(null);

  // Callbacks and options are read through refs so the join/leave effect depends only on
  // [room]. Depending on the callbacks (new identities every render) would leave and rejoin
  // the channel on each render. The refs always hold the latest closure, so event handlers
  // see fresh state.
  const latest = useLatest({ onMessage, onParticipantConnected, onParticipantDisconnected });
  const trackOptionsRef = useLatest(trackOptions);

  const send = useCallback((payload: T) => {
    channelRef.current?.send(payload);
  }, []);

  // Join the room's shared class channel (see classChannelBus.ts): the transport — the
  // published DataTrack(s) and the receive loop — is owned once per room, not once per hook.
  useEffect(() => {
    if (!enabled || !room || !room.localParticipant) return;
    const channel = joinClassChannel(room, trackOptionsRef.current, {
      onMessage: (message, participant) => latest.current.onMessage(message, participant),
      onParticipantConnected: participant => latest.current.onParticipantConnected?.(participant),
      onParticipantDisconnected: participant => latest.current.onParticipantDisconnected?.(participant),
    });
    channelRef.current = channel;
    return () => {
      channel.leave();
      channelRef.current = null;
    };
  }, [room, enabled, latest, trackOptionsRef]);

  return { send };
}
