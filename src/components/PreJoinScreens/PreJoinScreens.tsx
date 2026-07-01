import React, { useState, useEffect } from 'react';
import { CircularProgress, Typography } from '@material-ui/core';
import DeviceSelectionScreen from './DeviceSelectionScreen/DeviceSelectionScreen';
import IntroContainer from '../IntroContainer/IntroContainer';
import MediaErrorSnackbar from './MediaErrorSnackbar/MediaErrorSnackbar';
import RoomNameScreen from './RoomNameScreen/RoomNameScreen';
import { useAppState } from '../../state';
import { useLocation, useParams } from 'react-router-dom';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import useAutoRejoin from './useAutoRejoin';
import { checkRoomOpen } from './checkRoomOpen';
import { getResumableSession } from './rejoinSession';
import {
  ClassSessionAccess,
  ClassSessionDraft,
  createClassSessionAccess,
  createDefaultClassSessionDraft,
  isTeacherIdentity,
  normalizeStudentJoinInputToRoomName,
  stripTeacherSuffix,
  toClassSessionDisplayName,
} from './classSessionTypes';
import { Steps } from './steps';

export default function PreJoinScreens() {
  const { user } = useAppState();
  const { getAudioAndVideoTracks } = useVideoContext();
  const { URLRoomName } = useParams<{ URLRoomName?: string }>();
  const isRejoining = useAutoRejoin(URLRoomName);
  const location = useLocation<{ preJoinRole?: 'teacher' | 'student' }>();
  const preJoinRole = location.state?.preJoinRole;
  // A refresh on /room/:name destroys the live Room; if a session was persisted for this exact
  // room, its identity encodes the correct role (teacher carries the [Profesor] suffix). Read it
  // synchronously so the fallback lobby shows the RIGHT role/name instead of defaulting to student.
  const resumable = getResumableSession(URLRoomName);
  const initialRole: 'teacher' | 'student' = resumable
    ? isTeacherIdentity(resumable.identity)
      ? 'teacher'
      : 'student'
    : URLRoomName
    ? 'student'
    : preJoinRole === 'student'
    ? 'student'
    : 'teacher';
  const [step, setStep] = useState(Steps.roomNameStep);

  // Prefill the editable name field from the persisted identity on a manual rejoin (teacher
  // suffix stripped — the teacher join flow re-appends it). Falls back to the user displayName.
  const [name, setName] = useState<string>(() =>
    resumable ? stripTeacherSuffix(resumable.identity) : user?.displayName || ''
  );
  // teacherDisplayName is purely derived from `name` (the [Profesor] suffix is appended for the
  // teacher card preview), so compute it during render instead of mirroring it into state.
  const teacherDisplayName = toClassSessionDisplayName(name, 'teacher');
  const [roomName, setRoomName] = useState<string>('');
  const [studentJoinCode, setStudentJoinCode] = useState<string>('');
  const [classSessionDraft, setClassSessionDraft] = useState<ClassSessionDraft>(() => ({
    ...createDefaultClassSessionDraft(user?.displayName || ''),
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
      // Derive the role from the persisted identity (teacher suffix) instead of hardcoding
      // 'student' — otherwise a teacher who refreshes lands on the student card (Bug 1).
      const session = getResumableSession(URLRoomName);
      const role = session && isTeacherIdentity(session.identity) ? 'teacher' : 'student';
      setClassSessionDraft(prev => ({ ...prev, role }));
    }
  }, [URLRoomName]);

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

    // If this app is deployed as a twilio function, don't change the URL because routing isn't supported.
    // @ts-ignore
    if (!window.location.origin.includes('twil.io') && !window.STORYBOOK_ENV) {
      const selectedRoomName = classSessionDraft.role === 'student' ? normalizedStudentRoomName : roomName;
      window.history.replaceState(
        null,
        '',
        window.encodeURI(`/room/${selectedRoomName}${window.location.search || ''}`)
      );
    }
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

    // @ts-ignore
    if (!window.location.origin.includes('twil.io') && !window.STORYBOOK_ENV) {
      window.history.replaceState(
        null,
        '',
        window.encodeURI(`/room/${normalizedStudentRoomName}${window.location.search || ''}`)
      );
    }
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
    <IntroContainer
      // 1004 = the previous 940 of content + the screenWrapper side padding (2 × 32),
      // so the preview/panel columns keep their original widths.
      maxWidth={step === Steps.deviceSelectionStep ? 1004 : undefined}
      noHero={step === Steps.deviceSelectionStep}
      headerRoomName={step === Steps.deviceSelectionStep ? roomName : undefined}
      homeRole={classSessionDraft.role}
    >
      <MediaErrorSnackbar error={mediaError} />
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
  );
}
