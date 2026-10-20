import { useCallback, useState } from 'react';
import useVideoContext from '../useVideoContext/useVideoContext';
import useClassDataChannel from '../useClassDataChannel/useClassDataChannel';
import { isAddressedToMe, isFromTeacher, ProctoringWarningMessage } from '../useClassDataChannel/classProtocol';
import { ProctoringAlert } from '../../components/AttentionProvider/types';

/**
 * Classroom proctoring-warning signaling over a Twilio LocalDataTrack.
 *
 * Transport rationale: mirrors useRaiseHand / useModeration / useAttentionTelemetry —
 * a DataTrack is part of Video core, so it is always available even when
 * Conversations/chat is disabled. There is NO server involved (SDK-as-state, same
 * as the rest of the classroom layer). The shared DataTrack scaffold lives in
 * useClassDataChannel; this hook only adds the protocol.
 *
 * IMPORTANT — proctoring warning by convention, NOT a security boundary. The
 * professor cannot punish or lock a student's client; "sending a warning" is just
 * a REQUEST that the target client surfaces as a toast. A modified client could
 * ignore it. This mirrors the room-access guard and the role-is-a-suffix model: a
 * classroom UX guardrail, not enforcement.
 *
 * Protocol:
 * - { type: 'proctoring-warning', identity, kind } — the professor warns `identity`
 *   about a proctoring condition (`kind`). Only the targeted client reacts; the
 *   sender identity is the Twilio participant, never the payload.
 */

type WarningMessage = ProctoringWarningMessage;

export interface ProctoringWarningsApi {
  /** Professor action: warn `identity` about a proctoring `kind`. */
  sendWarning: (identity: string, kind: ProctoringAlert['kind']) => void;
  /** Increments each time the professor warns THIS participant (drives a toast). */
  warnedByProfessorCount: number;
  /** The kind of the most recent warning aimed at THIS participant (drives toast copy). */
  lastWarningKind: ProctoringAlert['kind'] | null;
}

export default function useProctoringWarnings(): ProctoringWarningsApi {
  const { room } = useVideoContext();
  const [warnedByProfessorCount, setWarnedByProfessorCount] = useState(0);
  const [lastWarningKind, setLastWarningKind] = useState<ProctoringAlert['kind'] | null>(null);

  const { send } = useClassDataChannel<WarningMessage>({
    onMessage: (message, participant) => {
      if (
        message.type === 'proctoring-warning' &&
        isFromTeacher(participant) &&
        typeof message.kind === 'string' &&
        isAddressedToMe(message, room)
      ) {
        setLastWarningKind(message.kind);
        setWarnedByProfessorCount(count => count + 1);
      }
    },
  });

  const sendWarning = useCallback(
    (identity: string, kind: ProctoringAlert['kind']) => {
      send({ type: 'proctoring-warning', identity, kind });
    },
    [send]
  );

  return { sendWarning, warnedByProfessorCount, lastWarningKind };
}
