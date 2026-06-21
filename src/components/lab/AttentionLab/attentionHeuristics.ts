/**
 * attentionHeuristics.ts
 *
 * Pure geometric heuristics for in-browser face analysis.
 * NO MediaPipe imports — functions accept plain landmark arrays and numbers.
 * Ported from the Python reference at _reference/engagement_analysis.
 *
 * HARD RULE: nothing in this file may be imported by the real video flow.
 * This module belongs to src/components/lab/ — dev-only spike code only.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** A 2-D landmark with normalized x/y coordinates in [0, 1]. */
export interface Landmark2D {
  x: number;
  y: number;
}

/** A 3-D landmark (z ignored for 2-D heuristics but present in MediaPipe). */
export interface Landmark3D {
  x: number;
  y: number;
  z: number;
}

/** Output of computeGazeDirection. */
export interface GazeResult {
  /** Normalized horizontal gaze position [0, 1]; 0.5 = centred. */
  gazeX: number;
  /** Normalized vertical gaze position [0, 1]; 0.5 = centred. */
  gazeY: number;
  /** True when gaze is within the on-screen tolerance window. */
  onScreen: boolean;
}

/** Output of computeHeadPoseAngles. */
export interface HeadPoseResult {
  /** Pitch in degrees; positive = head tilted down. */
  pitch: number;
  /** Yaw in degrees; positive = head turned right. */
  yaw: number;
  /** Roll in degrees; positive = head tilted clockwise. */
  roll: number;
  /** True when |yaw| exceeds the yaw threshold. */
  headTurned: boolean;
  /** True when pitch exceeds the pitch threshold. */
  headDown: boolean;
}

/** Immutable blink-counter state; step via stepBlinkCounter(). */
export interface BlinkState {
  count: number;
  wasClosedLastFrame: boolean;
}

/** Immutable focus-lost state machine state; step via stepFocusLostStateMachine(). */
export interface FocusLostState {
  /** Number of sustained focus-lost events (each ≥ 2 s). */
  count: number;
  /** Cumulative ms with focus lost. */
  totalLostMs: number;
  /**
   * Timestamp (ms) when the current focus-lost run started, or null when
   * focus is not currently lost.
   */
  lostSince: number | null;
}

/** A single time-stamped boolean sample in a rolling window. */
export interface WindowEntry {
  value: boolean;
  timestamp: number;
}

