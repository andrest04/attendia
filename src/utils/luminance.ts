/**
 * Local lighting analysis helpers.
 *
 * These compute a scene's average perceived brightness from raw RGBA pixels so
 * the pre-join screen can tell the user whether their environment is lit well
 * enough for attention analysis. Everything runs locally on a downsized frame —
 * no pixels leave the device and nothing is stored.
 */

// Rec. 601 luma coefficients (perceived brightness weighting per channel).
const R_WEIGHT = 0.299;
const G_WEIGHT = 0.587;
const B_WEIGHT = 0.114;

/**
 * Average perceived luminance (0–255) over an RGBA pixel buffer such as the one
 * returned by `CanvasRenderingContext2D.getImageData().data`. Returns 0 for an
 * empty buffer.
 */
export function computeAverageLuminance(data: Uint8ClampedArray): number {
  const pixelCount = Math.floor(data.length / 4);
  if (pixelCount === 0) {
    return 0;
  }

  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    total += R_WEIGHT * data[i] + G_WEIGHT * data[i + 1] + B_WEIGHT * data[i + 2];
  }

  return total / pixelCount;
}

// Below this average luminance the scene is too dark for reliable attention
// analysis. Tuned for a typical webcam exposure; conservative on purpose.
export const LIGHTING_ADEQUATE_THRESHOLD = 60;

/** Whether the measured luminance clears the adequacy threshold. */
export function isLightingAdequate(luminance: number): boolean {
  return luminance >= LIGHTING_ADEQUATE_THRESHOLD;
}
