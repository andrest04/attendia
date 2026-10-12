import { Participant } from 'twilio-video';
import { useSnackbar, VariantType } from 'notistack';
import { isTeacherIdentity, stripTeacherSuffix } from '../../components/PreJoinScreens/classSessionTypes';
import { ProctoringAlert } from '../../components/AttentionProvider/types';
import useOnChange from '../useOnChange/useOnChange';

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
  /** Increments each time the professor mutes THIS participant's microphone. */
  mutedByProfessorCount: number;
  /** Increments each time the professor sends THIS participant a proctoring warning. */
  warnedByProfessorCount: number;
  /** Kind of the most recent proctoring warning aimed at THIS participant (drives toast copy). */
  lastWarningKind: ProctoringAlert['kind'] | null;
}

interface Toast {
  message: string;
  variant: VariantType;
}

const toast = (message: string, variant: VariantType = 'info'): Toast => ({ message, variant });

/**
 * What each role is told about each room event. A policy answers "what, if anything, should
 * I toast?" per event; an event a role does not care about is simply absent (the Null Object:
 * no branching on role at the call sites). This is the one place that says who sees what.
 */
interface ToastPolicy {
  participantJoined?(identity: string): Toast | undefined;
  participantLeft?(identity: string): Toast | undefined;
  handRaised?(identity: string): Toast | undefined;
  recordingChanged?(isRecording: boolean): Toast | undefined;
  turnGranted?(): Toast | undefined;
  muted?(): Toast | undefined;
  warned?(kind: ProctoringAlert['kind'] | null): Toast | undefined;
}

/** Student-facing copy for a proctoring warning, specific to the detected condition. */
function warningMessage(kind: ProctoringAlert['kind'] | null): string {
  switch (kind) {
    case 'camera-off':
      return 'El profesor te pidió encender tu cámara';
    case 'multiface':
      return 'El profesor detectó varias personas en tu cámara';
    case 'away':
      return 'El profesor te pidió volver a concentrarte en la clase';
    case 'absent':
      return 'El profesor no te detecta frente a la cámara';
    default:
      return 'El profesor te envió una advertencia';
  }
}

// Professor: students joining/leaving and raising their hand.
const teacherPolicy: ToastPolicy = {
  participantJoined: identity =>
    isTeacherIdentity(identity) ? undefined : toast(`${stripTeacherSuffix(identity)} se unió a la sesión`),
  participantLeft: identity =>
    isTeacherIdentity(identity) ? undefined : toast(`${stripTeacherSuffix(identity)} salió de la sesión`),
  handRaised: identity => toast(`${stripTeacherSuffix(identity)} levantó la mano`),
};

// Student: the professor joining/leaving, "es tu turno", recording on/off, being muted or
// warned. Classmates joining/leaving go to the panel log, not toasts; the student's own
// raise-hand is not toasted — it is redundant noise.
const studentPolicy: ToastPolicy = {
  participantJoined: identity => (isTeacherIdentity(identity) ? toast('El profesor se unió a la sesión') : undefined),
  participantLeft: identity =>
    isTeacherIdentity(identity) ? toast('El profesor salió de la sesión', 'warning') : undefined,
  recordingChanged: isRecording =>
    isRecording ? toast('La sesión se está grabando', 'warning') : toast('Se detuvo la grabación', 'default'),
  turnGranted: () => toast('Es tu turno · el profesor te dio la palabra', 'success'),
  muted: () => toast('El profesor silenció tu micrófono', 'warning'),
  warned: kind => toast(warningMessage(kind), 'warning'),
};

/**
 * Fires transient toast notifications with a CURATED, role-aware policy so the
 * same raw room events surface only where they matter (see teacherPolicy / studentPolicy).
 *
 * All toasts go through notistack's SnackbarProvider (maxSnack + autoHide), so a
 * busy room never buries the screen. Events are detected as changes against the previous
 * value (useOnChange), which is never fired for the state already present on mount.
 */
export default function useNotificationToasts({
  isTeacher,
  participants,
  raisedHands,
  isRecording,
  turnGrantedCount,
  mutedByProfessorCount,
  warnedByProfessorCount,
  lastWarningKind,
}: UseNotificationToastsArgs) {
  const { enqueueSnackbar } = useSnackbar();
  const policy = isTeacher ? teacherPolicy : studentPolicy;

  const show = (candidate: Toast | undefined) => {
    if (candidate) enqueueSnackbar(candidate.message, { variant: candidate.variant });
  };

  // ── Join / leave ────────────────────────────────────────────────────────────
  useOnChange(participants, (previous, current) => {
    const currentIds = current.map(p => p.sid);
    const previousIds = previous.map(p => p.sid);

    current.filter(p => !previousIds.includes(p.sid)).forEach(p => show(policy.participantJoined?.(p.identity)));

    previous
      .filter(p => !currentIds.includes(p.sid))
      .map(p => p.identity)
      .filter(Boolean)
      .forEach(identity => show(policy.participantLeft?.(identity)));
  });

  // ── Raised hands ────────────────────────────────────────────────────────────
  useOnChange(raisedHands, (previous, current) => {
    current.filter(id => !previous.includes(id)).forEach(identity => show(policy.handRaised?.(identity)));
  });

  // ── Recording on/off ────────────────────────────────────────────────────────
  useOnChange(isRecording, (_previous, current) => show(policy.recordingChanged?.(current)));

  // ── Turn granted ────────────────────────────────────────────────────────────
  useOnChange(turnGrantedCount, (previous, current) => {
    if (current > previous) show(policy.turnGranted?.());
  });

  // ── Muted by professor ──────────────────────────────────────────────────────
  useOnChange(mutedByProfessorCount, (previous, current) => {
    if (current > previous) show(policy.muted?.());
  });

  // ── Proctoring warning ──────────────────────────────────────────────────────
  useOnChange(warnedByProfessorCount, (previous, current) => {
    if (current > previous) show(policy.warned?.(lastWarningKind));
  });
}