/** Rolling window of boolean samples for scoring. */
export interface RollingWindow {
  entries: WindowEntry[];
  /** Duration of the window in ms. */
  windowMs: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Landmark indices ported from the reference Python code. */
const IDX = {
  // Left eye
  LEFT_EYE_OUTER: 33,
  LEFT_EYE_INNER: 133,
  LEFT_EYE_TOP: 159,
  LEFT_EYE_BOTTOM: 145,
  // Right eye
  RIGHT_EYE_INNER: 362,
  RIGHT_EYE_OUTER: 263,
  RIGHT_EYE_TOP: 386,
  RIGHT_EYE_BOTTOM: 374,
  // Iris centers (MediaPipe Tasks Vision FaceLandmarker)
  LEFT_IRIS: 468,
  RIGHT_IRIS: 473,
};

/** Focus-lost sustained duration before a new "event" is counted (ms). */
const FOCUS_LOST_THRESHOLD_MS = 2000;

// ─── computeGazeDirection ────────────────────────────────────────────────────

/**
 * Compute gaze direction from iris landmark positions relative to eye corners.
 *
 * Ported from eyes_utils.py:calculate_gaze_with_iris.
 * gazeX in [0,1]: 0 = far left, 1 = far right, 0.5 = centred.
 * gazeY in [0,1]: 0 = up, 1 = down, 0.5 = centred.
 *
 * @param landmarks  Array of at least 474 Landmark2D (normalized x/y).
 * @param gazeThresholdX  Horizontal on-screen tolerance around 0.5 (default 0.2).
 * @param gazeThresholdY  Vertical on-screen tolerance around 0.5 (default 0.4).
 */
export function computeGazeDirection(landmarks: Landmark2D[], gazeThresholdX = 0.2, gazeThresholdY = 0.4): GazeResult {
  const safeDiv = (a: number, b: number, fallback = 0.5) => (Math.abs(b) > 1e-6 ? a / b : fallback);

  // Left eye
  const leftWidth = Math.max(landmarks[IDX.LEFT_EYE_INNER].x - landmarks[IDX.LEFT_EYE_OUTER].x, 0.01);
  const leftHeight = Math.max(landmarks[IDX.LEFT_EYE_BOTTOM].y - landmarks[IDX.LEFT_EYE_TOP].y, 0.01);
  const leftGazeX = safeDiv(landmarks[IDX.LEFT_IRIS].x - landmarks[IDX.LEFT_EYE_OUTER].x, leftWidth);
  const leftGazeY = safeDiv(landmarks[IDX.LEFT_IRIS].y - landmarks[IDX.LEFT_EYE_TOP].y, leftHeight) - 0.5;

  // Right eye
  const rightWidth = Math.max(landmarks[IDX.RIGHT_EYE_OUTER].x - landmarks[IDX.RIGHT_EYE_INNER].x, 0.01);
  const rightHeight = Math.max(landmarks[IDX.RIGHT_EYE_BOTTOM].y - landmarks[IDX.RIGHT_EYE_TOP].y, 0.01);
  const rightGazeX = safeDiv(landmarks[IDX.RIGHT_IRIS].x - landmarks[IDX.RIGHT_EYE_INNER].x, rightWidth);
  const rightGazeY = safeDiv(landmarks[IDX.RIGHT_IRIS].y - landmarks[IDX.RIGHT_EYE_TOP].y, rightHeight) - 0.5;

  // Average both eyes; apply top-camera vertical bias (0.5) so looking
  // straight at a top-mounted webcam registers as centred.
  const TOP_CAMERA_VERTICAL_BIAS = 0.5;
  const rawGazeX = (leftGazeX + rightGazeX) / 2;
  const rawGazeY = (leftGazeY + rightGazeY) / 2 + TOP_CAMERA_VERTICAL_BIAS;

  const gazeX = Math.max(0, Math.min(rawGazeX, 1));
  const gazeY = Math.max(0, Math.min((rawGazeY + 1) / 2, 1));

  const onScreen = Math.abs(gazeX - 0.5) < gazeThresholdX && Math.abs(gazeY - 0.5) < gazeThresholdY;

  return { gazeX, gazeY, onScreen };
}

// ─── computeHeadPoseAngles ───────────────────────────────────────────────────

/**
 * Extract pitch, yaw, roll (degrees) from a 4×4 rotation matrix.
 *
 * The MediaPipe FaceLandmarker facialTransformationMatrixes[i].data field is a
 * Float32Array of 16 values in COLUMN-MAJOR order (OpenGL convention), but the
 * test helpers pass ROW-MAJOR matrices — this function accepts either by
 * checking the convention via the mat parameter.
 *
 * In practice we always receive the matrix from MediaPipe, which is column-major.
 * The tests build row-major matrices. We expose `rowMajor=false` (default: column-major)
 * so the component can pass false and the tests can pass true.
 *
 * Angles derived using standard Euler decomposition of the rotation part:
 *   pitch = atan2(-r[2][1], r[2][2])  — X axis
 *   yaw   = atan2( r[2][0], sqrt(r[2][1]^2 + r[2][2]^2))  — Y axis (asin)
 *   roll  = atan2(-r[1][0], r[0][0])  — Z axis
 *
 * @param matrix        16-element array (row-major by default for tests, column-major for MediaPipe)
 * @param yawThreshold  Degrees; |yaw| > this → headTurned=true (default 30)
 * @param pitchThreshold Degrees; pitch > this → headDown=true (default 20)
 * @param rowMajor      Set true when matrix is row-major (test helpers); false=column-major (MediaPipe)
 */
export function computeHeadPoseAngles(
  matrix: number[],
  yawThreshold = 30,
  pitchThreshold = 20,
  rowMajor = true
): HeadPoseResult {
  // Extract the 3×3 rotation sub-matrix.
  // Row-major indexing: element (row, col) = matrix[row*4 + col]
  // Column-major indexing (MediaPipe): element (row, col) = matrix[col*4 + row]
  const r = (row: number, col: number) => (rowMajor ? matrix[row * 4 + col] : matrix[col * 4 + row]);

  // Euler angles from rotation matrix (ZYX / Tait-Bryan convention).
  // For a row-major rotation matrix R built by the yawMatrix() test helper,
  // the yaw is encoded in r(0,2) = sin(yaw) and r(2,0) = -sin(yaw).
  // We use atan2 with the correct elements:
  //   yaw   = atan2( r(0,2), r(0,0) )  — Y-axis rotation
  //   pitch = atan2(-r(1,2), r(2,2) )  — X-axis rotation (after yaw)
  //   roll  = atan2( r(1,0), r(1,1) )  — Z-axis rotation
  const yawRad = Math.atan2(r(0, 2), r(0, 0));
  const pitchRad = Math.atan2(-r(1, 2), r(2, 2));
  const rollRad = Math.atan2(r(1, 0), r(1, 1));

  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const pitch = toDeg(pitchRad);
  const yaw = toDeg(yawRad);
  const roll = toDeg(rollRad);

  return {
    pitch,
    yaw,
    roll,
    headTurned: Math.abs(yaw) > yawThreshold,
    headDown: pitch > pitchThreshold,
  };
}

// ─── stepBlinkCounter ────────────────────────────────────────────────────────

/**
 * Rising-edge blink detector: increments count when eye transitions from
 * closed (blendshape ≥ threshold) to open (blendshape < threshold).
 *
 * Accepts the average of left+right eyeBlink blendshape values (0–1).
 * Returns a new (immutable) BlinkState.
 *
 * @param state           Current blink state.
 * @param blendshapeValue Current eyeBlink blendshape value (0=open, 1=closed).
 * @param closedThreshold Value ≥ this means eye is considered closed (default 0.7).
 */
export function stepBlinkCounter(state: BlinkState, blendshapeValue: number, closedThreshold = 0.7): BlinkState {
  const isClosed = blendshapeValue >= closedThreshold;

  if (state.wasClosedLastFrame && !isClosed) {
    // Rising edge: eye opened after being closed → one blink
    return { count: state.count + 1, wasClosedLastFrame: false };
  }

  return { count: state.count, wasClosedLastFrame: isClosed };
}

// ─── stepFocusLostStateMachine ───────────────────────────────────────────────

/**
 * Focus-lost state machine: tracks events where gaze/head indicates attention
 * lost, sustained for at least FOCUS_LOST_THRESHOLD_MS (2 s).
 *
 * Returns a new (immutable) FocusLostState.
 *
 * @param state      Current focus-lost state.
 * @param isLost     Whether focus is considered lost in this frame.
 * @param nowMs      Current timestamp in ms (e.g. performance.now() or Date.now()).
 * @param thresholdMs Sustained duration before counting as an event (default 2000 ms).
 */
export function stepFocusLostStateMachine(
  state: FocusLostState,
  isLost: boolean,
  nowMs: number,
  thresholdMs = FOCUS_LOST_THRESHOLD_MS
): FocusLostState {
  if (!isLost) {
    // Focus regained: accumulate the completed session duration into totalLostMs
    // (exactly once, on exit). lostSince is stored as a negative value when the
    // event was already counted; take the absolute value to get the real start time.
    if (state.lostSince === null) {
      // Was not lost — nothing to accumulate.
      return state;
    }
    const lostSinceAbs = Math.abs(state.lostSince);
    const elapsed = nowMs - lostSinceAbs;
    return {
      count: state.count,
      totalLostMs: state.totalLostMs + Math.max(0, elapsed),
      lostSince: null,
    };
  }

  // Focus is lost
  if (state.lostSince === null) {
    // Start a new lost session
    return { ...state, lostSince: nowMs };
  }

  // We encode "already counted for this session" as a negative lostSince.
  const alreadyCounted = state.lostSince < 0;
  const lostSinceAbs = Math.abs(state.lostSince);
  const elapsed = nowMs - lostSinceAbs;

  if (!alreadyCounted && elapsed >= thresholdMs) {
    // First time crossing the threshold for this loss session — count the event.
    // Mark as counted by negating lostSince (preserves the start time so that
    // the exact duration can be accumulated on focus-regained exit).
    // Do NOT add to totalLostMs here; accumulation happens once on exit.
    return {
      count: state.count + 1,
      totalLostMs: state.totalLostMs,
      lostSince: -lostSinceAbs,
    };
  }

  // Still within the session (not yet past threshold, or already counted):
  // do NOT accumulate totalLostMs per-frame — that causes quadratic growth.
  // Callers that need a live "lost so far" value should compute
  // (nowMs - Math.abs(state.lostSince)) at read time without mutating state.
  return state;
}

// ─── Rolling window helpers ───────────────────────────────────────────────────

/**
 * Add a boolean sample to a rolling window, evicting entries older than windowMs.
 *
 * Returns a new (immutable) RollingWindow.
 */
export function addToRollingWindow(window: RollingWindow, value: boolean, nowMs: number): RollingWindow {
  const cutoff = nowMs - window.windowMs;
  const trimmed = window.entries.filter(e => e.timestamp > cutoff);
  return {
    windowMs: window.windowMs,
    entries: [...trimmed, { value, timestamp: nowMs }],
  };
}

/**
 * Compute a 0–100 score from a rolling window: percentage of positive samples.
 * Returns 100 for an empty window (benefit of the doubt).
 */
export function computeWindowScore(window: RollingWindow): number {
  if (window.entries.length === 0) return 100;
  const positive = window.entries.filter(e => e.value).length;
  return Math.round((positive / window.entries.length) * 100);
}

/**
 * Convenience wrapper: compute eyes score (0–100) from a gaze rolling window.
 * Delegates to computeWindowScore.
 */
export function computeEyesScore(gazeWindow: RollingWindow): number {
  return computeWindowScore(gazeWindow);
}

/**
 * Convenience wrapper: compute head score (0–100) from a head-straight rolling window.
 * Delegates to computeWindowScore.
 */
export function computeHeadScore(headWindow: RollingWindow): number {
  return computeWindowScore(headWindow);
}

// ─── computeLabAttentionIndex ─────────────────────────────────────────────────

/**
 * Aggregate attention index (0–100) from the two REAL computer-vision signals
 * measured in the lab: eyes (gaze on-screen, gated by eyes-open) and head
 * (head straight). Posture is intentionally EXCLUDED — in the lab it is a manual
 * slider, not a measured signal, so it must not inflate the index.
 *
 * Weights preserve the product formula's eyes:head ratio (40:30) renormalized to
 * sum to 1 over the two real signals: eyes = 4/7, head = 3/7.
 *
 * This is the lab's working formula and the candidate to promote into the shared
 * attentionFormula.ts once tuned. Rounded to the nearest integer, clamped [0,100].
 */
export function computeLabAttentionIndex(eyes: number, head: number): number {
  const raw = (4 / 7) * eyes + (3 / 7) * head;
  return Math.min(100, Math.max(0, Math.round(raw)));
}
