import { createContext } from 'react';
import { CreateLocalTrackOptions, LocalAudioTrack, LocalVideoTrack, Room } from 'twilio-video';
import { ErrorCallback } from '../../types';
import { BackgroundSettings } from './useBackgroundSettings/backgroundSettingsTypes';

// The VideoContext lives in its own leaf module (it imports nothing that imports the
// VideoProvider back) so consumers like useVideoContext can read the context without
// creating an import cycle through VideoProvider/index.tsx and its child components.
export interface IVideoContext {
  room: Room | null;
  localTracks: (LocalAudioTrack | LocalVideoTrack)[];
  isConnecting: boolean;
  connect: (token: string) => Promise<void>;
  onError: ErrorCallback;
  getLocalVideoTrack: (newOptions?: CreateLocalTrackOptions) => Promise<LocalVideoTrack>;
  isAcquiringLocalTracks: boolean;
  removeLocalVideoTrack: () => void;
  isSharingScreen: boolean;
  toggleScreenShare: () => void;
  getAudioAndVideoTracks: () => Promise<void>;
  isBackgroundSelectionOpen: boolean;
  setIsBackgroundSelectionOpen: (value: boolean) => void;
  backgroundSettings: BackgroundSettings;
  setBackgroundSettings: (settings: BackgroundSettings) => void;
}

export const VideoContext = createContext<IVideoContext>(null!);
