/**
 * Why a participant does or does not have an attention reading right now. Several surfaces
 * (roster, Individual tab, group average) used to repeat the same if-ladder to decide it.
 *
 * Priority matters: a mobile device is "unsupported" even if its camera is off, a camera that
 * is off has no face to detect, and a camera that is on but whose analysis has produced no
 * reading yet (MediaPipe loading or failed, or no telemetry received at all) is `pending` —
 * never "camera off", which is only ever the student's own explicit report.
 */
export type AttentionPresence = 'unsupported' | 'cameraOff' | 'pending' | 'noFace' | 'measured';

export function classifyAttention(sample: {
  cameraOff: boolean;
  unsupported?: boolean;
  /** Camera on, but no reading yet (explicit heartbeat, or a connected student with no telemetry). */
  pending?: boolean;
  /** `0` is a decayed placeholder (no face found); absent counts as measured (ad-hoc fixtures). */
  faces?: number;
}): AttentionPresence {
  if (sample.unsupported) return 'unsupported';
  if (sample.cameraOff) return 'cameraOff';
  if (sample.pending) return 'pending';
  if (sample.faces === 0) return 'noFace';
  return 'measured';
}
