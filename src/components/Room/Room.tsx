import React, { useEffect, useRef, useState } from 'react';
import AttentionPanel from '../AttentionPanel/AttentionPanel';
import BackgroundSelectionDialog from '../BackgroundSelectionDialog/BackgroundSelectionDialog';
import ChatWindow from '../ChatWindow/ChatWindow';
import clsx from 'clsx';
import { GalleryView } from '../GalleryView/GalleryView';
import { MobileGalleryView } from '../MobileGalleryView/MobileGalleryView';
import MainParticipant from '../MainParticipant/MainParticipant';
import { makeStyles, Snackbar, Theme, useMediaQuery, useTheme } from '@material-ui/core';
import { Participant, Room as IRoom } from 'twilio-video';
import { ParticipantAudioTracks } from '../ParticipantAudioTracks/ParticipantAudioTracks';
import ParticipantList from '../ParticipantList/ParticipantList';
import { useAppState } from '../../state';
import useChatContext from '../../hooks/useChatContext/useChatContext';
import useScreenShareParticipant from '../../hooks/useScreenShareParticipant/useScreenShareParticipant';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import useMainParticipant from '../../hooks/useMainParticipant/useMainParticipant';
import useParticipants from '../../hooks/useParticipants/useParticipants';
import useParticipantNetworkQualityLevel from '../../hooks/useParticipantNetworkQualityLevel/useParticipantNetworkQualityLevel';
import TranscriptionsOverlay from '../TranscriptionsOverlay/TranscriptionsOverlay';
import StudentRoomShell from './StudentRoomShell';
import { StudentRoomToolbar } from './StudentRoomShell';
import ProfessorRoomShell, { ProfessorToolbar } from './ProfessorRoomShell';
import { ProfessorRightTab } from './ProfessorRoomShell/ProfessorRoomShell';
import useShellNotifications from './StudentRoomShell/useShellNotifications';
import useRaiseHand from '../../hooks/useRaiseHand/useRaiseHand';
import { isTeacherIdentity } from '../PreJoinScreens/classSessionTypes';

const useStyles = makeStyles((theme: Theme) => {
  const totalMobileSidebarHeight = `${theme.sidebarMobileHeight +
    theme.sidebarMobilePadding * 2 +
    theme.participantBorderWidth}px`;
  return {
    container: {
      position: 'relative',
      height: '100%',
      display: 'grid',
      gridTemplateColumns: `1fr ${theme.sidebarWidth}px`,
      gridTemplateRows: '100%',
      [theme.breakpoints.down('sm')]: {
        gridTemplateColumns: `100%`,
        gridTemplateRows: `calc(100% - ${totalMobileSidebarHeight}) ${totalMobileSidebarHeight}`,
      },
    },
    rightDrawerOpen: { gridTemplateColumns: `1fr ${theme.sidebarWidth}px ${theme.rightDrawerWidth}px` },
    // The desktop room shells (Professor/Student) are self-contained full-bleed layouts that own their
    // left/center/right rails, so the legacy sidebar column must collapse to avoid an empty black gutter.
    desktopShell: { gridTemplateColumns: '100%' },
  };
});

/**
 * This hook turns on speaker view when screensharing is active, regardless of if the
 * user was already using speaker view or gallery view. Once screensharing has ended, the user's
 * view will return to whatever they were using prior to screenshare starting.
 */

export function useSetSpeakerViewOnScreenShare(
  screenShareParticipant: Participant | undefined,
  room: IRoom | null,
  setIsGalleryViewActive: React.Dispatch<React.SetStateAction<boolean>>,
  isGalleryViewActive: boolean
) {
  const isGalleryViewActiveRef = useRef(isGalleryViewActive);

  // Save the user's view setting whenever they change to speaker view or gallery view:
  useEffect(() => {
    isGalleryViewActiveRef.current = isGalleryViewActive;
  }, [isGalleryViewActive]);

  useEffect(() => {
    if (screenShareParticipant && screenShareParticipant !== room!.localParticipant) {
      // When screensharing starts, save the user's previous view setting (speaker or gallery):
      const prevIsGalleryViewActive = isGalleryViewActiveRef.current;
      // Turn off gallery view so that the user can see the screen that is being shared:
      setIsGalleryViewActive(false);
      return () => {
        // If the user was using gallery view prior to screensharing, turn gallery view back on
        // once screensharing stops:
        if (prevIsGalleryViewActive) {
          setIsGalleryViewActive(prevIsGalleryViewActive);
        }
      };
    }
  }, [screenShareParticipant, setIsGalleryViewActive, room]);
}

