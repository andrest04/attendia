import { useCallback, useRef, useState } from 'react';
import useVideoContext from '../useVideoContext/useVideoContext';
import useClassDataChannel from '../useClassDataChannel/useClassDataChannel';
import { useAppState } from '../../state';
import { getPasscode } from '../../state/usePasscodeAuth/usePasscodeAuth';
import { clearRejoinSession } from '../../components/PreJoinScreens/rejoinSession';
import { ReportEndReason } from '../../components/AttentionProvider/reportTypes';

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

export interface SessionEndOptions {
  /**
   * Professor-only pre-leave hook, invoked on BOTH exit paths ('ended-for-all'
   * and 'left') BEFORE room.disconnect() so callers can snapshot state that dies
   * with the room (the attention report). NOT invoked on the student-side
   * session-ended message path. Kept in a ref (like sendRef) so a new callback
   * identity never re-wires the hook.
   */
  onProfessorEnd?: (reason: ReportEndReason) => Promise<void>;
}

export interface SessionEndApi {
  /** Teacher action: broadcast the end, complete the room server-side, then leave. */
  endSessionForAll: () => Promise<void>;
  /** Teacher action: leave alone, keeping the class open for the students. */
  leaveWithoutEnding: () => void;
  /** True while the /completeRoom request is in flight. */
  isEnding: boolean;
}

export default function useSessionEnd(options: SessionEndOptions = {}): SessionEndApi {
  const { room } = useVideoContext();
  const { setSessionEndedByProfessor } = useAppState();
  const [isEnding, setIsEnding] = useState(false);
  const sendRef = useRef<(message: SessionEndedMessage) => void>(() => undefined);
  const onProfessorEndRef = useRef<SessionEndOptions['onProfessorEnd']>(undefined);
  onProfessorEndRef.current = options.onProfessorEnd;

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
      // Snapshot before anything can tear the room down: the attention report's
      // source data is cleared by the provider the moment the room disconnects.
      // The saver never rejects, so this cannot skip the completion request.
      await onProfessorEndRef.current?.('ended-for-all');
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

  // "Salir sin cerrar": the professor leaves alone and the class stays open, so no
  // broadcast, no /completeRoom, and no session-ended screen. The report snapshot is
  // fire-and-forget — the synchronous part of saveReport captures the data before
  // disconnect() runs, and the in-flight POST survives it (the SPA never unloads).
  const leaveWithoutEnding = useCallback(() => {
    void onProfessorEndRef.current?.('left');
    clearRejoinSession();
    room?.disconnect();
  }, [room]);

  return { endSessionForAll, leaveWithoutEnding, isEnding };
}
