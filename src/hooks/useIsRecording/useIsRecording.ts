import useVideoContext from '../useVideoContext/useVideoContext';
import useEmitterState from '../useEmitterState/useEmitterState';

export default function useIsRecording() {
  const { room } = useVideoContext();
  return useEmitterState(room, currentRoom => Boolean(currentRoom?.isRecording), {
    recordingStarted: () => true,
    recordingStopped: () => false,
  });
}
