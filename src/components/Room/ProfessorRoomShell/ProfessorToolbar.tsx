import React from 'react';
import clsx from 'clsx';
import { Button, createStyles, Hidden, makeStyles, Theme } from '@material-ui/core';
import CallEndIcon from '@material-ui/icons/CallEnd';
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord';
import VisibilityIcon from '@material-ui/icons/Visibility';
import ChatIcon from '../../../icons/ChatIcon';
import { isMobile } from '../../../utils';
import { useAppState } from '../../../state';
import useChatContext from '../../../hooks/useChatContext/useChatContext';
import useIsRecording from '../../../hooks/useIsRecording/useIsRecording';
import useRoomState from '../../../hooks/useRoomState/useRoomState';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';
import ToggleAudioButton from '../../Buttons/ToggleAudioButton/ToggleAudioButton';
import ToggleVideoButton from '../../Buttons/ToggleVideoButton/ToggleVideoButton';
import ToggleScreenShareButton from '../../Buttons/ToogleScreenShareButton/ToggleScreenShareButton';
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
    // Vertical "chip" layout: icon stacked on top of a small caption, matching the wireframe.
    chipLayout: {
      minWidth: 78,
      padding: theme.spacing(0.75, 1.25),
      borderRadius: 8,
      '& .MuiButton-label': {
        flexDirection: 'column',
        gap: 4,
        fontSize: 11,
        fontFamily: 'Poppins, Inter, sans-serif',
        fontWeight: 600,
        lineHeight: 1.2,
        textTransform: 'none',
      },
      '& .MuiButton-startIcon': {
        margin: 0,
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
      minWidth: 110,
      backgroundColor: '#1d2f6f',
      color: '#ffffff',
      '&:hover': {
        backgroundColor: '#152356',
      },
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
}

export default function ProfessorToolbar({
  proctoringEnabled = false,
  onProctoringChange,
  chatOpen = false,
  onChatToggle,
}: ProfessorToolbarProps = {}) {
  const classes = useStyles();
  const { isSharingScreen, room } = useVideoContext();
  const { conversation, hasUnreadMessages } = useChatContext();
  const { updateRecordingRules, isFetching, roomType } = useAppState();
  const isRecording = useIsRecording();
  const roomState = useRoomState();
  const isReconnecting = roomState === 'reconnecting';
  // Recording rules only exist for group rooms (same gate as the legacy menu).
  const supportsRecording = roomType !== 'peer-to-peer' && roomType !== 'go';
  const chip = clsx(classes.chipLayout, classes.chipDark);

  return (
    <div className={classes.controlsRow} data-testid="professor-toolbar">
      <ToggleAudioButton disabled={isReconnecting} className={chip} />
      <ToggleVideoButton disabled={isReconnecting} className={chip} />
      {!isSharingScreen && !isMobile && <ToggleScreenShareButton disabled={isReconnecting} className={chip} />}
      {/* ChatIcon paints with currentColor, so the active tint lives on the wrapper div. */}
      <Button
        onClick={() => onChatToggle?.()}
        disabled={!conversation}
        startIcon={
          <div className={classes.chatIconContainer} style={{ color: chatOpen ? '#1d6eed' : 'rgba(255,255,255,0.5)' }}>
            <ChatIcon />
            {hasUnreadMessages && <span className={classes.unreadDot} data-testid="professor-toolbar-chat-unread" />}
          </div>
        }
        className={chip}
        data-testid="professor-toolbar-chat"
        aria-pressed={chatOpen}
      >
        Chat
      </Button>
      {supportsRecording && (
        <Button
          onClick={() => updateRecordingRules(room!.sid, [{ type: isRecording ? 'exclude' : 'include', all: true }])}
          disabled={isFetching || !room}
          startIcon={<FiberManualRecordIcon style={{ color: isRecording ? '#ef4444' : 'rgba(255,255,255,0.5)' }} />}
          className={clsx(classes.chipLayout, isRecording ? classes.chipRecActive : classes.chipDark)}
          data-testid="professor-toolbar-record"
          aria-pressed={isRecording}
        >
          {isRecording ? 'Detener REC' : 'Grabar'}
        </Button>
      )}
      <Button
        onClick={() => onProctoringChange?.(!proctoringEnabled)}
        startIcon={<VisibilityIcon style={{ color: proctoringEnabled ? '#1d6eed' : 'rgba(255,255,255,0.5)' }} />}
        className={chip}
        data-testid="professor-toolbar-proctoring"
        aria-pressed={proctoringEnabled}
      >
        Proctoring
      </Button>
      <Hidden smDown>
        <span className={classes.divider} />
        <EndCallButton
          dark
          startIcon={<CallEndIcon />}
          label="Terminar sesión"
          className={clsx(classes.chipLayout, classes.endCallChip)}
        />
      </Hidden>
    </div>
  );
}
