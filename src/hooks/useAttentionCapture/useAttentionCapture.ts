import { useEffect, useRef, useState } from 'react';
import { LocalVideoTrack } from 'twilio-video';

import {
  computeGazeDirection,
  computeHeadPoseAngles,
  stepBlinkCounter,
  stepFocusLostStateMachine,
  addToRollingWindow,
  computeEyesScore,
  computeHeadScore,
  computeLabAttentionIndex,
  BlinkState,
  FocusLostState,
  RollingWindow,
  Landmark2D,
} from '../../utils/attentionHeuristics';

// ─── CDN constants (same as AttentionLab) ────────────────────────────────────
// TODO: replace CDN URLs with self-hosted assets when hardening for production
//       to avoid external dependency and CSP issues.
const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// ─── Sampling configuration ───────────────────────────────────────────────────
// 1 Hz is deliberate: the CV pipeline needs to be lightweight enough to run
// alongside the video call itself. Higher rates can be enabled later via a config.
export const SAMPLE_INTERVAL_MS = 1000;
const ROLLING_WINDOW_MS = 10000;
const BLINK_THRESHOLD = 0.45; // mirrors AttentionLab default

// ─── Per-sample mutable analysis state (not exposed in React state) ───────────
interface AnalysisState {
  blink: BlinkState;
  focusLost: FocusLostState;
  gazeWindow: RollingWindow;
  headWindow: RollingWindow;
}

function freshAnalysisState(): AnalysisState {
  return {
    blink: { count: 0, wasClosedLastFrame: false },
    focusLost: { count: 0, totalLostMs: 0, lostSince: null },
    gazeWindow: { entries: [], windowMs: ROLLING_WINDOW_MS },
    headWindow: { entries: [], windowMs: ROLLING_WINDOW_MS },
  };
}

// ─── Public output shape ──────────────────────────────────────────────────────

export interface AttentionCaptureResult {
  /** 'active' only while a track is bound AND the landmarker has loaded. */
  capture: 'active' | 'inactive';
  /** Aggregate attention index 0-100, via computeLabAttentionIndex(eyes, head). */
  index: number;
  /** Individual signal scores (posture is excluded — not measured here). */
  components: { eyes: number; head: number };
  /** Number of faces detected in the most recent sample. */
  faces: number;
  /** True when faces > 1 (proctoring signal). */
  multiface: boolean;
}

