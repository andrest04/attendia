import React from 'react';
import { Participant } from 'twilio-video';
import { i18n } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useSnackbar, VariantType } from 'notistack';
import { isTeacherIdentity, stripTeacherSuffix } from '../../classSession/classSessionTypes';
import { ProctoringAlert } from '../../components/AttentionProvider/types';
import useOnChange from '../useOnChange/useOnChange';
import useOnIncrease from '../useOnIncrease/useOnIncrease';

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
  /** Increments each time the professor turns THIS participant's camera off. */
  cameraOffByProfessorCount?: number;
  /** Increments each time the professor sends THIS participant a proctoring warning. */
  warnedByProfessorCount: number;
  /** Kind of the most recent proctoring warning aimed at THIS participant (drives toast copy). */
  lastWarningKind: ProctoringAlert['kind'] | null;
}

interface Toast {
  key: string;
  variant: VariantType;
  name?: string;
}

const toast = (key: string, variant: VariantType = 'info', name?: string): Toast => ({ key, variant, name });

function ToastMessage({ candidate, instance }: { candidate: Toast; instance: i18n }) {
  const { t } = useTranslation('notifications', { i18n: instance });
  return React.createElement(React.Fragment, null, t(candidate.key, { name: candidate.name }));
}

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
  cameraTurnedOff?(): Toast | undefined;
  warned?(kind: ProctoringAlert['kind'] | null): Toast | undefined;
}

// Professor: students joining/leaving and raising their hand.
const createTeacherPolicy = (): ToastPolicy => ({
  participantJoined: identity =>
    isTeacherIdentity(identity) ? undefined : toast('participantJoined', 'info', stripTeacherSuffix(identity)),
  participantLeft: identity =>
    isTeacherIdentity(identity) ? undefined : toast('participantLeft', 'info', stripTeacherSuffix(identity)),
  handRaised: identity => toast('handRaised', 'info', stripTeacherSuffix(identity)),
  // The owner may mute or turn off a co-teacher; both teachers read as "the professor".
  muted: () => toast('mutedByProfessor', 'warning'),
  cameraTurnedOff: () => toast('cameraOffByProfessor', 'warning'),
});

// Student: the professor joining/leaving, "es tu turno", recording on/off, being muted or
// warned. Classmates joining/leaving go to the panel log, not toasts; the student's own
// raise-hand is not toasted — it is redundant noise.
const createStudentPolicy = (): ToastPolicy => ({
  participantJoined: identity => (isTeacherIdentity(identity) ? toast('professorJoined') : undefined),
  participantLeft: identity => (isTeacherIdentity(identity) ? toast('professorLeft', 'warning') : undefined),
  recordingChanged: isRecording =>
    isRecording ? toast('recordingStarted', 'warning') : toast('recordingStopped', 'default'),
  turnGranted: () => toast('turnGranted', 'success'),
  muted: () => toast('mutedByProfessor', 'warning'),
  cameraTurnedOff: () => toast('cameraOffByProfessor', 'warning'),
  warned: kind => toast(`warning.${kind || 'generic'}`, 'warning'),
});

/**
 * Fires transient toast notifications with a CURATED, role-aware policy so the
 * same raw room events surface only where they matter (see createTeacherPolicy / createStudentPolicy).
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
  cameraOffByProfessorCount = 0,
  warnedByProfessorCount,
  lastWarningKind,
}: UseNotificationToastsArgs) {
  const { enqueueSnackbar } = useSnackbar();
  const { i18n: instance } = useTranslation('notifications');
  const policy = isTeacher ? createTeacherPolicy() : createStudentPolicy();

  const show = (candidate: Toast | undefined) => {
    if (candidate) enqueueSnackbar(React.createElement(ToastMessage, { candidate, instance }), { variant: candidate.variant });
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
  useOnIncrease(turnGrantedCount, () => show(policy.turnGranted?.()));

  // ── Muted by professor ──────────────────────────────────────────────────────
  useOnIncrease(mutedByProfessorCount, () => show(policy.muted?.()));

  // ── Camera turned off by professor ──────────────────────────────────────────
  useOnIncrease(cameraOffByProfessorCount, () => show(policy.cameraTurnedOff?.()));

  // ── Proctoring warning ──────────────────────────────────────────────────────
  useOnIncrease(warnedByProfessorCount, () => show(policy.warned?.(lastWarningKind)));
}
