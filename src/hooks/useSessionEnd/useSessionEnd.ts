import { useCallback, useEffect, useRef, useState } from 'react';
import useVideoContext from '../useVideoContext/useVideoContext';
import useClassDataChannel from '../useClassDataChannel/useClassDataChannel';
import useLatest from '../useLatest/useLatest';
import { useSnackbar } from 'notistack';
import { RemoteParticipant } from 'twilio-video';
import { isFromTeacher, SessionEndedMessage } from '../useClassDataChannel/classProtocol';
import { useAppState } from '../../state';
import { leaveClass } from '../../components/PreJoinScreens/leaveClass';
import { ReportEndReason } from '../../components/AttentionProvider/reportTypes';
import { createApiClient } from '../../state/useFirebaseAuth/apiClient';

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
  const { user, setSessionEndedByProfessor } = useAppState();
  const { enqueueSnackbar } = useSnackbar();
  const [isEnding, setIsEnding] = useState(false);
  const sendRef = useRef<(message: SessionEndedMessage) => void>(() => undefined);
  const onProfessorEndRef = useLatest(options.onProfessorEnd);

  const leaveAsEnded = useCallback(() => {
    setSessionEndedByProfessor(true);
    leaveClass(room);
  }, [room, setSessionEndedByProfessor]);

  const onMessage = useCallback(
    (message: SessionEndedMessage, participant: RemoteParticipant) => {
      // Only the teacher can end the class; a student's message is ignored.
      if (message.type === 'session-ended' && isFromTeacher(participant)) {
        leaveAsEnded();
      }
    },
    [leaveAsEnded]
  );

  const { send } = useClassDataChannel<SessionEndedMessage>({ onMessage });

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

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
      if (roomName && identity && user) {
        const endpoint = process.env.REACT_APP_COMPLETE_ROOM_ENDPOINT || '/completeRoom';
        const body: Record<string, unknown> = { room_name: roomName, user_identity: identity };
        // The endpoint sits behind the Firebase auth middleware, so the request must carry
        // the teacher's ID token — without it the server answers 401 and the room is never
        // completed for the other participants.
        await createApiClient(user).send(endpoint, { method: 'POST', json: body });
      }
    } catch {
      // Even if completion fails (offline, transient), we still leave and show the
      // ended screen locally — the broadcast already told the connected students. The
      // professor must know the room may still be open, so surface it.
      enqueueSnackbar('No se pudo cerrar la sala en el servidor. Los estudiantes podrían seguir conectados.', {
        variant: 'warning',
      });
    } finally {
      setIsEnding(false);
      leaveAsEnded();
    }
  }, [room, user, leaveAsEnded, onProfessorEndRef, enqueueSnackbar]);

  // "Salir sin cerrar": the professor leaves alone and the class stays open, so no
  // broadcast, no /completeRoom, and no session-ended screen. The report snapshot is
  // fire-and-forget — the synchronous part of saveReport captures the data before
  // disconnect() runs, and the in-flight POST survives it (the SPA never unloads).
  const leaveWithoutEnding = useCallback(() => {
    void onProfessorEndRef.current?.('left');
    leaveClass(room);
  }, [room, onProfessorEndRef]);

  return { endSessionForAll, leaveWithoutEnding, isEnding };
}
