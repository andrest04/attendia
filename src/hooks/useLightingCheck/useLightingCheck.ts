import { useEffect, useState } from 'react';
import { LocalVideoTrack } from 'twilio-video';
import { computeAverageLuminance, isLightingAdequate } from '../../utils/luminance';

/**
 * Real, local lighting check for the pre-join screen.
 *
 * Attaches the given local video track to an offscreen video element, samples a
 * downsized frame onto a small canvas every `SAMPLE_INTERVAL_MS`, and derives an
 * average luminance. All processing stays on-device — the canvas frame is read
 * and discarded, nothing is stored or transmitted. When no track is available,
 * or the environment lacks a 2D canvas context (e.g. jsdom in tests), the status
 * stays `analyzing` rather than reporting a false negative.
 */
export type LightingStatus = 'analyzing' | 'ok' | 'low';

export interface LightingCheck {
  status: LightingStatus;
  luminance: number | null;
}

const SAMPLE_INTERVAL_MS = 1500;
// Downsized sampling grid — large enough to be representative, small enough to be cheap.
const SAMPLE_SIZE = 32;

export default function useLightingCheck(videoTrack?: LocalVideoTrack): LightingCheck {
  const [luminance, setLuminance] = useState<number | null>(null);

  useEffect(() => {
    if (!videoTrack) {
      setLuminance(null);
      return;
    }

    // Attach to an explicit <video> element (kept offscreen) so we have a typed
    // HTMLVideoElement to draw from. It never enters the DOM.
    const videoEl = document.createElement('video');
    videoEl.muted = true;
    videoTrack.attach(videoEl);

    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext('2d');

    let active = true;

    const sample = () => {
      if (!active || !ctx || videoEl.readyState < 2) {
        return;
      }
      try {
        ctx.drawImage(videoEl, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        setLuminance(computeAverageLuminance(data));
      } catch {
        // drawImage/getImageData can throw before the first frame is ready; ignore and retry.
      }
    };

    const intervalId = window.setInterval(sample, SAMPLE_INTERVAL_MS);
    sample();

    return () => {
      active = false;
      window.clearInterval(intervalId);
      videoTrack.detach(videoEl);
    };
  }, [videoTrack]);

  const status: LightingStatus = luminance === null ? 'analyzing' : isLightingAdequate(luminance) ? 'ok' : 'low';

  return { status, luminance };
}
