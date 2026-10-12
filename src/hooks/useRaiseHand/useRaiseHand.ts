import { useCallback, useEffect, useRef, useState } from 'react';
import useVideoContext from '../useVideoContext/useVideoContext';
import useClassDataChannel from '../useClassDataChannel/useClassDataChannel';
import useLatest from '../useLatest/useLatest';
import { GrantTurnMessage, isAddressedToMe, RaiseHandMessage } from '../useClassDataChannel/classProtocol';

/**
 * Classroom raise-hand / give-turn signaling over a Twilio LocalDataTrack.
 *
 * Transport rationale: a DataTrack is part of Video core, so it is always
 * available even when Conversations/chat is disabled — unlike piggy-backing on
 * the chat client. Every participant publishes one data track; students send
 * `raise-hand` messages, the professor sends `grant-turn`. There is NO server
 * involved (mirrors the rest of the SDK-as-state design). The shared DataTrack
 * scaffold lives in useClassDataChannel; this hook just supplies the protocol.
 *
 * Protocol:
 * - { type: 'raise-hand', raised } — a participant toggled their own hand.
 *   The sender's identity is taken from the Twilio participant, not the payload.
 * - { type: 'grant-turn', identity } — the professor gave `identity` the turn.
 *   The targeted student lowers their hand and surfaces a "tu turno" signal.
 *
 * DataTracks do NOT replay messages sent before a peer subscribed, so a raised
 * hand is re-announced whenever a new participant connects — this is what lets a
 * professor who refreshes (auto-rejoin) or joins late rebuild the queue.
 */

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
  const isHandRaisedRef = useLatest(isHandRaised);
  // Holds the channel's send so the message/connect handlers can re-broadcast.
  const sendRef = useRef<(message: ClassMessage) => void>(() => undefined);

  const onMessage = useCallback(
    (message: ClassMessage, participant) => {
      if (message.type === 'raise-hand' && typeof message.raised === 'boolean') {
        const { raised } = message;
        const identity = participant.identity;
        setRaisedHands(prev => {
          if (raised) {
            // Preserve FIFO position: a re-announce when someone joins must not move
            // an already-queued hand to the end and corrupt the raise order. Only a
            // genuinely new raised hand is appended.
            return prev.includes(identity) ? prev : [...prev, identity];
          }
          return prev.filter(id => id !== identity);
        });
      } else if (message.type === 'grant-turn' && isAddressedToMe(message, room)) {
        setIsHandRaised(false);
        setTurnGrantedCount(count => count + 1);
        sendRef.current({ type: 'raise-hand', raised: false });
      }
    },
    [room]
  );

  const onParticipantConnected = useCallback(() => {
    // Re-announce our raised hand to the late joiner — see the file header note.
    if (isHandRaisedRef.current) {
      sendRef.current({ type: 'raise-hand', raised: true });
    }
  }, [isHandRaisedRef]);

  const onParticipantDisconnected = useCallback(participant => {
    setRaisedHands(prev => prev.filter(id => id !== participant.identity));
  }, []);

  const { send } = useClassDataChannel<ClassMessage>({
    onMessage,
    onParticipantConnected,
    onParticipantDisconnected,
  });

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

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
