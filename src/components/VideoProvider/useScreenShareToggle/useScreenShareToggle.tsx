import { useState, useCallback, useRef } from 'react';
import { LogLevels, Track, Room } from 'twilio-video';
import { ErrorCallback } from '../../../types';
import { SCREEN_SHARE_AUDIO_TRACK_NAME, SCREEN_SHARE_TRACK_NAME } from '../../../utils/trackSelectors';

interface MediaStreamTrackPublishOptions {
  name?: string;
  priority: Track.Priority;
  logLevel: LogLevels;
}

export default function useScreenShareToggle(room: Room | null, onError: ErrorCallback) {
  const [isSharing, setIsSharing] = useState(false);
  const stopScreenShareRef = useRef<() => void>(null!);

  const shareScreen = useCallback(() => {
    navigator.mediaDevices
      .getDisplayMedia({
        // Asking for audio makes Chrome/Edge offer "Share tab/system audio" in the picker, so a
        // shared video (e.g. YouTube) is heard by the others. Browsers that cannot capture it
        // just return a video-only stream. `systemAudio` is not in the TS DOM types yet.
        audio: true,
        video: true,
        systemAudio: 'include',
      } as MediaStreamConstraints)
      .then(stream => {
        const track = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        // All video tracks are published with 'low' priority. This works because the video
        // track that is displayed in the 'MainParticipant' component will have it's priority
        // set to 'high' via track.setPriority()
        room!.localParticipant
          .publishTrack(track, {
            name: SCREEN_SHARE_TRACK_NAME, // Tracks can be named to easily find them later (see isScreenShareName)
            priority: 'low', // Priority is set to high by the subscriber when the video track is rendered
          } as MediaStreamTrackPublishOptions)
          .then(async trackPublication => {
            // The screen keeps being shared without its audio if that one cannot be published.
            const audioPublication = audioTrack
              ? await room!.localParticipant
                  .publishTrack(audioTrack, { name: SCREEN_SHARE_AUDIO_TRACK_NAME } as MediaStreamTrackPublishOptions)
                  .catch(error => {
                    console.warn('Could not publish the screen share audio', error);
                    audioTrack.stop();
                    return undefined;
                  })
              : undefined;

            stopScreenShareRef.current = () => {
              room!.localParticipant.unpublishTrack(track);
              // TODO: remove this if the SDK is updated to emit this event
              room!.localParticipant.emit('trackUnpublished', trackPublication);
              track.stop();
              if (audioPublication) {
                room!.localParticipant.unpublishTrack(audioTrack);
                room!.localParticipant.emit('trackUnpublished', audioPublication);
                audioTrack.stop();
              }
              setIsSharing(false);
            };

            track.onended = stopScreenShareRef.current;
            setIsSharing(true);
          })
          .catch(error => {
            audioTrack?.stop();
            onError(error);
          });
      })
      .catch(error => {
        // Don't display an error if the user closes the screen share dialog
        if (
          error.message === 'Permission denied by system' ||
          (error.name !== 'AbortError' && error.name !== 'NotAllowedError')
        ) {
          console.error(error);
          onError(error);
        }
      });
  }, [room, onError]);

  const toggleScreenShare = useCallback(() => {
    if (room) {
      !isSharing ? shareScreen() : stopScreenShareRef.current();
    }
  }, [isSharing, shareScreen, room]);

  return [isSharing, toggleScreenShare] as const;
}
