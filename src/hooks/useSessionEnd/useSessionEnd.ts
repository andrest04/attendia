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
import { ClientApiError, createApiClient } from '../../state/useFirebaseAuth/apiClient';
import { t } from '../../i18n/translate';

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
  /**
   * True once the server confirmed the local teacher is a co-teacher (not the room's owner).
   * A co-teacher can only leave: no `session-ended` broadcast, no /completeRoom and no attention
   * report (the server refuses all of them for a non-owner). Defaults to false: an unknown owner
   * status behaves as the owner.
   */
  isCoTeacher?: boolean;
}

export interface SessionEndApi {
  /** Teacher action: broadcast the end, complete the room server-side, then leave. */
  endSessionForAll: () => Promise<void>;
  /** Teacher action: leave alone, keeping the class open for the students. */
  leaveWithoutEnding: () => void;
  /** True while the /completeRoom request is in flight. */
  isEnding: boolean;
  /** True for a confirmed co-teacher: owner-only controls must be hidden. */
  isCoTeacher: boolean;
}

export default function useSessionEnd(options: SessionEndOptions = {}): SessionEndApi {
  const { room } = useVideoContext();
  const { user, setSessionEndedByProfessor } = useAppState();
  const { enqueueSnackbar } = useSnackbar();
  const [isEnding, setIsEnding] = useState(false);
  const sendRef = useRef<(message: SessionEndedMessage) => void>(() => undefined);
  const isCoTeacher = options.isCoTeacher ?? false;
  const onProfessorEndRef = useLatest(isCoTeacher ? undefined : options.onProfessorEnd);

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

  // "Salir sin cerrar": the professor leaves alone and the class stays open, so no
  // broadcast, no /completeRoom, and no session-ended screen. The report snapshot is
  // fire-and-forget — the synchronous part of saveReport captures the data before
  // disconnect() runs, and the in-flight POST survives it (the SPA never unloads).
  // A co-teacher has no report callback (see onProfessorEndRef), so this is a plain leave.
  const leaveWithoutEnding = useCallback(() => {
    void onProfessorEndRef.current?.('left');
    leaveClass(room);
  }, [room, onProfessorEndRef]);

  const endSessionForAll = useCallback(async () => {
    // Defense in depth: the UI hides this for a co-teacher and the server would refuse it anyway.
    if (isCoTeacher) {
      leaveWithoutEnding();
      return;
    }
    const identity = room?.localParticipant?.identity;
    const roomName = room?.name;
    setIsEnding(true);
    let notOwner = false;
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
      // Announce before leaving; a room completion that beats it still reaches the students
      // as RoomCompletedError, which they treat as the same ended state.
      sendRef.current({ type: 'session-ended' });
    } catch (error) {
      // A co-teacher cannot close the class: the server refuses (403). Nothing was announced,
      // so the students stay; this teacher just leaves.
      if (error instanceof ClientApiError && error.status === 403) {
        notOwner = true;
        enqueueSnackbar(
          t(
            'Solo el docente a cargo de la clase puede cerrarla para todos. Saliste de la sala y la clase sigue abierta.'
          ),
          { variant: 'info' }
        );
        return;
      }
      // Announce anyway: the room is probably still open and the students must be told.
      sendRef.current({ type: 'session-ended' });
      // Even if completion fails (offline, transient), we still leave and show the
      // ended screen locally — the broadcast tells the connected students. The
      // professor must know the room may still be open, so surface it.
      enqueueSnackbar(t('No se pudo cerrar la sala en el servidor. Los estudiantes podrían seguir conectados.'), {
        variant: 'warning',
      });
    } finally {
      setIsEnding(false);
      if (notOwner) leaveClass(room);
      else leaveAsEnded();
    }
  }, [room, user, leaveAsEnded, onProfessorEndRef, enqueueSnackbar, isCoTeacher, leaveWithoutEnding]);

  return { endSessionForAll, leaveWithoutEnding, isEnding, isCoTeacher };
}
