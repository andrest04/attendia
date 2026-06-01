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
import {
  ClassSessionAccess,
  ClassSessionDraft,
  createClassSessionAccess,
  createDefaultClassSessionDraft,
  normalizeStudentJoinInputToRoomName,
  toClassSessionDisplayName,
} from './classSessionTypes';

export enum Steps {
  roomNameStep,
  deviceSelectionStep,
}

export default function PreJoinScreens() {
  const { user } = useAppState();
  const { getAudioAndVideoTracks } = useVideoContext();
  const { URLRoomName } = useParams<{ URLRoomName?: string }>();
  const isRejoining = useAutoRejoin(URLRoomName);
  const location = useLocation<{ preJoinRole?: 'teacher' | 'student' }>();
  const preJoinRole = location.state?.preJoinRole;
  const initialRole: 'teacher' | 'student' = URLRoomName
    ? 'student'
    : preJoinRole === 'student'
    ? 'student'
    : 'teacher';
  const [step, setStep] = useState(Steps.roomNameStep);

  const [name, setName] = useState<string>(user?.displayName || '');
  const [teacherDisplayName, setTeacherDisplayName] = useState<string>(
    toClassSessionDisplayName(user?.displayName || '', 'teacher')
  );
  const [roomName, setRoomName] = useState<string>('');
  const [studentJoinCode, setStudentJoinCode] = useState<string>('');
  const [classSessionDraft, setClassSessionDraft] = useState<ClassSessionDraft>(() => ({
    ...createDefaultClassSessionDraft(user?.displayName || ''),
    role: initialRole,
  }));
  const [classSessionAccess, setClassSessionAccess] = useState<ClassSessionAccess | null>(null);

  const [mediaError, setMediaError] = useState<Error>();

  useEffect(() => {
    if (URLRoomName) {
      setRoomName(URLRoomName);
      setStudentJoinCode(URLRoomName);
      setClassSessionDraft(prev => ({ ...prev, role: 'student' }));
    }
  }, [URLRoomName]);

  useEffect(() => {
    setClassSessionDraft(prev => ({ ...prev, displayName: name }));
    setTeacherDisplayName(toClassSessionDisplayName(name, 'teacher'));
  }, [name]);

  useEffect(() => {
    if (step === Steps.deviceSelectionStep && !mediaError) {
      getAudioAndVideoTracks().catch(error => {
        console.log('Error acquiring local media:');
        console.dir(error);
        setMediaError(error);
      });
    }
  }, [getAudioAndVideoTracks, step, mediaError]);

  const goToDeviceSelection = () => {
    const normalizedStudentRoomName = normalizeStudentJoinInputToRoomName(studentJoinCode);

    if (classSessionDraft.role === 'student') {
      setRoomName(normalizedStudentRoomName);
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

  const handleCreateClassSession = () => {
    const access = createClassSessionAccess(classSessionDraft, window.location.origin, window.location.search || '');
    setClassSessionAccess(access);
    setRoomName(access.roomName);
    setName(toClassSessionDisplayName(classSessionDraft.displayName, 'teacher'));
  };

  if (isRejoining) {
    return (
      <IntroContainer>
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
    <IntroContainer maxWidth={step === Steps.deviceSelectionStep ? 940 : undefined}>
      <MediaErrorSnackbar error={mediaError} />
      {step === Steps.roomNameStep && (
        <RoomNameScreen
          name={name}
          roomName={roomName}
          teacherDisplayName={teacherDisplayName}
          classSessionDraft={classSessionDraft}
          classSessionAccess={classSessionAccess}
          studentJoinCode={studentJoinCode}
          setName={setName}
          setStudentJoinCode={setStudentJoinCode}
          setClassSessionDraft={setClassSessionDraft}
          onSelectRole={role => setClassSessionDraft(prev => ({ ...prev, role }))}
          onCreateClassSession={handleCreateClassSession}
          onContinueToDeviceSelection={goToDeviceSelection}
        />
      )}

      {step === Steps.deviceSelectionStep && (
        <DeviceSelectionScreen name={name} roomName={roomName} setStep={setStep} />
      )}
    </IntroContainer>
  );
}
