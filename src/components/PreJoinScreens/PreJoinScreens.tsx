import React, { useState, useEffect } from 'react';
import { CircularProgress, Typography } from '@material-ui/core';
import DeviceSelectionScreen from './DeviceSelectionScreen/DeviceSelectionScreen';
import IntroContainer from '../IntroContainer/IntroContainer';
import MediaErrorSnackbar from './MediaErrorSnackbar/MediaErrorSnackbar';
import RoomNameScreen from './RoomNameScreen/RoomNameScreen';
import { useAppState } from '../../state';
import { useParams } from 'react-router-dom';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import useAutoRejoin from './useAutoRejoin';
import useInitialRole from '../TeacherDashboard/useInitialRole';
import { checkRoomOpen } from './checkRoomOpen';
import { getResumableSession } from './rejoinSession';
import {
  ClassSessionAccess,
  ClassSessionDraft,
  createClassSessionAccess,
  createDefaultClassSessionDraft,
  normalizeStudentJoinInputToRoomName,
  stripTeacherSuffix,
  toClassSessionDisplayName,
} from './classSessionTypes';
import { Steps } from './steps';

interface PreJoinScreensProps {
  /**
   * When set (by App.tsx, after a teacher picks a class from the TeacherDashboard),
   * seeds roomName/name and skips straight to the device-selection step — the
   * lobby's room-name step never renders for this handoff.
   */
  initialClassSession?: { roomName: string; name: string };
}

