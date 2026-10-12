import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BackgroundSelectionDialog from '../BackgroundSelectionDialog/BackgroundSelectionDialog';
import ChatWindow from '../ChatWindow/ChatWindow';
import clsx from 'clsx';
import { GalleryView } from '../GalleryView/GalleryView';
import { MobileGalleryView } from '../MobileGalleryView/MobileGalleryView';
import MainParticipant from '../MainParticipant/MainParticipant';
import { makeStyles, Theme, useMediaQuery, useTheme } from '@material-ui/core';
import { Participant, Room as IRoom } from 'twilio-video';
import { ParticipantAudioTracks } from '../ParticipantAudioTracks/ParticipantAudioTracks';
import ParticipantList from '../ParticipantList/ParticipantList';
import { useAppState } from '../../state';
import useChatContext from '../../hooks/useChatContext/useChatContext';
import useScreenShareParticipant from '../../hooks/useScreenShareParticipant/useScreenShareParticipant';
import useVideoContext from '../../hooks/useVideoContext/useVideoContext';
import useIsRecording from '../../hooks/useIsRecording/useIsRecording';
import useMainParticipant from '../../hooks/useMainParticipant/useMainParticipant';
import useParticipants from '../../hooks/useParticipants/useParticipants';
import useParticipantNetworkQualityLevel from '../../hooks/useParticipantNetworkQualityLevel/useParticipantNetworkQualityLevel';
import TranscriptionsOverlay from '../TranscriptionsOverlay/TranscriptionsOverlay';
import { roomShellFactory, RoomShellContext, RoomShellRole } from './roomShells';
import { useRoomLayout } from './roomLayout';
import useShellNotifications from './StudentRoomShell/useShellNotifications';
import useNotificationToasts from '../../hooks/useNotificationToasts/useNotificationToasts';
import useRaiseHand from '../../hooks/useRaiseHand/useRaiseHand';
import useModeration from '../../hooks/useModeration/useModeration';
import useProctoringWarnings from '../../hooks/useProctoringWarnings/useProctoringWarnings';
import useSessionEnd from '../../hooks/useSessionEnd/useSessionEnd';
import useAttentionReportSaver from '../../hooks/useAttentionReportSaver/useAttentionReportSaver';
import useUnloadReportPersistence from '../../hooks/useUnloadReportPersistence/useUnloadReportPersistence';
import { RaisedHandsContext, buildRaisedHandIdentities } from '../../hooks/useRaiseHand/raisedHandsContext';
import { isTeacherIdentity } from '../PreJoinScreens/classSessionTypes';
import OnboardingTutorial from './OnboardingTutorial/OnboardingTutorial';
import { OnboardingContext } from './OnboardingTutorial/onboardingContext';
import ParticipantStrip from './ParticipantStrip/ParticipantStrip';

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
    // Speaker-view stage: vertical flex column so the ParticipantStrip sits above MainParticipant.
    speakerStage: {
      display: 'flex',
      flexDirection: 'column' as const,
      height: '100%',
      width: '100%',
    },
    speakerMain: {
      flex: 1,
      minHeight: 0,
    },
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
  const { isChatWindowOpen } = useChatContext();
  const { isBackgroundSelectionOpen, room } = useVideoContext();
  const { isGalleryViewActive, setIsGalleryViewActive } = useAppState();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  // Between 600-960px the desktop shells still render (isMobile only flips below 600),
  // but their rails are fixed-width — see useRoomLayout for how that narrows the rails.
  const isNarrowDesktop = useMediaQuery(theme.breakpoints.down('md'));
  const screenShareParticipant = useScreenShareParticipant();
  // Meet-style clean entry: both side rails start collapsed and the toolbar opens them
  // (Participantes / Chat / Panel de atención). The layout owns the rails' exclusion rule.
  const layout = useRoomLayout(isNarrowDesktop);
  const { raisedHands, isHandRaised, setHandRaised, grantTurn, turnGrantedCount } = useRaiseHand();
  const { muteParticipant, mutedByProfessorCount } = useModeration();
  const { sendWarning, warnedByProfessorCount, lastWarningKind } = useProctoringWarnings();
  // Snapshots the attention report to Firestore on both professor exit paths; a
  // silent no-op for students and in non-firebase modes.
  const { saveReport, buildReport } = useAttentionReportSaver();
  // Singleton (one DataTrack) like useRaiseHand: drives the teacher's "end for everyone"
  // and the student-side "session ended" screen. Must be called once here.
  const { endSessionForAll, leaveWithoutEnding } = useSessionEnd({ onProfessorEnd: saveReport });
  const isRecording = useIsRecording();
  const [proctoringEnabled, setProctoringEnabled] = useState(true);
  // Re-open trigger for the onboarding tour: the professor's "Ayuda" button bumps this
  // counter; OnboardingTutorial restarts at step 0 on each bump. Starts at 0 (no-op on mount).
  const [onboardingSignal, setOnboardingSignal] = useState(0);
  const openTour = useCallback(() => setOnboardingSignal(s => s + 1), []);
  const onboardingValue = useMemo(() => ({ openTour }), [openTour]);
  const isTeacher = isTeacherIdentity(room?.localParticipant?.identity);
  const mainParticipant = useMainParticipant();
  const participants = useParticipants();
  const localParticipantNetworkQuality = useParticipantNetworkQualityLevel(room?.localParticipant ?? null);
  const isConnectivityDegraded =
    typeof localParticipantNetworkQuality === 'number' ? localParticipantNetworkQuality <= 2 : false;
  const notifications = useShellNotifications(participants);

  // Transient, role-curated toasts (join/leave, raise-hand, turn, recording).
  useNotificationToasts({
    isTeacher,
    participants,
    raisedHands,
    isRecording,
    turnGrantedCount,
    mutedByProfessorCount,
    warnedByProfessorCount,
    lastWarningKind,
  });

  // Identities (local + remote) currently raising their hand — surfaced as a corner
  // badge on each participant tile via RaisedHandsContext.
  const raisedHandIdentities = useMemo(
    () => buildRaisedHandIdentities(raisedHands, isHandRaised, room?.localParticipant?.identity),
    [raisedHands, isHandRaised, room]
  );
  const participantCount = participants.length + 1;
  const activeSpeakerLabel = mainParticipant?.identity || 'Sin participante activo';
  const sessionLabel = 'Sesión Twilio en vivo';
  const isDesktopShell = !isMobile;
  const hasLegacyRightDrawer = isBackgroundSelectionOpen || (!isDesktopShell && isChatWindowOpen);

  // Here we switch to speaker view when a participant starts sharing their screen, but
  // the user is still free to switch back to gallery view.
  useSetSpeakerViewOnScreenShare(screenShareParticipant, room, setIsGalleryViewActive, isGalleryViewActive);

  // Teacher-only: persist the attention report when the tab is closed or refreshed.
  useUnloadReportPersistence(isTeacher, buildReport);

  // Speaker-view stage: ParticipantStrip filmstrip on top + MainParticipant filling remaining space.
  // Used by both desktop shells; not rendered on mobile or in gallery view.
  const speakerViewStage = (
    <div className={classes.speakerStage} data-testid="speaker-view-stage">
      <ParticipantStrip />
      <div className={classes.speakerMain}>
        <MainParticipant />
      </div>
    </div>
  );

  const role: RoomShellRole = isTeacher ? 'teacher' : 'student';
  const shellContext: RoomShellContext = {
    stage: isGalleryViewActive ? <GalleryView /> : speakerViewStage,
    session: {
      name: room?.name || sessionLabel,
      label: sessionLabel,
      participantCount,
      recording: isRecording,
    },
    participants,
    localIdentity: room?.localParticipant?.identity || '',
    layout,
    hands: { raisedHands, isHandRaised, setHandRaised, grantTurn },
    moderation: { muteParticipant, sendWarning },
    proctoring: { enabled: proctoringEnabled, setEnabled: setProctoringEnabled },
    notifications,
    sessionEnd: { endSessionForAll, leaveWithoutEnding },
    connection: { isDegraded: isConnectivityDegraded, networkQualityLevel: localParticipantNetworkQuality },
    activeSpeakerLabel,
  };

  return (
    <div
      className={clsx(classes.container, {
        [classes.rightDrawerOpen]: hasLegacyRightDrawer,
        [classes.desktopShell]: isDesktopShell && !hasLegacyRightDrawer,
      })}
    >
      <RaisedHandsContext.Provider value={raisedHandIdentities}>
        <OnboardingContext.Provider value={onboardingValue}>
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
          ) : (
            roomShellFactory[role](shellContext)
          )}

          {!isDesktopShell && <ChatWindow />}
          <BackgroundSelectionDialog />
          {/* Onboarding tutorial modal — desktop only; shown once per browser via localStorage */}
          {isDesktopShell && <OnboardingTutorial openSignal={onboardingSignal} />}
          <TranscriptionsOverlay />
        </OnboardingContext.Provider>
      </RaisedHandsContext.Provider>
    </div>
  );
}
