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
import StudentRoomShell from './StudentRoomShell';
import { StudentRoomToolbar } from './StudentRoomShell';
import ProfessorRoomShell, { ProfessorToolbar } from './ProfessorRoomShell';
import { ProfessorRightTab } from './ProfessorRoomShell/professorShellHelpers';
import useShellNotifications from './StudentRoomShell/useShellNotifications';
import useNotificationToasts from '../../hooks/useNotificationToasts/useNotificationToasts';
import useRaiseHand from '../../hooks/useRaiseHand/useRaiseHand';
import useModeration from '../../hooks/useModeration/useModeration';
import useProctoringWarnings from '../../hooks/useProctoringWarnings/useProctoringWarnings';
import useSessionEnd from '../../hooks/useSessionEnd/useSessionEnd';
import useAttentionReportSaver from '../../hooks/useAttentionReportSaver/useAttentionReportSaver';
import useCachedIdToken from '../../hooks/useCachedIdToken/useCachedIdToken';
import { savePendingAttentionReport } from '../AttentionReport/pendingAttentionReports';
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
  const { isGalleryViewActive, setIsGalleryViewActive, user } = useAppState();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  // Between 600-960px the desktop shells still render (isMobile only flips below 600),
  // but their rails are fixed-width — with BOTH open at once the stage can shrink to a
  // sliver. On that range, opening one rail auto-closes the other so the stage always
  // keeps its narrowed-but-usable width (see ProfessorRoomShell/StudentRoomShell down('md') rail widths).
  const isNarrowDesktop = useMediaQuery(theme.breakpoints.down('md'));
  const screenShareParticipant = useScreenShareParticipant();
  const [professorTab, setProfessorTab] = useState<ProfessorRightTab>('grupo');
  // Meet-style clean entry: both side rails start collapsed and the professor opens
  // them from the toolbar (Participantes / Chat / Panel de atención).
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
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
  // `user` is typed as a union with a legacy non-firebase shape (see StateContextType);
  // narrow to a real firebase User via a method only it has before handing it to
  // useCachedIdToken, which calls user.getIdToken().
  const firebaseUser = user && 'getIdToken' in user ? user : null;
  // Only cached while a teacher is present — the unload-time keepalive POST below is
  // the only consumer, and it never runs for students.
  const cachedIdTokenRef = useCachedIdToken(isTeacher ? firebaseUser : null);
  const mainParticipant = useMainParticipant();
  const participants = useParticipants();
  const localParticipantNetworkQuality = useParticipantNetworkQualityLevel(room?.localParticipant ?? null);
  const isConnectivityDegraded =
    typeof localParticipantNetworkQuality === 'number' ? localParticipantNetworkQuality <= 2 : false;
  const notifications = useShellNotifications(participants);

  const toggleLeftRail = useCallback(() => {
    setLeftOpen(open => {
      const next = !open;
      if (next && isNarrowDesktop) setRightOpen(false);
      return next;
    });
  }, [isNarrowDesktop]);
  const openRightRail = useCallback(() => {
    if (isNarrowDesktop) setLeftOpen(false);
    setRightOpen(true);
  }, [isNarrowDesktop]);

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

  // Additional teacher-only beforeunload/pagehide listener: useRoom.tsx already
  // registers its own listener that disconnects the room, but never persists the
  // attention report — a tab close or refresh silently dropped it. This one, in
  // order: (1) synchronously snapshots the report into the localStorage retry
  // queue (guaranteed durability even if the fetch below never lands), then (2)
  // fires a best-effort keepalive POST with the id token cached by
  // useCachedIdToken (a synchronous handler can't await user.getIdToken()).
  // Latest-value refs (same idiom as useAttentionReportSaver/useSessionEnd) keep
  // the listener registered once while always reading fresh values.
  const isTeacherRef = useRef(isTeacher);
  isTeacherRef.current = isTeacher;
  const buildReportRef = useRef(buildReport);
  buildReportRef.current = buildReport;
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    const handleUnload = () => {
      if (!isTeacherRef.current) {
        return;
      }
      const report = buildReportRef.current('left');
      if (!report) {
        return;
      }

      const currentUser = userRef.current;
      savePendingAttentionReport(currentUser && 'uid' in currentUser ? currentUser.uid : undefined, report);

      const idToken = cachedIdTokenRef.current;
      if (!idToken) {
        return;
      }
      // Not awaited: keepalive lets the browser keep this request alive past
      // teardown. The localStorage queue above already guarantees no data loss
      // if this fails or never completes.
      fetch('/reports', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: idToken },
        body: JSON.stringify(report),
      }).catch(() => {
        // Swallowed: the pending-report queue is the source of truth for retry.
      });
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [cachedIdTokenRef]);

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
          ) : isTeacher ? (
            <ProfessorRoomShell
              stage={isGalleryViewActive ? <GalleryView /> : speakerViewStage}
              toolbarSlot={
                <ProfessorToolbar
                  proctoringEnabled={proctoringEnabled}
                  onProctoringChange={setProctoringEnabled}
                  participantsOpen={leftOpen}
                  onParticipantsToggle={toggleLeftRail}
                  chatOpen={rightOpen && professorTab === 'chat'}
                  onChatToggle={() => {
                    if (rightOpen && professorTab === 'chat') {
                      setRightOpen(false);
                    } else {
                      setProfessorTab('chat');
                      openRightRail();
                    }
                  }}
                  attentionOpen={rightOpen && professorTab !== 'chat'}
                  onAttentionToggle={() => {
                    if (rightOpen && professorTab !== 'chat') {
                      setRightOpen(false);
                    } else {
                      setProfessorTab('grupo');
                      openRightRail();
                    }
                  }}
                  onEndForAll={endSessionForAll}
                  onLeave={leaveWithoutEnding}
                />
              }
              leftOpen={leftOpen}
              rightOpen={rightOpen}
              onCloseLeft={() => setLeftOpen(false)}
              onCloseRight={() => setRightOpen(false)}
              rightTab={professorTab}
              onRightTabChange={setProfessorTab}
              rightPanel={professorTab === 'chat' ? <ChatWindow embedded isVisible /> : undefined}
              participants={[
                ...participants.map(p => ({ identity: p.identity })),
                { identity: room?.localParticipant?.identity || '', isLocal: true },
              ]}
              sessionLabel={sessionLabel}
              sessionName={room?.name || sessionLabel}
              participantCount={participantCount}
              recording={isRecording}
              handsRaised={raisedHands}
              onGrantTurn={grantTurn}
              onMuteParticipant={muteParticipant}
              onSendWarning={sendWarning}
              proctoringEnabled={proctoringEnabled}
              notifications={notifications}
            />
          ) : (
            <StudentRoomShell
              stage={isGalleryViewActive ? <GalleryView /> : speakerViewStage}
              toolbarSlot={
                <StudentRoomToolbar
                  handRaised={isHandRaised}
                  onHandRaisedChange={setHandRaised}
                  participantsOpen={leftOpen}
                  onParticipantsToggle={toggleLeftRail}
                  chatOpen={rightOpen}
                  onChatToggle={() => (rightOpen ? setRightOpen(false) : openRightRail())}
                />
              }
              activeSpeakerLabel={activeSpeakerLabel}
              sessionLabel={sessionLabel}
              sessionName={room?.name || sessionLabel}
              participantCount={participantCount}
              recording={isRecording}
              isConnectivityDegraded={isConnectivityDegraded}
              networkQualityLevel={localParticipantNetworkQuality}
              rightPanel={<ChatWindow embedded isVisible />}
              leftOpen={leftOpen}
              rightOpen={rightOpen}
              onCloseLeft={() => setLeftOpen(false)}
              onCloseRight={() => setRightOpen(false)}
              participants={[
                ...participants.map(p => ({ identity: p.identity, isOnline: true })),
                { identity: room?.localParticipant?.identity || '', isOnline: true, isLocal: true },
              ]}
            />
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