const INACTIVE_RESULT: AttentionCaptureResult = {
  capture: 'inactive',
  index: 0,
  components: { eyes: 0, head: 0 },
  faces: 0,
  multiface: false,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useAttentionCapture
 *
 * Runs MediaPipe FaceLandmarker analysis over a Twilio LocalVideoTrack at
 * SAMPLE_INTERVAL_MS (1 Hz by default). Computes real attention signals using
 * the pure heuristics from attentionHeuristics.ts.
 *
 * Layer 2 of the CV pipeline graduation:
 * - Layer 1: pure heuristics extracted to attentionHeuristics.ts
 * - Layer 2 (THIS): engine + Twilio track binding (no transport, no UI)
 * - Layer 3 (TODO): DataTrack transport for remote signaling
 * - Layer 4 (TODO): AttentionProvider swap to wire into existing UI
 *
 * @param videoTrack  The local Twilio video track to analyse. Passing undefined
 *                    keeps the hook idle (capture='inactive', no MediaPipe loaded).
 */
export default function useAttentionCapture(videoTrack?: LocalVideoTrack): AttentionCaptureResult {
  const [result, setResult] = useState<AttentionCaptureResult>(INACTIVE_RESULT);

  // Mutable refs — avoid re-triggering the effect on every state update.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const landmarkerRef = useRef<any>(null);
  const analysisRef = useRef<AnalysisState>(freshAnalysisState());

  useEffect(() => {
    if (!videoTrack) {
      setResult(INACTIVE_RESULT);
      return;
    }

    // Per-invocation disposal guard captured in THIS effect run's closure.
    // It must NOT be a shared ref: when videoTrack changes while the model is
    // still loading, React runs the old run's cleanup (sets this true) then the
    // new run's body. A shared ref would be reset to false by the new run, so
    // the old run's in-flight async continuation would see false, fail to bail,
    // and leak its FaceLandmarker plus a ghost interval. A local keeps each run's
    // cancellation independent.
    let disposed = false;

    // Attach the Twilio track to an offscreen video element (never enters the DOM).
    // Pattern borrowed from useLightingCheck: track.attach(videoEl) → track.detach(videoEl).
    const videoEl = document.createElement('video');
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoTrack.attach(videoEl);
    // The element is never inserted into the DOM. Twilio's attach() autoplays on
    // most browsers, but a DOM-detached element does not reliably advance frames
    // everywhere — and without ticking frames detectForVideo() sees an empty frame
    // and reports numFaces:0 forever (index decays to 0 while capture stays
    // 'active'). Force play defensively; a rejection is harmless (muted autoplay).
    try {
      const playResult = videoEl.play();
      // play() returns a promise in browsers; guard for environments (jsdom) where
      // it returns undefined or throws. A rejection is harmless (muted autoplay).
      if (playResult && typeof playResult.then === 'function') {
        playResult.catch(() => {
          /* autoplay may be deferred; the readyState guard below covers this */
        });
      }
    } catch (_) {
      /* play() unsupported in this environment; the readyState guard covers it */
    }

    // Reset per-run analysis state.
    analysisRef.current = freshAnalysisState();
    // window.setInterval returns a number in the browser; type it explicitly so
    // it doesn't pick up @types/node's NodeJS.Timeout overload.
    let intervalId: number | null = null;

    // ── Load FaceLandmarker lazily (WASM, not bundled) ──────────────────────
    // Dynamic import mirrors AttentionLab exactly to avoid CRA WASM bundling issues.
    const loadAndStart = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vision = await import('@mediapipe/tasks-vision');
        const { FaceLandmarker, FilesetResolver } = vision;

        const filesetResolver = await FilesetResolver.forVisionTasks(WASM_CDN);
        const createOptions = (delegate: 'GPU' | 'CPU') => ({
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate,
          },
          runningMode: 'VIDEO' as const,
          // Detect up to 2 faces so the multiface proctoring signal works.
          numFaces: 2,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });

        // Prefer GPU; fall back to CPU when GPU initialisation fails. Some
        // machines/browsers lack a usable WebGL context for MediaPipe, which
        // otherwise leaves the landmarker alive but producing zero detections
        // (face never recognised → index stuck at 0 for that participant).
        let fl;
        try {
          fl = await FaceLandmarker.createFromOptions(filesetResolver, createOptions('GPU'));
        } catch (_) {
          if (disposed) return;
          fl = await FaceLandmarker.createFromOptions(filesetResolver, createOptions('CPU'));
        }

        // Guard: this effect may have been cleaned up while the model was loading.
        if (disposed) {
          try {
            fl.close();
          } catch (_) {
            /* ignore */
          }
          return;
        }

        landmarkerRef.current = fl;

        // ── Sampling interval ─────────────────────────────────────────────
        // setInterval rather than rAF: 1 Hz is the right cadence for an
        // attention signal (not a visual rendering loop).
        intervalId = window.setInterval(() => {
          if (disposed || !landmarkerRef.current) return;

          // Skip until the offscreen element actually has decoded frame data
          // (HAVE_CURRENT_DATA). Running detectForVideo on a not-yet-ready
          // element yields no landmarks and would falsely decay the index to 0.
          if (videoEl.readyState < 2) return;

          const now = performance.now();

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let detection: any;
          try {
            detection = landmarkerRef.current.detectForVideo(videoEl, now);
          } catch (_) {
            return;
          }

          const numFaces: number = detection.faceLandmarks ? detection.faceLandmarks.length : 0;

          let state = analysisRef.current;

          if (numFaces === 0) {
            // No face detected — push negative samples so the rolling scores
            // decay toward 0 (same logic as AttentionLab).
            state = {
              ...state,
              gazeWindow: addToRollingWindow(state.gazeWindow, false, now),
              headWindow: addToRollingWindow(state.headWindow, false, now),
            };
          } else {
            const landmarks: Landmark2D[] = detection.faceLandmarks[0];
            const blendshapes =
              detection.faceBlendshapes && detection.faceBlendshapes[0] ? detection.faceBlendshapes[0].categories : [];

            const getBlend = (name: string): number => {
              const cat = blendshapes.find((c: { categoryName: string }) => c.categoryName === name);
              return cat ? cat.score : 0;
            };

            // Blink: average of left+right eyeBlink blendshapes
            const blinkAvg = (getBlend('eyeBlinkLeft') + getBlend('eyeBlinkRight')) / 2;
            state = { ...state, blink: stepBlinkCounter(state.blink, blinkAvg, BLINK_THRESHOLD) };

            // Gaze direction from iris landmarks
            const gaze = computeGazeDirection(landmarks);
            const eyesClosed = blinkAvg >= BLINK_THRESHOLD;
            const eyesOnTask = gaze.onScreen && !eyesClosed;

            // Head pose from facial transformation matrix (column-major from MediaPipe)
            const matData =
              detection.facialTransformationMatrixes && detection.facialTransformationMatrixes[0]
                ? Array.from(detection.facialTransformationMatrixes[0].data as Float32Array)
                : null;

            let headTurned = false;
            let headDown = false;
            if (matData) {
              // MediaPipe returns column-major matrices; pass rowMajor=false
              const headPose = computeHeadPoseAngles(matData, 30, 20, false);
              headTurned = headPose.headTurned;
              headDown = headPose.headDown;
            }

            // Focus-lost state machine
            const focusLost = headTurned || headDown;
            state = {
              ...state,
              focusLost: stepFocusLostStateMachine(state.focusLost, focusLost, now),
              gazeWindow: addToRollingWindow(state.gazeWindow, eyesOnTask, now),
              headWindow: addToRollingWindow(state.headWindow, !headTurned && !headDown, now),
            };
          }

          analysisRef.current = state;

          // Derive output scores from rolling windows
          const eyes = computeEyesScore(state.gazeWindow);
          const head = computeHeadScore(state.headWindow);
          const index = computeLabAttentionIndex(eyes, head);

          setResult({
            capture: 'active',
            index,
            components: { eyes, head },
            faces: numFaces,
            multiface: numFaces > 1,
          });
        }, SAMPLE_INTERVAL_MS);
      } catch (_) {
        // Model load failed — stay inactive. A retry mechanism is a future concern.
        if (!disposed) {
          setResult(INACTIVE_RESULT);
        }
      }
    };

    loadAndStart();

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      disposed = true;

      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }

      // Detach the video element from the track (stops the Twilio track pipeline).
      videoTrack.detach(videoEl);

      // Release WASM/GPU memory held by the FaceLandmarker.
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch (_) {
          /* ignore close errors */
        }
        landmarkerRef.current = null;
      }

      setResult(INACTIVE_RESULT);
    };
  }, [videoTrack]);

  return result;
}
