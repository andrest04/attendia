import React from 'react';
import clsx from 'clsx';
import { Button, createStyles, makeStyles, Theme } from '@material-ui/core';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import PeopleAltIcon from '@material-ui/icons/PeopleAlt';
import ScreenShareIcon from '@material-ui/icons/ScreenShare';
import StopScreenShareIcon from '@material-ui/icons/StopScreenShare';
import { isMobile } from '../../../utils';
import useRoomState from '../../../hooks/useRoomState/useRoomState';
import useScreenShareParticipant from '../../../hooks/useScreenShareParticipant/useScreenShareParticipant';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';
import ChatIcon from '../../../icons/ChatIcon';
import ToggleAudioButton from '../../Buttons/ToggleAudioButton/ToggleAudioButton';
import ToggleVideoButton from '../../Buttons/ToggleVideoButton/ToggleVideoButton';
import ToolbarDeviceMenu from '../../Buttons/ToolbarDeviceMenu/ToolbarDeviceMenu';
import {
  SCREEN_SHARE_TEXT,
  STOP_SCREEN_SHARE_TEXT,
} from '../../Buttons/ToogleScreenShareButton/ToggleScreenShareButton';
import RaiseHandButton from '../../Buttons/RaiseHandButton/RaiseHandButton';
import EndCallButton from '../../Buttons/EndCallButton/EndCallButton';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    controlsRow: {
      display: 'flex',
      flexWrap: 'wrap',
      // stretch (not center) so every chip matches the tallest one's height — the round
      // icon buttons are taller than the text chips, so centering left them uneven.
      // Mirrors ProfessorToolbar so both shells share the same toolbar look.
      alignItems: 'stretch',
      justifyContent: 'center',
      gap: theme.spacing(1),
      width: '100%',
    },
    // Circular icon-only chip — identical to ProfessorToolbar so both shells share the
    // same Google Meet-style look: one uniform circle per control, no inner shape.
    chipLayout: {
      width: 44,
      height: 44,
      minWidth: 44,
      padding: 0,
      borderRadius: '50%',
      flexShrink: 0,
      '& .MuiButton-label': {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
      '& .MuiButton-startIcon': {
        margin: 0,
      },
      '& svg': {
        width: 20,
        height: 20,
      },
    },
    chipDark: {
      backgroundColor: 'rgba(255,255,255,0.08)',
      color: 'rgba(255,255,255,0.8)',
      '&:hover': {
        backgroundColor: 'rgba(255,255,255,0.14)',
      },
    },
    // Widens the circular chip into a pill for the leave control — mirrors ProfessorToolbar.
    endCallChip: {
      width: 'auto',
      minWidth: 110,
      padding: '0 20px',
      borderRadius: 22,
      backgroundColor: '#1d2f6f',
      color: '#ffffff',
      '&:hover': {
        backgroundColor: '#152356',
      },
    },
    divider: {
      width: 1,
      alignSelf: 'stretch',
      margin: theme.spacing(0.5),
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    // Groups a toggle (mic/camera) with its device-picker caret so the caret reads as
    // attached to the button, Google Meet-style. Mirrors ProfessorToolbar.
    deviceGroup: {
      display: 'flex',
      alignItems: 'center',
      gap: 1,
    },

    // ── Overflow ("more options") menu ──
    // Mirrors ProfessorToolbar's hand-rolled kebab so both shells share the same look.
    moreWrap: {
      position: 'relative',
      display: 'flex',
    },
    moreMenuBackdrop: {
      position: 'fixed',
      inset: 0,
      zIndex: 15,
    },
    '@keyframes moreMenuIn': {
      from: {
        opacity: 0,
        transform: 'translateY(6px) scale(0.96)',
      },
      to: {
        opacity: 1,
        transform: 'translateY(0) scale(1)',
      },
    },
    moreMenu: {
      position: 'absolute',
      bottom: '100%',
      right: 0,
      marginBottom: 8,
      zIndex: 16,
      minWidth: 210,
      backgroundColor: '#16255c',
      borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.12)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      overflow: 'hidden',
      padding: '6px 0',
      transformOrigin: 'bottom right',
      animation: '$moreMenuIn 150ms cubic-bezier(0.2, 0, 0.15, 1)',
      '@media (prefers-reduced-motion: reduce)': {
        animation: 'none',
      },
    },
    moreMenuItem: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      padding: '10px 14px',
      background: 'none',
      border: 'none',
      textAlign: 'left' as const,
      cursor: 'pointer',
      fontFamily: 'Inter, sans-serif',
      fontSize: 13,
      fontWeight: 500,
      color: 'rgba(255,255,255,0.85)',
      '&:hover': {
        backgroundColor: 'rgba(255,255,255,0.08)',
      },
      '&:disabled': {
        opacity: 0.5,
        cursor: 'default',
      },
    },
    moreMenuItemActive: {
      color: '#69a9ff',
    },
  })
);

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
  const classes = useStyles();
  const { toggleScreenShare, isSharingScreen } = useVideoContext();
  const screenShareParticipant = useScreenShareParticipant();
  const roomState = useRoomState();
  const isReconnecting = roomState === 'reconnecting';
  // Same gating as ToggleScreenShareButton: only someone ELSE's share blocks the control.
  const disableScreenShare = Boolean(screenShareParticipant) && !isSharingScreen;
  const isScreenShareSupported = Boolean(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  const chip = clsx(classes.chipLayout, classes.chipDark);

  // Screen share lives behind a "more options" kebab so the primary bar stays lean:
  // mic, camera, participants, chat, raise hand, leave.
  const [isMoreOpen, setIsMoreOpen] = React.useState(false);
  const closeMore = () => setIsMoreOpen(false);

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
        aria-label="Participantes"
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
        aria-label="Chat"
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

      {/* ── "More options" kebab: screen share ── */}
      <div className={classes.moreWrap}>
        <Button
          onClick={() => setIsMoreOpen(open => !open)}
          startIcon={<MoreVertIcon style={{ color: isMoreOpen ? '#1d6eed' : 'rgba(255,255,255,0.5)' }} />}
          className={chip}
          aria-label="Más"
          data-testid="student-toolbar-more"
          aria-haspopup="true"
          aria-expanded={isMoreOpen}
        />
        {isMoreOpen && (
          <>
            <div className={classes.moreMenuBackdrop} onClick={closeMore} />
            <div className={classes.moreMenu} data-testid="student-toolbar-more-menu" role="menu">
              {!isMobile && (
                <button
                  type="button"
                  className={clsx(classes.moreMenuItem, { [classes.moreMenuItemActive]: isSharingScreen })}
                  data-testid="student-toolbar-screenshare"
                  role="menuitemcheckbox"
                  disabled={isReconnecting || disableScreenShare || !isScreenShareSupported}
                  onClick={() => {
                    toggleScreenShare();
                    closeMore();
                  }}
                  aria-checked={isSharingScreen}
                >
                  {isSharingScreen ? (
                    <StopScreenShareIcon style={{ fontSize: 18 }} />
                  ) : (
                    <ScreenShareIcon style={{ fontSize: 18 }} />
                  )}
                  {isSharingScreen ? STOP_SCREEN_SHARE_TEXT : SCREEN_SHARE_TEXT}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div className={classes.divider} />
      <EndCallButton dark iconOnly className={clsx(classes.chipLayout, classes.endCallChip)} />
    </div>
  );
}
