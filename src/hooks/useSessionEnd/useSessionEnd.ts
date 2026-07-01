import { useCallback, useRef, useState } from 'react';
import useVideoContext from '../useVideoContext/useVideoContext';
import useClassDataChannel from '../useClassDataChannel/useClassDataChannel';
import { useAppState } from '../../state';
import { getPasscode } from '../../state/usePasscodeAuth/usePasscodeAuth';
import { clearRejoinSession } from '../../components/PreJoinScreens/rejoinSession';

/**
 * "End the session for everyone" signaling for the classroom flow.
 *
 * Twilio's Room is the source of truth and a client cannot force another client out,
 * so a real "end for everyone" needs the server to complete the room (see the
 * /completeRoom endpoint). This hook drives the client half:
 *
 * - Professor: `endSessionForAll()` broadcasts a `session-ended` message over the
 *   shared class DataTrack (so students get a graceful "ended" screen immediately,
 *   before the room-completion disconnect reaches them), then POSTs /completeRoom to
 *   actually complete the room, then leaves.
 * - Everyone: on receiving `session-ended`, drop the saved rejoin session (so a
 *   refresh does NOT auto-rejoin), flag the app so App renders the ended screen, and
 *   disconnect.
 *
 * Why the flag lives in AppState: Room unmounts on disconnect, so a local state here
 * would be lost. The flag is read by App to keep the ended screen up after the room
 * is gone (instead of bouncing back to the prejoin lobby).
 *
 * Call this ONCE per room (in Room.tsx), like useRaiseHand — useClassDataChannel
 * publishes one LocalDataTrack per mount, so a second caller would double-publish.
 */

interface SessionEndedMessage {
  type: 'session-ended';
}

export interface SessionEndApi {
  /** Teacher action: broadcast the end, complete the room server-side, then leave. */
  endSessionForAll: () => Promise<void>;
  /** True while the /completeRoom request is in flight. */
  isEnding: boolean;
}

export default function useSessionEnd(): SessionEndApi {
  const { room } = useVideoContext();
  const { setSessionEndedByProfessor } = useAppState();
  const [isEnding, setIsEnding] = useState(false);
  const sendRef = useRef<(message: SessionEndedMessage) => void>(() => undefined);

  const leaveAsEnded = useCallback(() => {
    clearRejoinSession();
    setSessionEndedByProfessor(true);
    room?.disconnect();
  }, [room, setSessionEndedByProfessor]);

  const { send } = useClassDataChannel<SessionEndedMessage>({
    onMessage: message => {
      if (message.type === 'session-ended') {
        leaveAsEnded();
      }
    },
  });
  sendRef.current = send;

  const endSessionForAll = useCallback(async () => {
    const identity = room?.localParticipant?.identity;
    const roomName = room?.name;
    setIsEnding(true);
    // Announce first so students see the ended screen even before completion disconnects them.
    sendRef.current({ type: 'session-ended' });
    try {
      if (roomName && identity) {
        const endpoint = process.env.REACT_APP_COMPLETE_ROOM_ENDPOINT || '/completeRoom';
        // Include the passcode when present so the request passes the serverless
        // auth-handler on the deployed (passcode) path, mirroring token/recordingrules.
        // Harmless locally where the Express server does not enforce it.
        const passcode = getPasscode();
        const body: Record<string, unknown> = { room_name: roomName, user_identity: identity };
        if (passcode) body.passcode = passcode;
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
    } catch {
      // Even if completion fails (offline, transient), we still leave and show the
      // ended screen locally — the broadcast already told the connected students.
    } finally {
      setIsEnding(false);
      leaveAsEnded();
    }
  }, [room, leaveAsEnded]);

  return { endSessionForAll, isEnding };
}
