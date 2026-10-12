import {
  addToRollingWindow,
  BlinkState,
  computeEyesScore,
  computeGazeDirection,
  computeHeadPoseAngles,
  computeHeadScore,
  computeLabAttentionIndex,
  createFocusLostState,
  FocusLostState,
  Landmark2D,
  RollingWindow,
  stepBlinkCounter,
  stepFocusLostStateMachine,
} from '../../utils/attentionHeuristics';

/**
 * The per-frame half of the attention capture, free of MediaPipe, React and timers:
 *
 * - `toFaceFrame` is the ADAPTER from MediaPipe's raw detection result (loosely typed, with
 *   blendshapes buried in categories and the head pose in a Float32Array matrix) to a plain
 *   `FaceFrame` — the one place that knows MediaPipe's shape;
 * - `analyzeFrame` is the pure step: previous state + one frame + a clock → next state + scores.
 *
 * The hook keeps only the lifecycle (load the model, bind the track, run the interval, dispose).
 */

const ROLLING_WINDOW_MS = 10000;
const BLINK_THRESHOLD = 0.45; // mirrors AttentionLab default

// Head-pose limits (degrees) beyond which the head counts as turned / down.
const HEAD_TURN_LIMIT_DEG = 30;
const HEAD_DOWN_LIMIT_DEG = 20;

/** What the analysis needs from one detection, as plain data. */
export type FaceFrame =
  | { faces: 0 }
  | {
      faces: number;
      /** Landmarks of the first (primary) face. */
      landmarks: Landmark2D[];
      /** Mean of the left/right eyeBlink blendshapes, 0-1. */
      blinkAverage: number;
      /** 4x4 facial transformation matrix (column-major, as MediaPipe returns), or null. */
      headMatrix: number[] | null;
    };

/** Per-sample analysis state, held by the hook between frames. */
export interface AnalysisState {
  blink: BlinkState;
  focusLost: FocusLostState;
  gazeWindow: RollingWindow;
  headWindow: RollingWindow;
}

export interface AttentionScores {
  eyes: number;
  head: number;
  /** Aggregate 0-100, via computeLabAttentionIndex(eyes, head). */
  index: number;
}

export function freshAnalysisState(): AnalysisState {
  return {
    blink: { count: 0, wasClosedLastFrame: false },
    focusLost: createFocusLostState(),
    gazeWindow: { entries: [], windowMs: ROLLING_WINDOW_MS },
    headWindow: { entries: [], windowMs: ROLLING_WINDOW_MS },
  };
}

/** Adapter: MediaPipe's raw FaceLandmarker result → FaceFrame. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toFaceFrame(detection: any): FaceFrame {
  const faces: number = detection.faceLandmarks ? detection.faceLandmarks.length : 0;
  if (faces === 0) return { faces: 0 };

  const blendshapes =
    detection.faceBlendshapes && detection.faceBlendshapes[0] ? detection.faceBlendshapes[0].categories : [];
  const blend = (name: string): number => {
    const category = blendshapes.find((candidate: { categoryName: string }) => candidate.categoryName === name);
    return category ? category.score : 0;
  };

  const matrix = detection.facialTransformationMatrixes && detection.facialTransformationMatrixes[0];

  return {
    faces,
    landmarks: detection.faceLandmarks[0],
    blinkAverage: (blend('eyeBlinkLeft') + blend('eyeBlinkRight')) / 2,
    headMatrix: matrix ? Array.from(matrix.data as Float32Array) : null,
  };
}

/**
 * One analysis step. With no face, negative samples are pushed so the rolling scores decay
 * toward 0 (same logic as AttentionLab); with a face, blink, gaze, head pose and the focus-lost
 * machine are all advanced. Pure: the previous state is never mutated.
 */
export function analyzeFrame(
  state: AnalysisState,
  frame: FaceFrame,
  nowMs: number
): { state: AnalysisState; scores: AttentionScores } {
  let next: AnalysisState;

  if (!('landmarks' in frame)) {
    next = {
      ...state,
      gazeWindow: addToRollingWindow(state.gazeWindow, false, nowMs),
      headWindow: addToRollingWindow(state.headWindow, false, nowMs),
    };
  } else {
    const gaze = computeGazeDirection(frame.landmarks);
    const eyesClosed = frame.blinkAverage >= BLINK_THRESHOLD;
    const eyesOnTask = gaze.onScreen && !eyesClosed;

    let headTurned = false;
    let headDown = false;
    if (frame.headMatrix) {
      // MediaPipe returns column-major matrices; pass rowMajor=false
      const headPose = computeHeadPoseAngles(frame.headMatrix, HEAD_TURN_LIMIT_DEG, HEAD_DOWN_LIMIT_DEG, false);
      headTurned = headPose.headTurned;
      headDown = headPose.headDown;
    }

    const headOnTask = !headTurned && !headDown;
    next = {
      blink: stepBlinkCounter(state.blink, frame.blinkAverage, BLINK_THRESHOLD),
      focusLost: stepFocusLostStateMachine(state.focusLost, !headOnTask, nowMs),
      gazeWindow: addToRollingWindow(state.gazeWindow, eyesOnTask, nowMs),
      headWindow: addToRollingWindow(state.headWindow, headOnTask, nowMs),
    };
  }

  const eyes = computeEyesScore(next.gazeWindow);
  const head = computeHeadScore(next.headWindow);
  return { state: next, scores: { eyes, head, index: computeLabAttentionIndex(eyes, head) } };
}

// ─── FaceLandmarker creation ──────────────────────────────────────────────────

type Delegate = 'GPU' | 'CPU';

/**
 * Creates the FaceLandmarker, preferring the GPU and falling back to the CPU when GPU
 * initialisation fails. Some machines/browsers lack a usable WebGL context for MediaPipe, which
 * otherwise leaves the landmarker alive but producing zero detections (face never recognised →
 * index stuck at 0 for that participant).
 *
 * Resolves `null` when `isDisposed()` turns true after a failed attempt (the effect that asked
 * for it was cleaned up while the model was loading); rejects when every delegate fails.
 */
export async function createLandmarker(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  FaceLandmarker: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filesetResolver: any,
  modelUrl: string,
  isDisposed: () => boolean,
  delegates: Delegate[] = ['GPU', 'CPU']
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  let lastError: unknown;
  for (const delegate of delegates) {
    try {
      return await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: { modelAssetPath: modelUrl, delegate },
        runningMode: 'VIDEO' as const,
        // Detect up to 2 faces so the multiface proctoring signal works.
        numFaces: 2,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
    } catch (error) {
      lastError = error;
      if (isDisposed()) return null;
    }
  }
  throw lastError;
}
