import React, { ReactNode, useCallback, useMemo, useState } from 'react';
import { ConnectOptions, LocalVideoTrack } from 'twilio-video';
import { ErrorCallback } from '../../types';
import { VideoContext } from './videoContext';
import { SelectedParticipantProvider } from './useSelectedParticipant/useSelectedParticipant';

import AttachVisibilityHandler from './AttachVisibilityHandler/AttachVisibilityHandler';
import useBackgroundSettings from './useBackgroundSettings/useBackgroundSettings';
import useHandleRoomDisconnection from './useHandleRoomDisconnection/useHandleRoomDisconnection';
import useHandleTrackPublicationFailed from './useHandleTrackPublicationFailed/useHandleTrackPublicationFailed';
import useLocalTracks from './useLocalTracks/useLocalTracks';
import useRestartAudioTrackOnDeviceChange from './useRestartAudioTrackOnDeviceChange/useRestartAudioTrackOnDeviceChange';
import useRoom from './useRoom/useRoom';
import useScreenShareToggle from './useScreenShareToggle/useScreenShareToggle';
import { selectCameraTrack } from '../../utils/trackSelectors';

/*
 *  The hooks used by the VideoProvider component are different than the hooks found in the 'hooks/' directory. The hooks
 *  in the 'hooks/' directory can be used anywhere in a video application, and they can be used any number of times.
 *  the hooks in the 'VideoProvider/' directory are intended to be used by the VideoProvider component only. Using these hooks
 *  elsewhere in the application may cause problems as these hooks should not be used more than once in an application.
 */

interface VideoProviderProps {
  options?: ConnectOptions;
  onError: ErrorCallback;
  children: ReactNode;
}

export function VideoProvider({ options, children, onError = () => {} }: VideoProviderProps) {
  const onErrorCallback: ErrorCallback = useCallback(
    error => {
      console.log(`ERROR: ${error.message}`, error);
      onError(error);
    },
    [onError]
  );

  const {
    localTracks,
    getLocalVideoTrack,
    isAcquiringLocalTracks,
    removeLocalAudioTrack,
    removeLocalVideoTrack,
    getAudioAndVideoTracks,
  } = useLocalTracks();
  const { room, isConnecting, connect } = useRoom(localTracks, onErrorCallback, options);

  const [isSharingScreen, toggleScreenShare] = useScreenShareToggle(room, onError);

  // Register callback functions to be called on room disconnect.
  useHandleRoomDisconnection(
    room,
    onError,
    removeLocalAudioTrack,
    removeLocalVideoTrack,
    isSharingScreen,
    toggleScreenShare
  );
  useHandleTrackPublicationFailed(room, onError);
  useRestartAudioTrackOnDeviceChange(localTracks);

  const [isBackgroundSelectionOpen, setIsBackgroundSelectionOpen] = useState(false);
  const videoTrack = selectCameraTrack(localTracks) as LocalVideoTrack | undefined;
  const [backgroundSettings, setBackgroundSettings] = useBackgroundSettings(videoTrack, room);

  // Memoize the context value so consumers don't re-render purely because this provider re-rendered.
  const value = useMemo(
    () => ({
      room,
      localTracks,
      isConnecting,
      onError: onErrorCallback,
      getLocalVideoTrack,
      connect,
      isAcquiringLocalTracks,
      removeLocalAudioTrack,
      removeLocalVideoTrack,
      isSharingScreen,
      toggleScreenShare,
      getAudioAndVideoTracks,
      isBackgroundSelectionOpen,
      setIsBackgroundSelectionOpen,
      backgroundSettings,
      setBackgroundSettings,
    }),
    [
      room,
      localTracks,
      isConnecting,
      onErrorCallback,
      getLocalVideoTrack,
      connect,
      isAcquiringLocalTracks,
      removeLocalAudioTrack,
      removeLocalVideoTrack,
      isSharingScreen,
      toggleScreenShare,
      getAudioAndVideoTracks,
      isBackgroundSelectionOpen,
      setIsBackgroundSelectionOpen,
      backgroundSettings,
      setBackgroundSettings,
    ]
  );

  return (
    <VideoContext.Provider value={value}>
      <SelectedParticipantProvider room={room}>{children}</SelectedParticipantProvider>
      {/* 
        The AttachVisibilityHandler component is using the useLocalVideoToggle hook
        which must be used within the VideoContext Provider.
      */}
      <AttachVisibilityHandler />
    </VideoContext.Provider>
  );
}
