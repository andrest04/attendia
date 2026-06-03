import { useCallback, useEffect, useRef, useState } from 'react';
import { LocalDataTrack } from 'twilio-video';
import useVideoContext from '../useVideoContext/useVideoContext';

/**
 * Classroom raise-hand / give-turn signaling over a Twilio LocalDataTrack.
 *
 * Transport rationale: a DataTrack is part of Video core, so it is always
 * available even when Conversations/chat is disabled — unlike piggy-backing on
 * the chat client. Every participant publishes one data track; students send
 * `raise-hand` messages, the professor sends `grant-turn`. There is NO server
 * involved (mirrors the rest of the SDK-as-state design).
 *
 * Protocol:
 * - { type: 'raise-hand', raised } — a participant toggled their own hand.
 *   The sender's identity is taken from the Twilio participant, not the payload.
 * - { type: 'grant-turn', identity } — the professor gave `identity` the turn.
 *   The targeted student lowers their hand and surfaces a "tu turno" signal.
 */

interface RaiseHandMessage {
  type: 'raise-hand';
  raised: boolean;
}

interface GrantTurnMessage {
  type: 'grant-turn';
  identity: string;
}

type ClassMessage = RaiseHandMessage | GrantTurnMessage;

export interface RaiseHandApi {
  /** Identities of remote participants with a raised hand, in raise order (professor consumes this). */
  raisedHands: string[];
  /** The local participant's own hand state. */
  isHandRaised: boolean;
  /** Raise or lower the local hand; broadcasts the change to the room. */
  setHandRaised: (raised: boolean) => void;
  /** Professor action: give `identity` the turn and clear their hand from the queue. */
  grantTurn: (identity: string) => void;
  /** Increments each time the professor grants THIS participant the turn (drives a "tu turno" cue). */
  turnGrantedCount: number;
}

export default function useRaiseHand(): RaiseHandApi {
  const { room } = useVideoContext();
  const [raisedHands, setRaisedHands] = useState<string[]>([]);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [turnGrantedCount, setTurnGrantedCount] = useState(0);
  const dataTrackRef = useRef<LocalDataTrack | null>(null);

  const send = useCallback((message: ClassMessage) => {
    try {
      dataTrackRef.current?.send(JSON.stringify(message));
    } catch {
      // Track not yet connected/subscribed — dropping the signal is acceptable.
    }
  }, []);

  // Publish one LocalDataTrack per room connection.
  useEffect(() => {
    if (!room || !room.localParticipant) return;
    const dataTrack = new LocalDataTrack();
    dataTrackRef.current = dataTrack;
    room.localParticipant.publishTrack(dataTrack);
    return () => {
      try {
        room.localParticipant.unpublishTrack(dataTrack);
      } catch {
        // Already unpublished on disconnect.
      }
      dataTrackRef.current = null;
    };
  }, [room]);

  // Receive raise-hand / grant-turn messages from remote participants.
  useEffect(() => {
    if (!room || !room.localParticipant) return;
    const localIdentity = room.localParticipant.identity;
    const cleanups: Array<() => void> = [];

    const listen = (emitter: any, event: string, handler: (...args: any[]) => void) => {
      emitter.on(event, handler);
      cleanups.push(() => emitter.off(event, handler));
    };

    const handleMessage = (raw: unknown, identity: string) => {
      if (typeof raw !== 'string') return;
      let message: ClassMessage;
      try {
        message = JSON.parse(raw);
      } catch {
        return;
      }

      if (message.type === 'raise-hand') {
        const { raised } = message;
        setRaisedHands(prev => {
          const without = prev.filter(id => id !== identity);
          return raised ? [...without, identity] : without;
        });
      } else if (message.type === 'grant-turn' && message.identity === localIdentity) {
        setIsHandRaised(false);
        setTurnGrantedCount(count => count + 1);
        send({ type: 'raise-hand', raised: false });
      }
    };

    const attachDataTrack = (track: any, identity: string) => {
      if (track && track.kind === 'data') {
        listen(track, 'message', (data: unknown) => handleMessage(data, identity));
      }
    };

    const attachParticipant = (participant: any) => {
      listen(participant, 'trackSubscribed', (track: any) => attachDataTrack(track, participant.identity));
      participant.tracks?.forEach((publication: any) => attachDataTrack(publication.track, participant.identity));
    };

    const handleDisconnect = (participant: any) =>
      setRaisedHands(prev => prev.filter(id => id !== participant.identity));

    room.participants.forEach(attachParticipant);
    listen(room, 'participantConnected', attachParticipant);
    listen(room, 'participantDisconnected', handleDisconnect);

    return () => cleanups.forEach(off => off());
  }, [room, send]);

  const setHandRaised = useCallback(
    (raised: boolean) => {
      setIsHandRaised(raised);
      send({ type: 'raise-hand', raised });
    },
    [send]
  );

  const grantTurn = useCallback(
    (identity: string) => {
      send({ type: 'grant-turn', identity });
      setRaisedHands(prev => prev.filter(id => id !== identity));
    },
    [send]
  );

  return { raisedHands, isHandRaised, setHandRaised, grantTurn, turnGrantedCount };
}
