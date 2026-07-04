import React from 'react';
import clsx from 'clsx';
import { Button, createStyles, Hidden, makeStyles, Theme } from '@material-ui/core';
import CallEndIcon from '@material-ui/icons/CallEnd';
import DonutLargeIcon from '@material-ui/icons/DonutLarge';
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import PeopleAltIcon from '@material-ui/icons/PeopleAlt';
import ScreenShareIcon from '@material-ui/icons/ScreenShare';
import StopScreenShareIcon from '@material-ui/icons/StopScreenShare';
import VisibilityIcon from '@material-ui/icons/Visibility';
import ChatIcon from '../../../icons/ChatIcon';
import { isMobile } from '../../../utils';
import { useAppState } from '../../../state';
import useChatContext from '../../../hooks/useChatContext/useChatContext';
import useIsRecording from '../../../hooks/useIsRecording/useIsRecording';
import useRoomState from '../../../hooks/useRoomState/useRoomState';
import useScreenShareParticipant from '../../../hooks/useScreenShareParticipant/useScreenShareParticipant';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';
import ToggleAudioButton from '../../Buttons/ToggleAudioButton/ToggleAudioButton';
import ToggleVideoButton from '../../Buttons/ToggleVideoButton/ToggleVideoButton';
import ToolbarDeviceMenu from '../../Buttons/ToolbarDeviceMenu/ToolbarDeviceMenu';
import {
  SCREEN_SHARE_TEXT,
  STOP_SCREEN_SHARE_TEXT,
} from '../../Buttons/ToogleScreenShareButton/ToggleScreenShareButton';
import EndCallButton from '../../Buttons/EndCallButton/EndCallButton';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    controlsRow: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      justifyContent: 'center',
      gap: theme.spacing(1),
      width: '100%',
    },
    // Circular icon-only chip — Google Meet-style: one uniform circle per control, icon
    // centred, no separate inner shape. `endCallChip` below widens this into a pill.
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
    chipRecActive: {
      backgroundColor: 'rgba(239,68,68,0.15)',
      color: '#ef4444',
      border: '1px solid rgba(239,68,68,0.3)',
      '&:hover': {
        backgroundColor: 'rgba(239,68,68,0.22)',
      },
    },
    divider: {
      width: 1,
      alignSelf: 'stretch',
      margin: theme.spacing(0.5),
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    // Groups a toggle (mic/camera) with its device-picker caret so the caret reads as
    // attached to the button, Google Meet-style, while the row gap separates groups.
    deviceGroup: {
      display: 'flex',
      alignItems: 'center',
      gap: 1,
    },
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

    // ── Overflow ("more options") menu ──
    // Hand-rolled (not MUI Menu) to stay portal-free and trivially testable, mirroring
    // the roster moderation kebab in ProfessorRoomShell.
    moreWrap: {
      position: 'relative',
      display: 'flex',
    },
    moreMenuBackdrop: {
      position: 'fixed',
      inset: 0,
      zIndex: 15,
    },
    // Entry animation for the overflow menu: fade + subtle rise/scale from the
    // bottom-right corner (where the kebab sits), so opening feels smooth, not abrupt.
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
      // Toolbar sits at the bottom of the stage, so the menu opens upward.
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
      // Respect users who ask the OS to minimize motion.
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
    // Active tint for stateful items (recording on / proctoring on).
    moreMenuItemRecActive: {
      color: '#ef4444',
    },
    moreMenuItemProctoringActive: {
      color: '#69a9ff',
    },
    moreMenuDivider: {
      height: 1,
      margin: '6px 0',
      backgroundColor: 'rgba(255,255,255,0.1)',
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
  const { room, toggleScreenShare, isSharingScreen } = useVideoContext();
  const screenShareParticipant = useScreenShareParticipant();
  const { conversation, hasUnreadMessages } = useChatContext();
  const { updateRecordingRules, isFetching, roomType } = useAppState();
  const isRecording = useIsRecording();
  const roomState = useRoomState();
  const isReconnecting = roomState === 'reconnecting';
  // Recording rules only exist for group rooms (same gate as the legacy menu).
  const supportsRecording = roomType !== 'peer-to-peer' && roomType !== 'go';
  // Same gating as ToggleScreenShareButton: only someone ELSE's share blocks the control.
  const disableScreenShare = Boolean(screenShareParticipant) && !isSharingScreen;
  const isScreenShareSupported = Boolean(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  const chip = clsx(classes.chipLayout, classes.chipDark);

  // Secondary controls (screen share, record, proctoring) live behind a "more options"
  // kebab so the primary bar stays lean: mic, camera, participants, chat, leave.
  const [isMoreOpen, setIsMoreOpen] = React.useState(false);
  const closeMore = () => setIsMoreOpen(false);

  return (
    <div className={classes.controlsRow} data-testid="professor-toolbar">
      <div className={classes.deviceGroup}>
        <ToggleAudioButton disabled={isReconnecting} className={chip} iconOnly plain />
        <ToolbarDeviceMenu kind="audio" disabled={isReconnecting} data-testid="professor-toolbar-audio-devices" />
      </div>
      <div className={classes.deviceGroup}>
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

      {/* ── "More options" kebab: screen share, record, proctoring ── */}
      <div className={classes.moreWrap}>
        <Button
          onClick={() => setIsMoreOpen(open => !open)}
          startIcon={<MoreVertIcon style={{ color: isMoreOpen ? '#1d6eed' : 'rgba(255,255,255,0.5)' }} />}
          className={chip}
          aria-label="Más"
          data-testid="professor-toolbar-more"
          aria-haspopup="true"
          aria-expanded={isMoreOpen}
        />
        {isMoreOpen && (
          <>
            <div className={classes.moreMenuBackdrop} onClick={closeMore} />
            <div className={classes.moreMenu} data-testid="professor-toolbar-more-menu" role="menu">
              {/* Screen share moved out of the primary bar; the kebab is its only entry point. */}
              {!isMobile && (
                <>
                  <button
                    type="button"
                    className={clsx(classes.moreMenuItem, { [classes.moreMenuItemProctoringActive]: isSharingScreen })}
                    data-testid="professor-toolbar-screenshare"
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

                  <div className={classes.moreMenuDivider} />
                </>
              )}

              {/* Opens the analytics rail (Grupo/Individual) — the attention cockpit. */}
              <button
                type="button"
                className={clsx(classes.moreMenuItem, { [classes.moreMenuItemProctoringActive]: attentionOpen })}
                data-testid="professor-toolbar-attention"
                role="menuitemcheckbox"
                onClick={() => {
                  onAttentionToggle?.();
                  closeMore();
                }}
                aria-checked={attentionOpen}
              >
                <DonutLargeIcon style={{ fontSize: 18 }} />
                {attentionOpen ? 'Ocultar atención' : 'Panel de atención'}
              </button>

              <div className={classes.moreMenuDivider} />

              {supportsRecording && (
                <button
                  type="button"
                  className={clsx(classes.moreMenuItem, { [classes.moreMenuItemRecActive]: isRecording })}
                  data-testid="professor-toolbar-record"
                  role="menuitemcheckbox"
                  disabled={isFetching || !room}
                  onClick={() => {
                    updateRecordingRules(room!.sid, [{ type: isRecording ? 'exclude' : 'include', all: true }]);
                    closeMore();
                  }}
                  aria-checked={isRecording}
                >
                  <FiberManualRecordIcon style={{ fontSize: 18 }} />
                  {isRecording ? 'Detener grabación' : 'Grabar'}
                </button>
              )}

              <div className={classes.moreMenuDivider} />

              <button
                type="button"
                className={clsx(classes.moreMenuItem, { [classes.moreMenuItemProctoringActive]: proctoringEnabled })}
                data-testid="professor-toolbar-proctoring"
                role="menuitemcheckbox"
                onClick={() => {
                  onProctoringChange?.(!proctoringEnabled);
                  closeMore();
                }}
                aria-checked={proctoringEnabled}
              >
                <VisibilityIcon style={{ fontSize: 18 }} />
                {proctoringEnabled ? 'Proctoring activo' : 'Proctoring'}
              </button>
            </div>
          </>
        )}
      </div>

      <Hidden smDown>
        <span className={classes.divider} />
        <EndCallButton
          dark
          startIcon={<CallEndIcon />}
          label="Terminar sesión"
          iconOnly
          className={clsx(classes.chipLayout, classes.endCallChip)}
          onEndForAll={onEndForAll}
          onLeave={onLeave}
        />
      </Hidden>
    </div>
  );
}
