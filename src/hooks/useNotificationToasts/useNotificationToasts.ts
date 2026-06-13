import { useEffect, useRef } from 'react';
import { Participant } from 'twilio-video';
import { useSnackbar, VariantType } from 'notistack';
import { isTeacherIdentity } from '../../components/PreJoinScreens/classSessionTypes';

interface UseNotificationToastsArgs {
  /** Whether the local participant is the professor — drives the curated, role-aware policy. */
  isTeacher: boolean;
  /** Remote participants (from useParticipants). */
  participants: Participant[];
  /** Identities of remote participants with a raised hand, in raise order. */
  raisedHands: string[];
  /** Whether the room is currently being recorded. */
  isRecording: boolean;
  /** Increments each time the professor grants THIS participant the turn. */
  turnGrantedCount: number;
}

/** Strip the teacher identity suffix so toasts show a clean display name. */
function displayName(identity: string): string {
  return identity.replace(/\s*\[Profesor\]\s*$/i, '').trim();
}

/**
 * Fires transient toast notifications with a CURATED, role-aware policy so the
 * same raw room events surface only where they matter:
 *
 * - Student: the professor joining/leaving, "es tu turno", and recording on/off.
 *   (Classmates joining/leaving go to the panel log, not toasts; the student's own
 *   raise-hand is not toasted — it is redundant noise.)
 * - Professor: students joining/leaving and raising their hand.
 *
 * All toasts go through notistack's SnackbarProvider (maxSnack + autoHide), so a
 * busy room never buries the screen. Prev-value refs are seeded on mount so the
 * already-present room state never fires a toast on first render.
 */
export default function useNotificationToasts({
  isTeacher,
  participants,
  raisedHands,
  isRecording,
  turnGrantedCount,
}: UseNotificationToastsArgs) {
  const { enqueueSnackbar } = useSnackbar();

  const notify = (message: string, variant: VariantType = 'info') => {
    enqueueSnackbar(message, { variant });
  };

  // ── Join / leave ────────────────────────────────────────────────────────────
  const prevIds = useRef<string[]>(participants.map(p => p.sid));
  const prevIdentityById = useRef<Record<string, string>>(
    participants.reduce((acc, p) => ({ ...acc, [p.sid]: p.identity }), {})
  );

  useEffect(() => {
    const currentIds = participants.map(p => p.sid);
    const joined = participants.filter(p => !prevIds.current.includes(p.sid));
    const leftIdentities = prevIds.current
      .filter(id => !currentIds.includes(id))
      .map(id => prevIdentityById.current[id])
      .filter(Boolean);

    joined.forEach(p => {
      const teacher = isTeacherIdentity(p.identity);
      if (isTeacher && !teacher) {
        notify(`${displayName(p.identity)} se unió a la sesión`, 'info');
      } else if (!isTeacher && teacher) {
        notify('El profesor se unió a la sesión', 'info');
      }
    });

    leftIdentities.forEach(identity => {
      const teacher = isTeacherIdentity(identity);
      if (isTeacher && !teacher) {
        notify(`${displayName(identity)} salió de la sesión`, 'info');
      } else if (!isTeacher && teacher) {
        notify('El profesor salió de la sesión', 'warning');
      }
    });

    prevIds.current = currentIds;
    prevIdentityById.current = participants.reduce((acc, p) => ({ ...acc, [p.sid]: p.identity }), {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants, isTeacher]);

  // ── Raised hands (professor only) ─────────────────────────────────────────────
  const prevHands = useRef<string[]>(raisedHands);

  useEffect(() => {
    if (isTeacher) {
      const newlyRaised = raisedHands.filter(id => !prevHands.current.includes(id));
      newlyRaised.forEach(identity => notify(`${displayName(identity)} levantó la mano`, 'info'));
    }
    prevHands.current = raisedHands;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raisedHands, isTeacher]);

  // ── Recording on/off (student only) ──────────────────────────────────────────
  const prevRecording = useRef<boolean>(isRecording);

  useEffect(() => {
    if (!isTeacher && isRecording !== prevRecording.current) {
      notify(
        isRecording ? 'La sesión se está grabando' : 'Se detuvo la grabación',
        isRecording ? 'warning' : 'default'
      );
    }
    prevRecording.current = isRecording;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, isTeacher]);

  // ── Turn granted (student only) ──────────────────────────────────────────────
  const prevTurnCount = useRef<number>(turnGrantedCount);

  useEffect(() => {
    if (!isTeacher && turnGrantedCount > prevTurnCount.current) {
      notify('Es tu turno · el profesor te dio la palabra', 'success');
    }
    prevTurnCount.current = turnGrantedCount;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnGrantedCount, isTeacher]);
}