export default function Room() {
  const classes = useStyles();
  const { isChatWindowOpen, isAttentionPanelOpen } = useChatContext();
  const { isBackgroundSelectionOpen, room } = useVideoContext();
  const { isGalleryViewActive, setIsGalleryViewActive } = useAppState();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const screenShareParticipant = useScreenShareParticipant();
  const [rightTab, setRightTab] = useState<'chat' | 'attention'>('chat');
  const [professorTab, setProfessorTab] = useState<ProfessorRightTab>('grupo');
  const { raisedHands, isHandRaised, setHandRaised, grantTurn, turnGrantedCount } = useRaiseHand();
  const [recording, setRecording] = useState(false);
  const [proctoringEnabled, setProctoringEnabled] = useState(true);
  const [isTurnSnackbarOpen, setIsTurnSnackbarOpen] = useState(false);
  const isTeacher = isTeacherIdentity(room?.localParticipant?.identity);
  const mainParticipant = useMainParticipant();
  const participants = useParticipants();
  const localParticipantNetworkQuality = useParticipantNetworkQualityLevel(room?.localParticipant ?? null);
  const isConnectivityDegraded =
    typeof localParticipantNetworkQuality === 'number' ? localParticipantNetworkQuality <= 2 : false;
  const notifications = useShellNotifications(participants, isHandRaised);
  const participantCount = participants.length + 1;
  const activeSpeakerLabel = mainParticipant?.identity || 'Sin participante activo';
  const sessionLabel = 'Sesión Twilio en vivo';
  const isDesktopShell = !isMobile;
  const hasLegacyRightDrawer =
    isBackgroundSelectionOpen || (!isDesktopShell && (isChatWindowOpen || isAttentionPanelOpen));

  // Here we switch to speaker view when a participant starts sharing their screen, but
  // the user is still free to switch back to gallery view.
  useSetSpeakerViewOnScreenShare(screenShareParticipant, room, setIsGalleryViewActive, isGalleryViewActive);

  // Surface a transient cue when the professor gives this participant the turn.
  useEffect(() => {
    if (turnGrantedCount > 0) {
      setIsTurnSnackbarOpen(true);
    }
  }, [turnGrantedCount]);

  return (
    <div
      className={clsx(classes.container, {
        [classes.rightDrawerOpen]: hasLegacyRightDrawer,
        [classes.desktopShell]: isDesktopShell && !hasLegacyRightDrawer,
      })}
    >
      {/* 
        This ParticipantAudioTracks component will render the audio track for all participants in the room.
        It is in a separate component so that the audio tracks will always be rendered, and that they will never be 
        unnecessarily unmounted/mounted as the user switches between Gallery View and speaker View.
      */}
      <ParticipantAudioTracks />

      {isMobile ? (
        isGalleryViewActive ? (
          <MobileGalleryView />
        ) : (
          <>
            <MainParticipant />
            <ParticipantList />
          </>
        )
      ) : isTeacher ? (
        <ProfessorRoomShell
          stage={isGalleryViewActive ? <GalleryView /> : <MainParticipant />}
          toolbarSlot={
            <ProfessorToolbar
              recording={recording}
              onRecordingChange={setRecording}
              proctoringEnabled={proctoringEnabled}
              onProctoringChange={setProctoringEnabled}
            />
          }
          rightTab={professorTab}
          onRightTabChange={setProfessorTab}
          sessionLabel={sessionLabel}
          sessionName={room?.name || sessionLabel}
          participantCount={participantCount}
          recording={recording}
          handsRaised={raisedHands}
          onGrantTurn={grantTurn}
          proctoringEnabled={proctoringEnabled}
        />
      ) : (
        <StudentRoomShell
          stage={isGalleryViewActive ? <GalleryView /> : <MainParticipant />}
          toolbarSlot={<StudentRoomToolbar handRaised={isHandRaised} onHandRaisedChange={setHandRaised} />}
          rightTab={rightTab}
          onRightTabChange={setRightTab}
          activeSpeakerLabel={activeSpeakerLabel}
          sessionLabel={sessionLabel}
          participantCount={participantCount}
          notifications={notifications}
          isConnectivityDegraded={isConnectivityDegraded}
          rightPanel={rightTab === 'chat' ? <ChatWindow embedded isVisible /> : <AttentionPanel embedded isVisible />}
        />
      )}

      {!isDesktopShell && <ChatWindow />}
      {!isDesktopShell && <AttentionPanel />}
      <BackgroundSelectionDialog />
      <TranscriptionsOverlay />
      <Snackbar
        open={isTurnSnackbarOpen}
        autoHideDuration={6000}
        onClose={() => setIsTurnSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        message="Es tu turno · el profesor te dio la palabra"
      />
    </div>
  );
}
