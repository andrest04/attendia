import React from 'react';
import { Button, createStyles, makeStyles, Theme } from '@material-ui/core';
import CallEndIcon from '@material-ui/icons/CallEnd';
import DonutLargeIcon from '@material-ui/icons/DonutLarge';
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import PeopleAltIcon from '@material-ui/icons/PeopleAlt';
import ScreenShareIcon from '@material-ui/icons/ScreenShare';
import StopScreenShareIcon from '@material-ui/icons/StopScreenShare';
import VisibilityIcon from '@material-ui/icons/Visibility';
import ChatIcon from '../../../icons/ChatIcon';
import { isMobile } from '../../../utils';
import useChatContext from '../../../hooks/useChatContext/useChatContext';
import useRecordingToggle from '../../../hooks/useRecordingToggle/useRecordingToggle';
import useScreenShareControl from '../../../hooks/useScreenShareControl/useScreenShareControl';
import useRoomState from '../../../hooks/useRoomState/useRoomState';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';
import ToggleAudioButton from '../../Buttons/ToggleAudioButton/ToggleAudioButton';
import ToggleVideoButton from '../../Buttons/ToggleVideoButton/ToggleVideoButton';
import ToolbarDeviceMenu from '../../Buttons/ToolbarDeviceMenu/ToolbarDeviceMenu';
import {
  SCREEN_SHARE_TEXT,
  STOP_SCREEN_SHARE_TEXT,
} from '../../Buttons/ToogleScreenShareButton/ToggleScreenShareButton';
import EndCallButton from '../../Buttons/EndCallButton/EndCallButton';
import OverflowMenu, { OverflowMenuItem } from '../ToolbarParts/OverflowMenu';
import useToolbarChipStyles from '../ToolbarParts/useToolbarChipStyles';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    // Groups the participants + chat chips so the onboarding tour can spotlight
    // both panel-opening controls as one zone. Layout-neutral: same gap as the row.
    panelsGroup: {
      display: 'flex',
      alignItems: 'stretch',
      gap: theme.spacing(1),
    },
    chatIconContainer: {
      position: 'relative',
      display: 'flex',
    },
    unreadDot: {
      width: 9,
      height: 9,
      backgroundColor: '#5BB75B',
      borderRadius: '50%',
      position: 'absolute',
      top: -2,
      right: -4,
    },
  })
);

interface ProfessorToolbarProps {
  /** Proctoring monitoring state. Local-only stub until the CV pipeline lands (US30). */
  proctoringEnabled?: boolean;
  onProctoringChange?: (next: boolean) => void;
  /** Whether the chat tab is active in the right rail. Driven by Room.tsx. */
  chatOpen?: boolean;
  onChatToggle?: () => void;
  /** Whether the left (Participantes) rail is open. Driven by Room.tsx. */
  participantsOpen?: boolean;
  onParticipantsToggle?: () => void;
  /** Whether the right rail is open on an analytics tab (grupo/individual). Driven by Room.tsx. */
  attentionOpen?: boolean;
  onAttentionToggle?: () => void;
  /** Teacher-only: end the session for everyone (completes the room). Opens a confirm dialog. */
  onEndForAll?: () => void;
  /** Teacher-only: leave without closing the class (snapshots the attention report first). */
  onLeave?: () => void;
}

