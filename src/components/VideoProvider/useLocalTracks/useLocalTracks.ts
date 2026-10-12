import { DEFAULT_VIDEO_CONSTRAINTS, SELECTED_AUDIO_INPUT_KEY, SELECTED_VIDEO_INPUT_KEY } from '../../../constants';
import { getDeviceInfo, isPermissionDenied } from '../../../utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import Video, {
  LocalVideoTrack,
  LocalAudioTrack,
  CreateLocalTrackOptions,
  NoiseCancellationOptions,
} from 'twilio-video';
import { useAppState } from '../../../state';

const noiseCancellationOptions: NoiseCancellationOptions = {
  sdkAssetsPath: '/noisecancellation',
  vendor: 'krisp',
};

interface DeviceInput {
  deviceId: string;
}

/**
 * Constraints for acquiring the camera: the app defaults plus, when the device the user
 * last picked is still plugged in, that exact device. (Both the single-camera toggle and
 * the audio+video acquisition build the same options.)
 */
function buildCameraOptions(
  selectedDeviceId: string | null,
  videoInputDevices: DeviceInput[]
): CreateLocalTrackOptions {
  const hasSelectedDevice = videoInputDevices.some(device => selectedDeviceId && device.deviceId === selectedDeviceId);
  return {
    ...(DEFAULT_VIDEO_CONSTRAINTS as {}),
    name: `camera-${Date.now()}`,
    ...(hasSelectedDevice && { deviceId: { exact: selectedDeviceId! } }),
  };
}

/** Constraints for acquiring the microphone, honoring the user's last picked device. */
function buildMicrophoneOptions(selectedDeviceId: string | null, audioInputDevices: DeviceInput[]) {
  const hasSelectedDevice = audioInputDevices.some(device => selectedDeviceId && device.deviceId === selectedDeviceId);
  return {
    noiseCancellationOptions,
    ...(hasSelectedDevice && { deviceId: { exact: selectedDeviceId! } }),
  };
}

