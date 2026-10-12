/**
 * Why a participant does or does not have an attention reading right now. Several surfaces
 * (roster, Individual tab, group average) used to repeat the same if-ladder to decide it.
 *
 * Priority matters: a mobile device is "unsupported" even if its camera is off, and a camera that
 * is off has no face to detect.
 */
export type AttentionPresence = 'unsupported' | 'cameraOff' | 'noFace' | 'measured';

export function classifyAttention(sample: {
  cameraOff: boolean;
  unsupported?: boolean;
  /** `0` is a decayed placeholder (no face found); absent counts as measured (ad-hoc fixtures). */
  faces?: number;
}): AttentionPresence {
  if (sample.unsupported) return 'unsupported';
  if (sample.cameraOff) return 'cameraOff';
  if (sample.faces === 0) return 'noFace';
  return 'measured';
}
