/**
 * Tests for attentionHeuristics.ts — pure geometric heuristics for in-browser
 * face analysis. No MediaPipe imports; all functions take plain data.
 *
 * Pattern: jsdom + ts-jest, Enzyme NOT used (no React). Plain Jest matchers.
 * Style mirrors classSessionTypes.test.ts.
 */

import {
  computeGazeDirection,
  computeHeadPoseAngles,
  stepBlinkCounter,
  stepFocusLostStateMachine,
  addToRollingWindow,
  computeWindowScore,
  computeEyesScore,
  computeHeadScore,
  computeLabAttentionIndex,
  Landmark2D,
  BlinkState,
  FocusLostState,
  RollingWindow,
} from './attentionHeuristics';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a minimal Landmark2D. */
function lm(x: number, y: number): Landmark2D {
  return { x, y };
}

/** Build a 4×4 identity matrix (flat, row-major, 16 numbers). */
function identity4x4(): number[] {
  // prettier-ignore
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

/**
 * Build a 4×4 rotation matrix (row-major) that rotates by `angleDeg` degrees
 * around the Y axis (yaw).
 */
function yawMatrix(angleDeg: number): number[] {
  const r = (angleDeg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  // prettier-ignore
  return [
    c,  0, s, 0,
    0,  1, 0, 0,
    -s, 0, c, 0,
    0,  0, 0, 1,
  ];
}

/**
 * Build a 4×4 rotation matrix (row-major) that rotates by `angleDeg` degrees
 * around the X axis (pitch).
 */
function pitchMatrix(angleDeg: number): number[] {
  const r = (angleDeg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  // prettier-ignore
  return [
    1,  0,  0, 0,
    0,  c, -s, 0,
    0,  s,  c, 0,
    0,  0,  0, 1,
  ];
}

// ─── computeGazeDirection ────────────────────────────────────────────────────

describe('computeGazeDirection', () => {
  /**
   * Build a minimal landmark array.
   * Indices used by the function:
   *   33  = left eye outer corner
   *  133  = left eye inner corner
   *  159  = left eye top
   *  145  = left eye bottom
   *  362  = right eye inner corner
   *  263  = right eye outer corner
   *  386  = right eye top
   *  374  = right eye bottom
   *  468  = left iris center
   *  473  = right iris center
   */
  function makeLandmarks(leftIrisX: number, leftIrisY: number, rightIrisX: number, rightIrisY: number): Landmark2D[] {
    const arr: Landmark2D[] = new Array(480).fill(null).map(() => lm(0, 0));
    // left eye corners at x=0.3..0.4, top/bottom at y=0.45..0.55
    arr[33] = lm(0.3, 0.5);
    arr[133] = lm(0.4, 0.5);
    arr[159] = lm(0.35, 0.45);
    arr[145] = lm(0.35, 0.55);
    // right eye corners at x=0.6..0.7, top/bottom at y=0.45..0.55
    arr[362] = lm(0.6, 0.5);
    arr[263] = lm(0.7, 0.5);
    arr[386] = lm(0.65, 0.45);
    arr[374] = lm(0.65, 0.55);
    // iris centers
    arr[468] = lm(leftIrisX, leftIrisY);
    arr[473] = lm(rightIrisX, rightIrisY);
    return arr;
  }

  it('returns gazeX≈0.5 when both irises are centred horizontally in their eyes', () => {
    // Iris x at midpoint of each eye's horizontal span
    const lms = makeLandmarks(0.35, 0.5, 0.65, 0.5);
    const result = computeGazeDirection(lms);
    expect(result.gazeX).toBeCloseTo(0.5, 1);
  });

  it('returns gazeX<0.4 when irises shift left (toward ear side)', () => {
    // Left iris near left corner (0.31), right iris near its left corner (0.61)
    const lms = makeLandmarks(0.31, 0.5, 0.61, 0.5);
    const result = computeGazeDirection(lms);
    expect(result.gazeX).toBeLessThan(0.4);
  });

  it('returns gazeX>0.6 when irises shift right', () => {
    const lms = makeLandmarks(0.39, 0.5, 0.69, 0.5);
    const result = computeGazeDirection(lms);
    expect(result.gazeX).toBeGreaterThan(0.6);
  });

  it('returns onScreen=true when gaze is centred', () => {
    const lms = makeLandmarks(0.35, 0.5, 0.65, 0.5);
    expect(computeGazeDirection(lms).onScreen).toBe(true);
  });

  it('returns onScreen=false when gaze is far off to one side', () => {
    // Iris pushed hard to the left edge of the eye
    const lms = makeLandmarks(0.3, 0.5, 0.6, 0.5);
    expect(computeGazeDirection(lms).onScreen).toBe(false);
  });
});

// ─── computeHeadPoseAngles ───────────────────────────────────────────────────

describe('computeHeadPoseAngles', () => {
  it('returns pitch≈0, yaw≈0, roll≈0 for an identity matrix', () => {
    const mat = identity4x4();
    const { pitch, yaw, roll } = computeHeadPoseAngles(mat);
    expect(Math.abs(pitch)).toBeLessThan(1);
    expect(Math.abs(yaw)).toBeLessThan(1);
    expect(Math.abs(roll)).toBeLessThan(1);
  });

  it('returns yaw ≈ +30 for a 30° yaw matrix', () => {
    const mat = yawMatrix(30);
    const { yaw } = computeHeadPoseAngles(mat);
    expect(yaw).toBeCloseTo(30, 0);
  });

  it('returns yaw ≈ -45 for a -45° yaw matrix', () => {
    const mat = yawMatrix(-45);
    const { yaw } = computeHeadPoseAngles(mat);
    expect(yaw).toBeCloseTo(-45, 0);
  });

  it('returns pitch ≈ +20 for a 20° pitch matrix', () => {
    const mat = pitchMatrix(20);
    const { pitch } = computeHeadPoseAngles(mat);
    expect(pitch).toBeCloseTo(20, 0);
  });

  it('flags headTurned=true when |yaw|>threshold', () => {
    const mat = yawMatrix(35);
    expect(computeHeadPoseAngles(mat, 30).headTurned).toBe(true);
  });

  it('flags headTurned=false when |yaw|<=threshold', () => {
    const mat = yawMatrix(20);
    expect(computeHeadPoseAngles(mat, 30).headTurned).toBe(false);
  });

  it('flags headDown=true when pitch exceeds threshold', () => {
    const mat = pitchMatrix(25);
    expect(computeHeadPoseAngles(mat, 30, 20).headDown).toBe(true);
  });
});

// ─── stepBlinkCounter ───────────────────────────────────────────────────────

describe('stepBlinkCounter', () => {
  const CLOSED_THRESHOLD = 0.7; // blendshape > threshold → eye considered closed
  const OPEN_THRESHOLD = 0.3; // blendshape < threshold → eye considered open

  function freshState(): BlinkState {
    return { count: 0, wasClosedLastFrame: false };
  }

  it('increments count on a rising-edge close→open transition', () => {
    let state = freshState();
    // Frame 1: eye closed
    state = stepBlinkCounter(state, CLOSED_THRESHOLD + 0.1, CLOSED_THRESHOLD);
    expect(state.count).toBe(0); // no blink yet — eye just closed
    expect(state.wasClosedLastFrame).toBe(true);
    // Frame 2: eye open → rising edge detected
    state = stepBlinkCounter(state, OPEN_THRESHOLD - 0.1, CLOSED_THRESHOLD);
    expect(state.count).toBe(1);
    expect(state.wasClosedLastFrame).toBe(false);
  });

  it('does not increment count when eye stays closed across frames', () => {
    let state = freshState();
    state = stepBlinkCounter(state, CLOSED_THRESHOLD + 0.1, CLOSED_THRESHOLD);
    state = stepBlinkCounter(state, CLOSED_THRESHOLD + 0.2, CLOSED_THRESHOLD);
    expect(state.count).toBe(0);
  });

  it('counts multiple blinks correctly', () => {
    let state = freshState();
    for (let i = 0; i < 3; i++) {
      state = stepBlinkCounter(state, CLOSED_THRESHOLD + 0.1, CLOSED_THRESHOLD);
      state = stepBlinkCounter(state, OPEN_THRESHOLD - 0.1, CLOSED_THRESHOLD);
    }
    expect(state.count).toBe(3);
  });

  it('ignores noise below closed threshold (eye stays open)', () => {
    let state = freshState();
    // Eye stays open across frames — no blink
    state = stepBlinkCounter(state, OPEN_THRESHOLD - 0.1, CLOSED_THRESHOLD);
    state = stepBlinkCounter(state, OPEN_THRESHOLD - 0.05, CLOSED_THRESHOLD);
    expect(state.count).toBe(0);
  });
});

// ─── stepFocusLostStateMachine ───────────────────────────────────────────────

describe('stepFocusLostStateMachine', () => {
  function freshFocusState(): FocusLostState {
    return { count: 0, totalLostMs: 0, lostSince: null };
  }

  it('does not start counting focus lost when head is straight', () => {
    const state = stepFocusLostStateMachine(freshFocusState(), false, 1000);
    expect(state.lostSince).toBeNull();
    expect(state.count).toBe(0);
  });

  it('starts a lost session when head turns', () => {
    const state = stepFocusLostStateMachine(freshFocusState(), true, 1000);
    expect(state.lostSince).toBe(1000);
    expect(state.count).toBe(0); // not yet past threshold
  });

  it('increments count after focus-lost is sustained beyond 2 s', () => {
    let state = freshFocusState();
    state = stepFocusLostStateMachine(state, true, 1000); // lost starts
    state = stepFocusLostStateMachine(state, true, 3001); // 2001 ms later
    expect(state.count).toBe(1);
  });

  it('accumulates totalLostMs while focus is lost, without per-frame inflation', () => {
    let state = freshFocusState();
    state = stepFocusLostStateMachine(state, true, 1000);
    // Drive many frames across 2500 ms of lost focus
    state = stepFocusLostStateMachine(state, true, 1500);
    state = stepFocusLostStateMachine(state, true, 2000);
    state = stepFocusLostStateMachine(state, true, 2500);
    state = stepFocusLostStateMachine(state, true, 3500);
    // totalLostMs before exit should be 0 — accumulation only happens on exit
    expect(state.totalLostMs).toBe(0);

    // Now focus is regained — the session duration (3500 - 1000 = 2500 ms) is
    // added exactly once to totalLostMs.
    state = stepFocusLostStateMachine(state, false, 3500);
    expect(state.totalLostMs).toBeGreaterThanOrEqual(2500);
    expect(state.totalLostMs).toBeLessThanOrEqual(2500 + 50); // tight upper bound
    expect(state.lostSince).toBeNull();
  });

  it('a single continuous lost session of duration D yields totalLostMs === D (not inflated)', () => {
    const START = 5000;
    const DURATION = 4000;
    let state = freshFocusState();
    // Start the lost session
    state = stepFocusLostStateMachine(state, true, START);
    // Simulate many intermediate frames — must not inflate totalLostMs
    for (let t = START + 200; t < START + DURATION; t += 200) {
      state = stepFocusLostStateMachine(state, true, t);
    }
    // Regain focus exactly at START + DURATION
    state = stepFocusLostStateMachine(state, false, START + DURATION);
    expect(state.totalLostMs).toBeGreaterThanOrEqual(DURATION);
    expect(state.totalLostMs).toBeLessThanOrEqual(DURATION + 50);
  });

  it('clears lostSince when focus is regained', () => {
    let state = freshFocusState();
    state = stepFocusLostStateMachine(state, true, 1000);
    state = stepFocusLostStateMachine(state, false, 2000);
    expect(state.lostSince).toBeNull();
  });

  it('does not double-increment count for the same sustained loss', () => {
    let state = freshFocusState();
    state = stepFocusLostStateMachine(state, true, 1000);
    state = stepFocusLostStateMachine(state, true, 3001); // first trigger
    state = stepFocusLostStateMachine(state, true, 3500); // still lost — no new event
    expect(state.count).toBe(1);
  });
});

// ─── Rolling window helpers ──────────────────────────────────────────────────

describe('addToRollingWindow / computeWindowScore', () => {
  function freshWindow(maxMs = 10000): RollingWindow {
    return { entries: [], windowMs: maxMs };
  }

  it('appends entries to the window', () => {
    let w = freshWindow();
    w = addToRollingWindow(w, true, 1000);
    expect(w.entries).toHaveLength(1);
  });

  it('evicts entries older than windowMs', () => {
    let w = freshWindow(5000);
    w = addToRollingWindow(w, true, 0);
    w = addToRollingWindow(w, true, 4999); // still in window
    w = addToRollingWindow(w, false, 6000); // this call: 0 is now older than 5000 ms
    // entry at t=0 is 6000 ms old → evicted; entry at t=4999 is 1001 ms old → kept
    expect(w.entries.length).toBe(2); // 4999 and 6000 survive
  });

  it('returns 100 when all entries in the window are positive', () => {
    let w = freshWindow();
    w = addToRollingWindow(w, true, 1000);
    w = addToRollingWindow(w, true, 2000);
    expect(computeWindowScore(w)).toBe(100);
  });

  it('returns 0 when all entries in the window are negative', () => {
    let w = freshWindow();
    w = addToRollingWindow(w, false, 1000);
    w = addToRollingWindow(w, false, 2000);
    expect(computeWindowScore(w)).toBe(0);
  });

  it('returns 50 when half the entries are positive', () => {
    let w = freshWindow();
    w = addToRollingWindow(w, true, 1000);
    w = addToRollingWindow(w, false, 2000);
    expect(computeWindowScore(w)).toBe(50);
  });

  it('returns 100 for an empty window (benefit of the doubt)', () => {
    expect(computeWindowScore(freshWindow())).toBe(100);
  });
});

// ─── computeEyesScore ───────────────────────────────────────────────────────

describe('computeEyesScore', () => {
  function makeWindow(positiveCount: number, total: number): RollingWindow {
    let w: RollingWindow = { entries: [], windowMs: 10000 };
    for (let i = 0; i < total; i++) {
      w = addToRollingWindow(w, i < positiveCount, i * 500);
    }
    return w;
  }

  it('returns a score between 0 and 100 inclusive', () => {
    const score = computeEyesScore(makeWindow(3, 5));
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('returns 100 for an all-positive window', () => {
    expect(computeEyesScore(makeWindow(5, 5))).toBe(100);
  });

  it('returns 0 for an all-negative window', () => {
    expect(computeEyesScore(makeWindow(0, 5))).toBe(0);
  });
});

// ─── computeHeadScore ───────────────────────────────────────────────────────

describe('computeHeadScore', () => {
  function makeWindow(straightCount: number, total: number): RollingWindow {
    let w: RollingWindow = { entries: [], windowMs: 10000 };
    for (let i = 0; i < total; i++) {
      w = addToRollingWindow(w, i < straightCount, i * 500);
    }
    return w;
  }

  it('returns 100 when head is always straight', () => {
    expect(computeHeadScore(makeWindow(5, 5))).toBe(100);
  });

  it('returns 0 when head is never straight', () => {
    expect(computeHeadScore(makeWindow(0, 5))).toBe(0);
  });

  it('returns a value between 0 and 100 for mixed data', () => {
    const score = computeHeadScore(makeWindow(3, 5));
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ─── computeLabAttentionIndex ─────────────────────────────────────────────────

describe('computeLabAttentionIndex', () => {
  it('returns 100 when both real signals are maxed', () => {
    expect(computeLabAttentionIndex(100, 100)).toBe(100);
  });

  it('returns 0 when both real signals are zero', () => {
    expect(computeLabAttentionIndex(0, 0)).toBe(0);
  });

  it('weights eyes more than head (eyes 4/7, head 3/7)', () => {
    // eyes only → 4/7 ≈ 57; head only → 3/7 ≈ 43
    expect(computeLabAttentionIndex(100, 0)).toBe(57);
    expect(computeLabAttentionIndex(0, 100)).toBe(43);
    expect(computeLabAttentionIndex(100, 0)).toBeGreaterThan(computeLabAttentionIndex(0, 100));
  });

  it('does NOT take posture into account (no third argument)', () => {
    // Same eyes+head must yield the same index regardless of any posture value.
    expect(computeLabAttentionIndex(80, 60)).toBe(Math.round((4 / 7) * 80 + (3 / 7) * 60));
  });

  it('clamps and rounds out-of-range inputs to [0, 100]', () => {
    expect(computeLabAttentionIndex(200, 200)).toBe(100);
    expect(computeLabAttentionIndex(-50, -50)).toBe(0);
  });
});