export default function ProfessorToolbar({
  proctoringEnabled = false,
  onProctoringChange,
  chatOpen = false,
  onChatToggle,
  participantsOpen = false,
  onParticipantsToggle,
  attentionOpen = false,
  onAttentionToggle,
  onEndForAll,
  onLeave,
}: ProfessorToolbarProps = {}) {
  const classes = useStyles();
  const { classes: toolbar, chip, endCallChip } = useToolbarChipStyles();
  const { room } = useVideoContext();
  const { toggleScreenShare, isSharingScreen, disabled: screenShareUnavailable } = useScreenShareControl();
  const { conversation, hasUnreadMessages } = useChatContext();
  const {
    supported: supportsRecording,
    isRecording,
    busy: isRecordingBusy,
    toggle: toggleRecording,
  } = useRecordingToggle();
  const roomState = useRoomState();
  const isReconnecting = roomState === 'reconnecting';

  // Secondary controls (screen share, attention panel, record, proctoring) live behind a
  // "more options" kebab so the primary bar stays lean: mic, camera, participants, chat, leave.
  const moreItems: OverflowMenuItem[] = [
    // Screen share moved out of the primary bar; the kebab is its only entry point.
    {
      testId: 'professor-toolbar-screenshare',
      label: isSharingScreen ? STOP_SCREEN_SHARE_TEXT : SCREEN_SHARE_TEXT,
      icon: isSharingScreen ? (
        <StopScreenShareIcon style={{ fontSize: 18 }} />
      ) : (
        <ScreenShareIcon style={{ fontSize: 18 }} />
      ),
      checked: isSharingScreen,
      tone: 'accent',
      disabled: isReconnecting || screenShareUnavailable,
      hidden: isMobile,
      onSelect: toggleScreenShare,
    },
    // Opens the analytics rail (Grupo/Individual) — the attention cockpit.
    {
      testId: 'professor-toolbar-attention',
      label: attentionOpen ? 'Ocultar atención' : 'Panel de atención',
      icon: <DonutLargeIcon style={{ fontSize: 18 }} />,
      checked: attentionOpen,
      tone: 'accent',
      onSelect: () => onAttentionToggle?.(),
    },
    {
      testId: 'professor-toolbar-record',
      label: isRecording ? 'Detener grabación' : 'Grabar',
      icon: <FiberManualRecordIcon style={{ fontSize: 18 }} />,
      checked: isRecording,
      tone: 'recording',
      disabled: isRecordingBusy || !room,
      hidden: !supportsRecording,
      onSelect: toggleRecording,
    },
    {
      testId: 'professor-toolbar-proctoring',
      label: proctoringEnabled ? 'Proctoring activo' : 'Proctoring',
      icon: <VisibilityIcon style={{ fontSize: 18 }} />,
      checked: proctoringEnabled,
      tone: 'accent',
      onSelect: () => onProctoringChange?.(!proctoringEnabled),
    },
  ];

  return (
    <div className={toolbar.controlsRow} data-testid="professor-toolbar">
      <div className={toolbar.deviceGroup}>
        <ToggleAudioButton disabled={isReconnecting} className={chip} iconOnly plain />
        <ToolbarDeviceMenu kind="audio" disabled={isReconnecting} data-testid="professor-toolbar-audio-devices" />
      </div>
      <div className={toolbar.deviceGroup}>
        <ToggleVideoButton disabled={isReconnecting} className={chip} iconOnly plain />
        <ToolbarDeviceMenu kind="video" disabled={isReconnecting} data-testid="professor-toolbar-video-devices" />
      </div>
      <div className={classes.panelsGroup} data-testid="professor-toolbar-panels">
        <Button
          onClick={() => onParticipantsToggle?.()}
          startIcon={<PeopleAltIcon style={{ color: participantsOpen ? '#1d6eed' : 'rgba(255,255,255,0.5)' }} />}
          className={chip}
          aria-label="Participantes"
          data-testid="professor-toolbar-participants"
          aria-pressed={participantsOpen}
        />
        {/* ChatIcon paints with currentColor, so the active tint lives on the wrapper div. */}
        <Button
          onClick={() => onChatToggle?.()}
          disabled={!conversation}
          startIcon={
            <div
              className={classes.chatIconContainer}
              style={{ color: chatOpen ? '#1d6eed' : 'rgba(255,255,255,0.5)' }}
            >
              <ChatIcon />
              {hasUnreadMessages && <span className={classes.unreadDot} data-testid="professor-toolbar-chat-unread" />}
            </div>
          }
          className={chip}
          aria-label="Chat"
          data-testid="professor-toolbar-chat"
          aria-pressed={chatOpen}
        />
      </div>

      <OverflowMenu items={moreItems} testIdPrefix="professor-toolbar" chipClassName={chip} />

      <span className={toolbar.divider} />
      <EndCallButton
        dark
        startIcon={<CallEndIcon />}
        label="Terminar sesión"
        iconOnly
        className={endCallChip}
        onEndForAll={onEndForAll}
        onLeave={onLeave}
      />
    </div>
  );
}
