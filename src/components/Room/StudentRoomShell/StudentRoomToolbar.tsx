import React from 'react';
import { Button } from '@material-ui/core';
import PeopleAltIcon from '@material-ui/icons/PeopleAlt';
import ScreenShareIcon from '@material-ui/icons/ScreenShare';
import StopScreenShareIcon from '@material-ui/icons/StopScreenShare';
import { isMobile } from '../../../utils';
import useRoomState from '../../../hooks/useRoomState/useRoomState';
import useScreenShareControl from '../../../hooks/useScreenShareControl/useScreenShareControl';
import ChatIcon from '../../../icons/ChatIcon';
import ToggleAudioButton from '../../Buttons/ToggleAudioButton/ToggleAudioButton';
import ToggleVideoButton from '../../Buttons/ToggleVideoButton/ToggleVideoButton';
import ToolbarDeviceMenu from '../../Buttons/ToolbarDeviceMenu/ToolbarDeviceMenu';
import {
  SCREEN_SHARE_TEXT,
  SHARE_LOCKED_TEXT,
  STOP_SCREEN_SHARE_TEXT,
} from '../../Buttons/ToogleScreenShareButton/ToggleScreenShareButton';
import RaiseHandButton from '../../Buttons/RaiseHandButton/RaiseHandButton';
import EndCallButton from '../../Buttons/EndCallButton/EndCallButton';
import OverflowMenu, { OverflowMenuItem } from '../ToolbarParts/OverflowMenu';
import LanguageSwitch from '../../LanguageSwitch/LanguageSwitch';
import { t } from '../../../i18n/translate';
import useToolbarChipStyles from '../ToolbarParts/useToolbarChipStyles';

interface StudentRoomToolbarProps {
  handRaised?: boolean;
  onHandRaisedChange?: (next: boolean) => void;
  /** Whether the left (Participantes) rail is open. Driven by Room.tsx. */
  participantsOpen?: boolean;
  onParticipantsToggle?: () => void;
  /** Whether the right (chat) rail is open. Driven by Room.tsx. */
  chatOpen?: boolean;
  onChatToggle?: () => void;
}

export default function StudentRoomToolbar({
  handRaised,
  onHandRaisedChange,
  participantsOpen = false,
  onParticipantsToggle,
  chatOpen = false,
  onChatToggle,
}: StudentRoomToolbarProps = {}) {
  const { classes, chip, endCallChip } = useToolbarChipStyles();
  const {
    toggleScreenShare,
    isSharingScreen,
    lockedByTeacher,
    disabled: screenShareUnavailable,
  } = useScreenShareControl();
  const roomState = useRoomState();
  const isReconnecting = roomState === 'reconnecting';

  // Screen share lives behind a "more options" kebab so the primary bar stays lean:
  // mic, camera, participants, chat, raise hand, leave.
  const moreItems: OverflowMenuItem[] = [
    {
      testId: 'student-toolbar-screenshare',
      label: t(lockedByTeacher ? SHARE_LOCKED_TEXT : isSharingScreen ? STOP_SCREEN_SHARE_TEXT : SCREEN_SHARE_TEXT),
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
  ];

  return (
    <div className={classes.controlsRow} data-testid="student-room-toolbar">
      <div className={classes.deviceGroup}>
        <ToggleAudioButton disabled={isReconnecting} className={chip} iconOnly plain />
        <ToolbarDeviceMenu kind="audio" disabled={isReconnecting} data-testid="student-toolbar-audio-devices" />
      </div>
      <div className={classes.deviceGroup}>
        <ToggleVideoButton disabled={isReconnecting} className={chip} iconOnly plain />
        <ToolbarDeviceMenu kind="video" disabled={isReconnecting} data-testid="student-toolbar-video-devices" />
      </div>
      <Button
        onClick={() => onParticipantsToggle?.()}
        startIcon={<PeopleAltIcon style={{ color: participantsOpen ? '#1d6eed' : 'rgba(255,255,255,0.5)' }} />}
        className={chip}
        aria-label={t('Participantes')}
        data-testid="student-toolbar-participants"
        aria-pressed={participantsOpen}
      />
      {/* ChatIcon paints with currentColor, so the active tint lives on the wrapper div. */}
      <Button
        onClick={() => onChatToggle?.()}
        startIcon={
          <div style={{ display: 'flex', color: chatOpen ? '#1d6eed' : 'rgba(255,255,255,0.5)' }}>
            <ChatIcon />
          </div>
        }
        className={chip}
        aria-label={t('Chat')}
        data-testid="student-toolbar-chat"
        aria-pressed={chatOpen}
      />
      <RaiseHandButton
        handRaised={handRaised}
        onHandRaisedChange={onHandRaisedChange}
        className={chip}
        iconOnly
        plain
      />

      <OverflowMenu items={moreItems} testIdPrefix="student-toolbar" chipClassName={chip} />

      <LanguageSwitch tone="dark" />
      <div className={classes.divider} />
      <EndCallButton dark iconOnly className={endCallChip} />
    </div>
  );
}
