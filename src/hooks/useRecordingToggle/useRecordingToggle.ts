import { useAppState } from '../../state';
import useIsRecording from '../useIsRecording/useIsRecording';
import useVideoContext from '../useVideoContext/useVideoContext';

/**
 * Start/stop recording the room, as one command. The professor toolbar and the legacy menu
 * each carried their own copy of the room-type gate and of the include/exclude rule.
 *
 * Recording rules only exist for group rooms: peer-to-peer and go rooms cannot record, so the
 * control should not be offered there (`supported`).
 */
export default function useRecordingToggle() {
  const { room } = useVideoContext();
  const { updateRecordingRules, isFetching, roomType } = useAppState();
  const isRecording = useIsRecording();

  const supported = roomType !== 'peer-to-peer' && roomType !== 'go';

  return {
    supported,
    isRecording,
    /** A rules request is in flight. */
    busy: isFetching,
    /** Flips recording: include everything when stopped, exclude everything when recording. */
    toggle: () => updateRecordingRules(room!.sid, [{ type: isRecording ? 'exclude' : 'include', all: true }]),
  };
}
