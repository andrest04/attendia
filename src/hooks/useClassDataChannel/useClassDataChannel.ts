import { useCallback, useEffect, useRef } from 'react';
import { LocalDataTrack, LocalDataTrackOptions, RemoteParticipant } from 'twilio-video';
import useVideoContext from '../useVideoContext/useVideoContext';

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
 */

export interface ClassDataChannelOptions<T> {
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
  trackOptions,
  onMessage,
  onParticipantConnected,
  onParticipantDisconnected,
}: ClassDataChannelOptions<T>): ClassDataChannelApi<T> {
  const { room } = useVideoContext();
  const dataTrackRef = useRef<LocalDataTrack | null>(null);

  // Callbacks and options are held in refs so the publish/receive effects depend
  // only on [room]. Depending on the callbacks (new identities every render) would
  // republish the track and re-subscribe every listener on each render. The refs
  // always hold the latest closure, so event handlers see fresh state.
  const onMessageRef = useRef(onMessage);
  const onParticipantConnectedRef = useRef(onParticipantConnected);
  const onParticipantDisconnectedRef = useRef(onParticipantDisconnected);
  const trackOptionsRef = useRef(trackOptions);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onParticipantConnectedRef.current = onParticipantConnected;
    onParticipantDisconnectedRef.current = onParticipantDisconnected;
    trackOptionsRef.current = trackOptions;
  });

  const send = useCallback((payload: T) => {
    try {
      dataTrackRef.current?.send(JSON.stringify(payload));
    } catch {
      // Track not yet connected/subscribed — dropping the signal is acceptable.
    }
  }, []);

  // Publish one LocalDataTrack per room connection. Unpublish is chained onto the
  // publish promise so a fast unmount/remount never unpublishes a track Twilio is
  // still in the middle of publishing (which would leave a dangling publication).
  useEffect(() => {
    if (!room || !room.localParticipant) return () => {};
    const localParticipant = room.localParticipant;
    const options = trackOptionsRef.current;
    const dataTrack = options ? new LocalDataTrack(options) : new LocalDataTrack();
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

  // Receive loop: decode every remote message and dispatch it to onMessage.
  useEffect(() => {
    const cleanups: Array<() => void> = [];
    if (!room || !room.localParticipant) return () => cleanups.forEach(off => off());
    const attachedTracks = new Set<unknown>();
    // Per-participant bookkeeping so a disconnect can prune just that participant's
    // listeners/tracks, keeping attachedTracks and the listener set bounded across
    // a long session (not only on full effect teardown).
    const participantCleanups = new Map<any, Array<() => void>>();
    const participantTracks = new Map<any, Set<unknown>>();

    const listen = (emitter: any, event: string, handler: (...args: any[]) => void, owner?: any) => {
      emitter.on(event, handler);
      const off = () => emitter.off(event, handler);
      cleanups.push(off);
      if (owner) {
        const offs = participantCleanups.get(owner);
        if (offs) offs.push(off);
        else participantCleanups.set(owner, [off]);
      }
      return off;
    };

    const handleMessage = (raw: unknown, participant: any) => {
      if (typeof raw !== 'string') return;
      let parsed: T;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      onMessageRef.current(parsed, participant);
    };

    // Guard against double-subscribing the same track (the initial tracks loop and
    // a later trackSubscribed can reference the same object; re-subscribes give new ones).
    const attachDataTrack = (track: any, participant: any) => {
      if (track && track.kind === 'data' && !attachedTracks.has(track)) {
        attachedTracks.add(track);
        const tracks = participantTracks.get(participant);
        if (tracks) tracks.add(track);
        else participantTracks.set(participant, new Set([track]));
        listen(track, 'message', (data: unknown) => handleMessage(data, participant), participant);
      }
    };

    const attachParticipant = (participant: any) => {
      listen(participant, 'trackSubscribed', (track: any) => attachDataTrack(track, participant), participant);
      participant.tracks?.forEach((publication: any) => attachDataTrack(publication.track, participant));
    };

    const handleParticipantConnected = (participant: any) => {
      attachParticipant(participant);
      onParticipantConnectedRef.current?.(participant);
    };

    const handleParticipantDisconnected = (participant: any) => {
      onParticipantDisconnectedRef.current?.(participant);
      // Prune the participant's listeners and tracks so they don't linger until the
      // whole effect tears down.
      const offs = participantCleanups.get(participant);
      if (offs) {
        offs.forEach(off => {
          off();
          const index = cleanups.indexOf(off);
          if (index !== -1) cleanups.splice(index, 1);
        });
        participantCleanups.delete(participant);
      }
      const tracks = participantTracks.get(participant);
      if (tracks) {
        tracks.forEach(track => attachedTracks.delete(track));
        participantTracks.delete(participant);
      }
    };

    room.participants.forEach(attachParticipant);
    listen(room, 'participantConnected', handleParticipantConnected);
    listen(room, 'participantDisconnected', handleParticipantDisconnected);

    return () => cleanups.forEach(off => off());
  }, [room]);

  return { send };
}