export default function PreJoinScreens({ initialClassSession }: PreJoinScreensProps = {}) {
  const { user, profile } = useAppState();
  const { getAudioAndVideoTracks } = useVideoContext();
  const { URLRoomName } = useParams<{ URLRoomName?: string }>();
  const isRejoining = useAutoRejoin(URLRoomName);
  // A refresh on /room/:name destroys the live Room; if a session was persisted for this exact
  // room, its identity encodes the correct role (teacher carries the [Profesor] suffix). Read it
  // synchronously so the fallback lobby shows the RIGHT role/name instead of defaulting to student.
  const resumable = getResumableSession(URLRoomName);
  // Single source of truth for the priority chain (profile > resumable session > deep link >
  // login-screen choice > default teacher) — also used by App.tsx to gate the TeacherDashboard,
  // so both places are guaranteed to agree instead of maintaining two copies that can drift.
  const initialRole = useInitialRole();
  const [step, setStep] = useState(initialClassSession ? Steps.deviceSelectionStep : Steps.roomNameStep);

  // Prefill the editable name field from the persisted identity on a manual rejoin (teacher
  // suffix stripped — the teacher join flow re-appends it). Falls back to the verified
  // profile displayName (firebase mode), then to the auth user displayName. The
  // TeacherDashboard handoff wins over all of these — it already carries the resolved
  // teacher display name for the session being started.
  const [name, setName] = useState<string>(() =>
    initialClassSession
      ? initialClassSession.name
      : resumable
      ? stripTeacherSuffix(resumable.identity)
      : profile?.displayName || user?.displayName || ''
  );
  // teacherDisplayName is purely derived from `name` (the [Profesor] suffix is appended for the
  // teacher card preview), so compute it during render instead of mirroring it into state.
  const teacherDisplayName = toClassSessionDisplayName(name, 'teacher');
  const [roomName, setRoomName] = useState<string>(initialClassSession ? initialClassSession.roomName : '');
  const [studentJoinCode, setStudentJoinCode] = useState<string>('');
  const [classSessionDraft, setClassSessionDraft] = useState<ClassSessionDraft>(() => ({
    ...createDefaultClassSessionDraft(profile?.displayName || user?.displayName || ''),
    role: initialRole,
  }));
  const [classSessionAccess, setClassSessionAccess] = useState<ClassSessionAccess | null>(null);

  // Early room-access feedback for students: whether the open-room probe is running, and
  // whether it came back "closed" (so we keep them on the room-name step with a message
  // instead of sending them through the device-selection waiting room for nothing).
  const [isCheckingRoom, setIsCheckingRoom] = useState(false);
  const [roomClosed, setRoomClosed] = useState(false);

  const [mediaError, setMediaError] = useState<Error>();

  useEffect(() => {
    if (URLRoomName) {
      setRoomName(URLRoomName);
      setStudentJoinCode(URLRoomName);
      // `initialRole` already resolves profile > resumable session > deep link (Bug 1: a
      // teacher who refreshes must land back on the teacher card, not hardcoded 'student')
      // via the single shared priority chain in useInitialRole — no need to re-derive it here.
      setClassSessionDraft(prev => ({ ...prev, role: initialRole }));
    }
  }, [URLRoomName, initialRole]);

  useEffect(() => {
    setClassSessionDraft(prev => ({ ...prev, displayName: name }));
  }, [name]);

  // Editing the join code invalidates a previous "room closed" verdict.
  useEffect(() => {
    setRoomClosed(false);
  }, [studentJoinCode]);

  // A created session's share code/link are derived from the session name; editing it
  // makes them stale, so drop the access and bring back the "Crear sesión" button.
  useEffect(() => {
    setClassSessionAccess(null);
  }, [classSessionDraft.sessionName]);

  useEffect(() => {
    if (step === Steps.deviceSelectionStep && !mediaError) {
      getAudioAndVideoTracks().catch(error => {
        console.log('Error acquiring local media:');
        console.dir(error);
        setMediaError(error);
      });
    }
  }, [getAudioAndVideoTracks, step, mediaError]);

  // If this app is deployed as a twilio function, don't change the URL because routing isn't supported.
  const replaceRoomUrlWithoutNavigation = (targetRoomName: string) => {
    // @ts-ignore
    if (!window.location.origin.includes('twil.io') && !window.STORYBOOK_ENV) {
      window.history.replaceState(null, '', window.encodeURI(`/room/${targetRoomName}${window.location.search || ''}`));
    }
  };

  // The TeacherDashboard handoff seeds roomName/step via the lazy state initializers above and
  // skips straight past goToDeviceSelection() — which is the only place that normally rewrites
  // the URL to /room/:name. Without this, a mid-class refresh has no URLRoomName param, so
  // getResumableSession() can never match and auto-rejoin silently never fires. Runs once on
  // mount: initialClassSession is set once per dashboard hand-off and must land before the first
  // paint of the device-selection step, not react to later changes.
  useEffect(() => {
    if (initialClassSession) {
      replaceRoomUrlWithoutNavigation(initialClassSession.roomName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToDeviceSelection = async () => {
    const normalizedStudentRoomName = normalizeStudentJoinInputToRoomName(studentJoinCode);

    if (classSessionDraft.role === 'student') {
      setRoomName(normalizedStudentRoomName);

      // Tell the student a class isn't open BEFORE the device-selection waiting room,
      // instead of only when they hit "Entrar a la sala". This is a UX affordance — the
      // POST /token room-access guard is the real gate. checkRoomOpen returns null on an
      // inconclusive check, so a flaky probe never blocks a legitimately open room.
      setRoomClosed(false);
      setIsCheckingRoom(true);
      const open = await checkRoomOpen(normalizedStudentRoomName);
      setIsCheckingRoom(false);
      if (open === false) {
        setRoomClosed(true);
        return;
      }
    }

    const selectedRoomName = classSessionDraft.role === 'student' ? normalizedStudentRoomName : roomName;
    replaceRoomUrlWithoutNavigation(selectedRoomName);
    setStep(Steps.deviceSelectionStep);
  };

  // Explicit student-path continuation: always treats the action as a student joining, regardless
  // of the current draft role. Used by the student card in the dual-card layout so that the
  // teacher default role never silently bypasses the room-open check.
  const goToDeviceSelectionAsStudent = async () => {
    setClassSessionDraft(prev => ({ ...prev, role: 'student' }));
    const normalizedStudentRoomName = normalizeStudentJoinInputToRoomName(studentJoinCode);

    setRoomName(normalizedStudentRoomName);
    setRoomClosed(false);
    setIsCheckingRoom(true);
    const open = await checkRoomOpen(normalizedStudentRoomName);
    setIsCheckingRoom(false);
    if (open === false) {
      setRoomClosed(true);
      return;
    }

    replaceRoomUrlWithoutNavigation(normalizedStudentRoomName);
    setStep(Steps.deviceSelectionStep);
  };

  const handleCreateClassSession = () => {
    const access = createClassSessionAccess(classSessionDraft, window.location.origin, window.location.search || '');
    setClassSessionAccess(access);
    setRoomName(access.roomName);
    setName(toClassSessionDisplayName(classSessionDraft.displayName, 'teacher'));
  };

  if (isRejoining) {
    return (
      <IntroContainer homeRole={classSessionDraft.role}>
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '2em 0' }}
          aria-live="polite"
        >
          <CircularProgress variant="indeterminate" />
          <Typography variant="body1" style={{ fontWeight: 'bold' }}>
            Reconectando a la sala…
          </Typography>
          {URLRoomName && (
            <Typography variant="body2" color="textSecondary">
              Sala: <strong>{URLRoomName}</strong>
            </Typography>
          )}
        </div>
      </IntroContainer>
    );
  }

  return (
    <>
      {/* Rendered OUTSIDE IntroContainer: MUI v4's Snackbar is an inline `position: fixed`
          element (no Portal), so nesting it inside IntroContainer's <main> (z-index 1)
          trapped it below the header (z-index 10), which clipped the headline. As a
          top-level sibling it floats above everything, like the in-room snackbars. */}
      <MediaErrorSnackbar error={mediaError} />
      <IntroContainer
        // 1004 = the previous 940 of content + the screenWrapper side padding (2 × 32),
        // so the preview/panel columns keep their original widths.
        maxWidth={step === Steps.deviceSelectionStep ? 1004 : undefined}
        noHero={step === Steps.deviceSelectionStep}
        headerRoomName={step === Steps.deviceSelectionStep ? roomName : undefined}
        homeRole={classSessionDraft.role}
      >
        {step === Steps.roomNameStep && (
          <RoomNameScreen
            name={name}
            roomName={roomName}
            teacherDisplayName={teacherDisplayName}
            classSessionDraft={classSessionDraft}
            classSessionAccess={classSessionAccess}
            studentJoinCode={studentJoinCode}
            isCheckingRoom={isCheckingRoom}
            roomClosedError={roomClosed}
            setName={setName}
            setStudentJoinCode={setStudentJoinCode}
            setClassSessionDraft={setClassSessionDraft}
            onSelectRole={role => setClassSessionDraft(prev => ({ ...prev, role }))}
            onCreateClassSession={handleCreateClassSession}
            onContinueToDeviceSelection={goToDeviceSelection}
            onContinueAsStudent={goToDeviceSelectionAsStudent}
          />
        )}

        {step === Steps.deviceSelectionStep && (
          <DeviceSelectionScreen name={name} roomName={roomName} setStep={setStep} />
        )}
      </IntroContainer>
    </>
  );
}
