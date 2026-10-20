import React, { useState, useRef } from 'react';
import AboutDialog from '../../AboutDialog/AboutDialog';
import BackgroundIcon from '../../../icons/BackgroundIcon';
import CollaborationViewIcon from '@material-ui/icons/AccountBox';
import DeviceSelectionDialog from '../../DeviceSelectionDialog/DeviceSelectionDialog';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import GridViewIcon from '@material-ui/icons/Apps';
import InfoIconOutlined from '../../../icons/InfoIconOutlined';
import MoreIcon from '@material-ui/icons/MoreVert';
import StartRecordingIcon from '../../../icons/StartRecordingIcon';
import StopRecordingIcon from '../../../icons/StopRecordingIcon';
import SearchIcon from '@material-ui/icons/Search';
import SettingsIcon from '../../../icons/SettingsIcon';
import { Button, styled, Theme, useMediaQuery, Menu as MenuContainer, MenuItem, Typography } from '@material-ui/core';
import { isSupported } from '@twilio/video-processors';

import { useAppState } from '../../../state';
import useChatContext from '../../../hooks/useChatContext/useChatContext';
import { useSessionEndApi } from '../../../hooks/useSessionEnd/sessionEndContext';
import useRecordingToggle from '../../../hooks/useRecordingToggle/useRecordingToggle';
import { isTeacherIdentity } from '../../../classSession/classSessionTypes';
import useVideoContext from '../../../hooks/useVideoContext/useVideoContext';
import FlipCameraIcon from '../../../icons/FlipCameraIcon';
import useFlipCameraToggle from '../../../hooks/useFlipCameraToggle/useFlipCameraToggle';
import { VideoRoomMonitor } from '@twilio/video-room-monitor';

export const IconContainer = styled('div')({
  display: 'flex',
  justifyContent: 'center',
  width: '1.5em',
  marginRight: '0.3em',
});

export default function Menu(props: { buttonClassName?: string }) {
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'));

  const [aboutOpen, setAboutOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { setIsGalleryViewActive, isGalleryViewActive } = useAppState();
  const { setIsChatWindowOpen } = useChatContext();
  const {
    supported: supportsRecording,
    isRecording,
    busy: isRecordingBusy,
    toggle: toggleRecording,
  } = useRecordingToggle();
  const { setIsBackgroundSelectionOpen, room } = useVideoContext();
  // Recording rules are teacher-only on the server too; hide the item for everyone else.
  // Recording is owner-only: a confirmed co-teacher (published by Room) does not get it either.
  const isCoTeacher = useSessionEndApi()?.isCoTeacher ?? false;
  const canRecord = supportsRecording && isTeacherIdentity(room?.localParticipant?.identity) && !isCoTeacher;

  const anchorRef = useRef<HTMLButtonElement>(null);
  const { flipCameraDisabled, toggleFacingMode, flipCameraSupported } = useFlipCameraToggle();

  return (
    <>
      <Button
        onClick={() => setMenuOpen(isOpen => !isOpen)}
        ref={anchorRef}
        className={props.buttonClassName}
        data-cy-more-button
      >
        {isMobile ? (
          <MoreIcon />
        ) : (
          <>
            Más
            <ExpandMoreIcon />
          </>
        )}
      </Button>
      <MenuContainer
        open={menuOpen}
        onClose={() => setMenuOpen(isOpen => !isOpen)}
        anchorEl={anchorRef.current}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: isMobile ? -55 : 'bottom',
          horizontal: 'center',
        }}
      >
        <MenuItem onClick={() => setSettingsOpen(true)}>
          <IconContainer>
            <SettingsIcon />
          </IconContainer>
          <Typography variant="body1">Configuración de audio y video</Typography>
        </MenuItem>

        {isSupported && (
          <MenuItem
            onClick={() => {
              setIsBackgroundSelectionOpen(true);
              setIsChatWindowOpen(false);
              setMenuOpen(false);
            }}
          >
            <IconContainer>
              <BackgroundIcon />
            </IconContainer>
            <Typography variant="body1">Fondos</Typography>
          </MenuItem>
        )}

        {flipCameraSupported && (
          <MenuItem disabled={flipCameraDisabled} onClick={toggleFacingMode}>
            <IconContainer>
              <FlipCameraIcon />
            </IconContainer>
            <Typography variant="body1">Girar cámara</Typography>
          </MenuItem>
        )}

        {canRecord && (
          <MenuItem
            disabled={isRecordingBusy}
            onClick={() => {
              setMenuOpen(false);
              toggleRecording();
            }}
            data-cy-recording-button
          >
            <IconContainer>{isRecording ? <StopRecordingIcon /> : <StartRecordingIcon />}</IconContainer>
            <Typography variant="body1">{isRecording ? 'Detener grabación' : 'Iniciar grabación'}</Typography>
          </MenuItem>
        )}

        <MenuItem
          onClick={() => {
            VideoRoomMonitor.toggleMonitor();
            setMenuOpen(false);
          }}
        >
          <IconContainer>
            <SearchIcon style={{ fill: '#707578', width: '0.9em' }} />
          </IconContainer>
          <Typography variant="body1">Monitor de sala</Typography>
        </MenuItem>

        <MenuItem
          onClick={() => {
            setIsGalleryViewActive(isGallery => !isGallery);
            setMenuOpen(false);
          }}
        >
          <IconContainer>
            {isGalleryViewActive ? (
              <CollaborationViewIcon style={{ fill: '#707578', width: '0.9em' }} />
            ) : (
              <GridViewIcon style={{ fill: '#707578', width: '0.9em' }} />
            )}
          </IconContainer>
          <Typography variant="body1">{isGalleryViewActive ? 'Vista de orador' : 'Vista de galería'}</Typography>
        </MenuItem>

        <MenuItem onClick={() => setAboutOpen(true)}>
          <IconContainer>
            <InfoIconOutlined />
          </IconContainer>
          <Typography variant="body1">Acerca de</Typography>
        </MenuItem>
      </MenuContainer>
      <AboutDialog
        open={aboutOpen}
        onClose={() => {
          setAboutOpen(false);
          setMenuOpen(false);
        }}
      />
      <DeviceSelectionDialog
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          setMenuOpen(false);
        }}
      />
    </>
  );
}
