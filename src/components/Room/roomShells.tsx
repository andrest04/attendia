import React from 'react';
import { Participant } from 'twilio-video';
import ChatWindow from '../ChatWindow/ChatWindow';
import useRaiseHand from '../../hooks/useRaiseHand/useRaiseHand';
import useModeration from '../../hooks/useModeration/useModeration';
import useProctoringWarnings from '../../hooks/useProctoringWarnings/useProctoringWarnings';
import useSessionEnd from '../../hooks/useSessionEnd/useSessionEnd';
import StudentRoomShell, { StudentRoomToolbar } from './StudentRoomShell';
import ProfessorRoomShell, { ProfessorToolbar } from './ProfessorRoomShell';
import { ShellNotification } from './shellNotification';
import { useRoomLayout } from './roomLayout';

export type RoomShellRole = 'teacher' | 'student';

/** Everything a desktop shell needs from the room session, grouped by concern. */
export interface RoomShellContext {
  /** GalleryView or the speaker-view stage, resolved by the room. */
  stage: React.ReactNode;
  session: {
    name: string;
    label: string;
    /** Includes the local participant. */
    participantCount: number;
    recording: boolean;
  };
  /** Remote participants, in room order. */
  participants: Participant[];
  localIdentity: string;
  layout: ReturnType<typeof useRoomLayout>;
  hands: Pick<ReturnType<typeof useRaiseHand>, 'raisedHands' | 'isHandRaised' | 'setHandRaised' | 'grantTurn'>;
  moderation: Pick<ReturnType<typeof useModeration>, 'muteParticipant'> &
    Pick<ReturnType<typeof useProctoringWarnings>, 'sendWarning'>;
  proctoring: { enabled: boolean; setEnabled: (next: boolean) => void };
  notifications: ShellNotification[];
  sessionEnd: Pick<ReturnType<typeof useSessionEnd>, 'endSessionForAll' | 'leaveWithoutEnding' | 'isEnding'>;
  connection: {
    isDegraded: boolean;
    /** Twilio network quality level (0–5) of the local participant; null/undefined = unknown. */
    networkQualityLevel: number | null | undefined;
  };
  activeSpeakerLabel: string;
}

const professorShell = (ctx: RoomShellContext) => {
  const { layout, hands, moderation, proctoring, sessionEnd, session } = ctx;
  const chatOpen = layout.rightOpen && layout.rightTab === 'chat';
  const attentionOpen = layout.rightOpen && layout.rightTab !== 'chat';
  return (
    <ProfessorRoomShell
      stage={ctx.stage}
      toolbarSlot={
        <ProfessorToolbar
          proctoringEnabled={proctoring.enabled}
          onProctoringChange={proctoring.setEnabled}
          participantsOpen={layout.leftOpen}
          onParticipantsToggle={layout.toggleLeft}
          chatOpen={chatOpen}
          onChatToggle={() => layout.toggleRight('chat')}
          attentionOpen={attentionOpen}
          onAttentionToggle={() => layout.toggleRight('attention')}
          onEndForAll={sessionEnd.endSessionForAll}
          onLeave={sessionEnd.leaveWithoutEnding}
          isEnding={sessionEnd.isEnding}
        />
      }
      leftOpen={layout.leftOpen}
      rightOpen={layout.rightOpen}
      onCloseLeft={layout.closeLeft}
      onCloseRight={layout.closeRight}
      rightTab={layout.rightTab}
      onRightTabChange={layout.setRightTab}
      rightPanel={layout.rightTab === 'chat' ? <ChatWindow embedded isVisible /> : undefined}
      participants={[
        ...ctx.participants.map(p => ({ identity: p.identity })),
        { identity: ctx.localIdentity, isLocal: true },
      ]}
      sessionLabel={session.label}
      sessionName={session.name}
      participantCount={session.participantCount}
      recording={session.recording}
      handsRaised={hands.raisedHands}
      onGrantTurn={hands.grantTurn}
      onMuteParticipant={moderation.muteParticipant}
      onSendWarning={moderation.sendWarning}
      proctoringEnabled={proctoring.enabled}
      notifications={ctx.notifications}
    />
  );
};

const studentShell = (ctx: RoomShellContext) => {
  const { layout, hands, session, connection } = ctx;
  return (
    <StudentRoomShell
      stage={ctx.stage}
      toolbarSlot={
        <StudentRoomToolbar
          handRaised={hands.isHandRaised}
          onHandRaisedChange={hands.setHandRaised}
          participantsOpen={layout.leftOpen}
          onParticipantsToggle={layout.toggleLeft}
          chatOpen={layout.rightOpen}
          onChatToggle={() => layout.toggleRight()}
        />
      }
      activeSpeakerLabel={ctx.activeSpeakerLabel}
      sessionLabel={session.label}
      sessionName={session.name}
      participantCount={session.participantCount}
      recording={session.recording}
      isConnectivityDegraded={connection.isDegraded}
      networkQualityLevel={connection.networkQualityLevel}
      rightPanel={<ChatWindow embedded isVisible />}
      leftOpen={layout.leftOpen}
      rightOpen={layout.rightOpen}
      onCloseLeft={layout.closeLeft}
      onCloseRight={layout.closeRight}
      participants={[
        ...ctx.participants.map(p => ({ identity: p.identity, isOnline: true })),
        { identity: ctx.localIdentity, isOnline: true, isLocal: true },
      ]}
    />
  );
};

/**
 * Abstract Factory of the desktop shells: each role builds its whole family — the shell and the
 * toolbar that goes in its footer — from the same room context, so the pairing can never be
 * mixed up. Plain functions on purpose (not wrapper components): the room renders the returned
 * element directly, so the shell stays a direct child of Room in the tree.
 */
export const roomShellFactory: Record<RoomShellRole, (ctx: RoomShellContext) => React.ReactElement> = {
  teacher: professorShell,
  student: studentShell,
};