export default function useLocalTracks() {
  const { setIsKrispEnabled, setIsKrispInstalled } = useAppState();
  const [audioTrack, setAudioTrack] = useState<LocalAudioTrack>();
  const [videoTrack, setVideoTrack] = useState<LocalVideoTrack>();
  const [isAcquiringLocalTracks, setIsAcquiringLocalTracks] = useState(false);

  // Kept in sync after each commit so the unmount cleanup below always stops whatever
  // tracks are currently held, without re-registering that cleanup on every acquire/toggle.
  const audioTrackRef = useRef<LocalAudioTrack>();
  const videoTrackRef = useRef<LocalVideoTrack>();

  useEffect(() => {
    audioTrackRef.current = audioTrack;
    videoTrackRef.current = videoTrack;
  }, [audioTrack, videoTrack]);

  // If this hook ever unmounts (e.g. a dev hot-reload of VideoProvider) while a track is
  // still live, the MediaStreamTrack must be stopped here. Otherwise the browser keeps the
  // OS-level device handle open with nothing left to release it, and the next getUserMedia
  // call can fail with a NotReadableError even though no other app is really using it.
  useEffect(() => {
    return () => {
      audioTrackRef.current?.stop();
      videoTrackRef.current?.stop();
    };
  }, []);

  const getLocalVideoTrack = useCallback(async () => {
    const selectedVideoDeviceId = window.localStorage.getItem(SELECTED_VIDEO_INPUT_KEY);

    const { videoInputDevices } = await getDeviceInfo();

    return Video.createLocalVideoTrack(buildCameraOptions(selectedVideoDeviceId, videoInputDevices)).then(newTrack => {
      setVideoTrack(newTrack);
      return newTrack;
    });
  }, []);

  const removeLocalAudioTrack = useCallback(() => {
    if (audioTrack) {
      audioTrack.stop();
      setAudioTrack(undefined);
    }
  }, [audioTrack]);

  const removeLocalVideoTrack = useCallback(() => {
    if (videoTrack) {
      videoTrack.stop();
      setVideoTrack(undefined);
    }
  }, [videoTrack]);

  // PreJoinScreens' own device-selection effect and useAutoRejoin's mount effect can both
  // call getAudioAndVideoTracks() around the same render (e.g. on a refresh where both a
  // dashboard handoff and a resumable rejoin session are valid at once). The state-based
  // guard below reads isAcquiringLocalTracks only after an `await`, so two concurrent calls
  // can both pass it before either sets the flag — racing two getUserMedia requests for the
  // same camera and failing both with NotReadableError. This ref is set synchronously,
  // before any await, so the second caller bails out immediately instead of racing.
  const isAcquiringRef = useRef(false);

  const getAudioAndVideoTracks = useCallback(async () => {
    if (isAcquiringRef.current || audioTrack || videoTrack) return Promise.resolve();
    isAcquiringRef.current = true;

    const { audioInputDevices, videoInputDevices, hasAudioInputDevices, hasVideoInputDevices } = await getDeviceInfo();

    if (!hasAudioInputDevices && !hasVideoInputDevices) {
      isAcquiringRef.current = false;
      return Promise.resolve();
    }

    setIsAcquiringLocalTracks(true);

    const selectedAudioDeviceId = window.localStorage.getItem(SELECTED_AUDIO_INPUT_KEY);
    const selectedVideoDeviceId = window.localStorage.getItem(SELECTED_VIDEO_INPUT_KEY);

    // In Chrome, it is possible to deny permissions to only audio or only video.
    // If that has happened, then we don't want to attempt to acquire the device.
    const isCameraPermissionDenied = await isPermissionDenied('camera');
    const isMicrophonePermissionDenied = await isPermissionDenied('microphone');

    const shouldAcquireVideo = hasVideoInputDevices && !isCameraPermissionDenied;
    const shouldAcquireAudio = hasAudioInputDevices && !isMicrophonePermissionDenied;

    const localTrackConstraints = {
      video: shouldAcquireVideo && buildCameraOptions(selectedVideoDeviceId, videoInputDevices),
      audio: shouldAcquireAudio && buildMicrophoneOptions(selectedAudioDeviceId, audioInputDevices),
    };

    return Video.createLocalTracks(localTrackConstraints)
      .then(tracks => {
        const newVideoTrack = tracks.find(track => track.kind === 'video') as LocalVideoTrack;
        const newAudioTrack = tracks.find(track => track.kind === 'audio') as LocalAudioTrack;
        if (newVideoTrack) {
          setVideoTrack(newVideoTrack);
          // Save the deviceId so it can be picked up by the VideoInputList component. This only matters
          // in cases where the user's video is disabled.
          window.localStorage.setItem(
            SELECTED_VIDEO_INPUT_KEY,
            newVideoTrack.mediaStreamTrack.getSettings().deviceId ?? ''
          );
        }
        if (newAudioTrack) {
          setAudioTrack(newAudioTrack);
          if (newAudioTrack.noiseCancellation) {
            setIsKrispEnabled(true);
            setIsKrispInstalled(true);
          }
        }

        // These custom errors will be picked up by the MediaErrorSnackbar component.
        if (isCameraPermissionDenied && isMicrophonePermissionDenied) {
          const error = new Error();
          error.name = 'NotAllowedError';
          throw error;
        }

        if (isCameraPermissionDenied) {
          throw new Error('CameraPermissionsDenied');
        }

        if (isMicrophonePermissionDenied) {
          throw new Error('MicrophonePermissionsDenied');
        }
      })
      .finally(() => {
        isAcquiringRef.current = false;
        setIsAcquiringLocalTracks(false);
      });
  }, [audioTrack, videoTrack, setIsKrispEnabled, setIsKrispInstalled]);

  const localTracks = [audioTrack, videoTrack].filter(track => track !== undefined) as (
    | LocalAudioTrack
    | LocalVideoTrack
  )[];

  return {
    localTracks,
    getLocalVideoTrack,
    isAcquiringLocalTracks,
    removeLocalAudioTrack,
    removeLocalVideoTrack,
    getAudioAndVideoTracks,
  };
}
