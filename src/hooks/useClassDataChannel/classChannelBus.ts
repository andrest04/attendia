import { LocalDataTrack, LocalDataTrackOptions, RemoteParticipant, Room } from 'twilio-video';

/**
 * Mediator for the classroom data channel of ONE room.
 *
 * Several hooks (raise-hand, moderation, proctoring warnings, session end, attention
 * telemetry) speak over the same room. When each of them owned a channel, every participant
 * published five DataTracks and every inbound message was JSON-parsed and filtered five
 * times. The bus owns the transport once per room instead:
 *
 * - one published LocalDataTrack per distinct set of track options (so all reliable
 *   consumers share a single reliable track, and the unreliable telemetry keeps its own —
 *   reliability must not be merged: a reliable track head-of-line-blocks under congestion
 *   and collapses telemetry);
 * - one receive loop that parses each message once and fans it out to every listener.
 *
 * Wire-compatible by construction: receivers already listen to ALL data tracks and filter by
 * message `type`, so how many tracks a sender publishes is invisible to them.
 *
 * Reference counted: the first `join` for a room creates the bus and attaches the listeners;
 * the last `leave` removes them and unpublishes the tracks.
 */
export interface ClassChannelListener {
  onMessage(message: any, participant: RemoteParticipant): void;
  onParticipantConnected?(participant: RemoteParticipant): void;
  onParticipantDisconnected?(participant: RemoteParticipant): void;
}

export interface ClassChannel {
  /** Broadcast a payload (JSON-encoded). No-op once left or if the track is not ready. */
  send(payload: unknown): void;
  /** Stop receiving and release this channel's share of the track and the receive loop. */
  leave(): void;
}

interface TrackEntry {
  track: LocalDataTrack;
  published: Promise<unknown>;
  refs: number;
}

const buses = new WeakMap<Room, ClassChannelBus>();

class ClassChannelBus {
  private readonly listeners = new Set<ClassChannelListener>();
  private readonly tracks = new Map<string, TrackEntry>();
  private readonly detachReceiveLoop: () => void;

  constructor(private readonly room: Room) {
    this.detachReceiveLoop = this.attachReceiveLoop();
  }

  join(trackOptions: LocalDataTrackOptions | undefined, listener: ClassChannelListener): ClassChannel {
    const key = JSON.stringify(trackOptions ?? null);
    let entry = this.tracks.get(key);
    if (!entry) {
      entry = this.publish(trackOptions);
      this.tracks.set(key, entry);
    }
    entry.refs++;
    this.listeners.add(listener);

    const joined = entry;
    let active = true;
    return {
      send: payload => {
        if (!active) return;
        try {
          joined.track.send(JSON.stringify(payload));
        } catch {
          // Track not yet connected/subscribed — dropping the signal is acceptable.
        }
      },
      leave: () => {
        if (!active) return;
        active = false;
        this.leave(key, listener);
      },
    };
  }

  // Publish one LocalDataTrack per distinct options. Unpublish is chained onto the publish
  // promise so a fast unmount/remount never unpublishes a track Twilio is still in the middle
  // of publishing (which would leave a dangling publication).
  private publish(trackOptions: LocalDataTrackOptions | undefined): TrackEntry {
    const track = trackOptions ? new LocalDataTrack(trackOptions) : new LocalDataTrack();
    const published = Promise.resolve(this.room.localParticipant.publishTrack(track)).catch(() => undefined);
    return { track, published, refs: 0 };
  }

  private leave(key: string, listener: ClassChannelListener) {
    this.listeners.delete(listener);

    const entry = this.tracks.get(key);
    if (entry && --entry.refs === 0) {
      this.tracks.delete(key);
      const localParticipant = this.room.localParticipant;
      entry.published.then(() => {
        try {
          localParticipant.unpublishTrack(entry.track);
        } catch {
          // Already unpublished on disconnect.
        }
      });
    }

    if (this.listeners.size === 0) {
      this.detachReceiveLoop();
      if (buses.get(this.room) === this) buses.delete(this.room);
    }
  }

  // One listener per listener-callback kind; a failing listener must not starve the others.
  private dispatch(call: (listener: ClassChannelListener) => void) {
    Array.from(this.listeners).forEach(listener => {
      try {
        call(listener);
      } catch (error) {
        console.error('class channel listener failed', error);
      }
    });
  }

  private attachReceiveLoop(): () => void {
    const room = this.room;
    const cleanups: Array<() => void> = [];
    const attachedTracks = new Set<unknown>();
    // Per-participant bookkeeping so a disconnect can prune just that participant's
    // listeners/tracks, keeping attachedTracks and the listener set bounded across
    // a long session (not only on full teardown).
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
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      this.dispatch(listener => listener.onMessage(parsed, participant));
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
      this.dispatch(listener => listener.onParticipantConnected?.(participant));
    };

    const handleParticipantDisconnected = (participant: any) => {
      this.dispatch(listener => listener.onParticipantDisconnected?.(participant));
      // Prune the participant's listeners and tracks so they don't linger until the
      // whole loop tears down.
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
  }
}

/** Joins the room's class channel, creating the shared bus on first use. */
export function joinClassChannel(
  room: Room,
  trackOptions: LocalDataTrackOptions | undefined,
  listener: ClassChannelListener
): ClassChannel {
  let bus = buses.get(room);
  if (!bus) {
    bus = new ClassChannelBus(room);
    buses.set(room, bus);
  }
  return bus.join(trackOptions, listener);
}
