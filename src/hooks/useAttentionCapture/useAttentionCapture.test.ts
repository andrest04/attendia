/**
 * useAttentionCapture.test.ts
 *
 * Tests for the Twilio-track-based attention capture hook.
 * MediaPipe is fully mocked — no WASM loaded in any test.
 *
 * Testing patterns follow the existing hook suite:
 *   - renderHook from @testing-library/react-hooks
 *   - jest.useFakeTimers() for interval-based sampling
 *   - inline jest.mock() for the dynamic import of @mediapipe/tasks-vision
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { LocalVideoTrack } from 'twilio-video';

// ---------------------------------------------------------------------------
// Mock @mediapipe/tasks-vision
//
// The hook does `await import('@mediapipe/tasks-vision')` at runtime.
// We must mock the module BEFORE the hook resolves the import.
// ---------------------------------------------------------------------------

const mockClose = jest.fn();
const mockDetectForVideo = jest.fn();
const mockCreateFromOptions = jest.fn();
const mockForVisionTasks = jest.fn();

jest.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: {
    forVisionTasks: (...args: unknown[]) => mockForVisionTasks(...args),
  },
  FaceLandmarker: {
    createFromOptions: (...args: unknown[]) => mockCreateFromOptions(...args),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Flush multiple microtask ticks.
 *
 * Our loadAndStart() chains three awaits (dynamic import, FilesetResolver,
 * createFromOptions). Each `await Promise.resolve()` advances one tick, so we
 * need to flush at least 3-4 ticks to allow all three resolved promises to settle.
 */
async function flushPromises(ticks = 5) {
  for (let i = 0; i < ticks; i++) {
    await Promise.resolve();
  }
}

/** Build a minimal fake LocalVideoTrack for tests. */
function makeMockTrack(): LocalVideoTrack {
  const videoEl = document.createElement('video');
  // Make readyState simulate a ready video
  Object.defineProperty(videoEl, 'readyState', { value: 4, configurable: true });
  return ({
    attach: jest.fn(() => videoEl),
    detach: jest.fn(),
    _videoEl: videoEl,
  } as unknown) as LocalVideoTrack;
}

/**
 * Minimal landmarks array (478 entries — FaceLandmarker extended mesh).
 *
 * Landmark indices that matter for gaze computation (from attentionHeuristics.ts):
 *   LEFT_EYE_OUTER  33: left edge of left eye
 *   LEFT_EYE_INNER 133: right edge of left eye
 *   LEFT_EYE_TOP   159: top of left eye
 *   LEFT_EYE_BOTTOM 145: bottom of left eye
 *   LEFT_IRIS      468: left iris center
 *   RIGHT_EYE_INNER 362: left edge of right eye
 *   RIGHT_EYE_OUTER 263: right edge of right eye
 *   RIGHT_EYE_TOP  386: top of right eye
 *   RIGHT_EYE_BOTTOM 374: bottom of right eye
 *   RIGHT_IRIS     473: right iris center
 *
 * We place irises at the horizontal center of each eye so gazeX ≈ 0.5
 * and gaze reports onScreen=true.
 */
function makeLandmarks(count = 478): Array<{ x: number; y: number; z: number }> {
  const lm = Array.from({ length: count }, () => ({ x: 0.5, y: 0.5, z: 0 }));

  // Left eye: outer at x=0.3, inner at x=0.5, top at y=0.4, bottom at y=0.6
  lm[33] = { x: 0.3, y: 0.5, z: 0 }; // LEFT_EYE_OUTER
  lm[133] = { x: 0.5, y: 0.5, z: 0 }; // LEFT_EYE_INNER
  lm[159] = { x: 0.4, y: 0.4, z: 0 }; // LEFT_EYE_TOP
  lm[145] = { x: 0.4, y: 0.6, z: 0 }; // LEFT_EYE_BOTTOM
  // Iris at center horizontally → leftGazeX = (0.4 - 0.3) / (0.5 - 0.3) = 0.5
  lm[468] = { x: 0.4, y: 0.5, z: 0 }; // LEFT_IRIS

  // Right eye: inner at x=0.5, outer at x=0.7, top at y=0.4, bottom at y=0.6
  lm[362] = { x: 0.5, y: 0.5, z: 0 }; // RIGHT_EYE_INNER
  lm[263] = { x: 0.7, y: 0.5, z: 0 }; // RIGHT_EYE_OUTER
  lm[386] = { x: 0.6, y: 0.4, z: 0 }; // RIGHT_EYE_TOP
  lm[374] = { x: 0.6, y: 0.6, z: 0 }; // RIGHT_EYE_BOTTOM
  // Iris at center horizontally → rightGazeX = (0.6 - 0.5) / (0.7 - 0.5) = 0.5
  lm[473] = { x: 0.6, y: 0.5, z: 0 }; // RIGHT_IRIS

  return lm;
}

/**
 * Minimal identity 4x4 matrix (column-major, as MediaPipe returns).
 * An identity matrix means no rotation → pitch=0, yaw=0 → head straight.
 */
function identityMatrix(): number[] {
  // Column-major identity: diagonals at indices 0,5,10,15
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

/** Build a fake FaceLandmarker result with `faceCount` faces. */
function makeFaceResult(faceCount: number) {
  const landmarks = faceCount > 0 ? Array.from({ length: faceCount }, () => makeLandmarks()) : [];
  const blendshapes =
    faceCount > 0
      ? Array.from({ length: faceCount }, () => ({
          categories: [
            { categoryName: 'eyeBlinkLeft', score: 0.1 },
            { categoryName: 'eyeBlinkRight', score: 0.1 },
            { categoryName: 'jawOpen', score: 0.1 },
          ],
        }))
      : [];
  const matrices =
    faceCount > 0 ? Array.from({ length: faceCount }, () => ({ data: new Float32Array(identityMatrix()) })) : [];

  return {
    faceLandmarks: landmarks,
    faceBlendshapes: blendshapes,
    facialTransformationMatrixes: matrices,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import useAttentionCapture from './useAttentionCapture';

describe('useAttentionCapture', () => {
  beforeEach(() => {
    jest.useFakeTimers();

    // Default mock landmarker: resolves immediately with a .close() and .detectForVideo()
    const mockLandmarker = {
      detectForVideo: mockDetectForVideo,
      close: mockClose,
    };
    mockForVisionTasks.mockResolvedValue({});
    mockCreateFromOptions.mockResolvedValue(mockLandmarker);
    mockDetectForVideo.mockReturnValue(makeFaceResult(0));

    mockClose.mockClear();
    mockDetectForVideo.mockClear();
    mockCreateFromOptions.mockClear();
    mockForVisionTasks.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── Test 1: inactive with no track ──────────────────────────────────────

  it('returns capture=inactive with safe defaults when no track is provided', () => {
    const { result } = renderHook(() => useAttentionCapture(undefined));

    expect(result.current.capture).toBe('inactive');
    expect(result.current.index).toBe(0);
    expect(result.current.components.eyes).toBe(0);
    expect(result.current.components.head).toBe(0);
    expect(result.current.faces).toBe(0);
    expect(result.current.multiface).toBe(false);
  });

  it('does not load MediaPipe when no track is provided', async () => {
    renderHook(() => useAttentionCapture(undefined));
    // Flush any pending microtasks / promise callbacks
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockCreateFromOptions).not.toHaveBeenCalled();
  });

  // ─── Test 2: active once track is bound and landmarker resolves ───────────

  it('becomes capture=active after track is bound and landmarker loads', async () => {
    const track = makeMockTrack();
    // detectForVideo returns 1 face so capture transitions to active
    mockDetectForVideo.mockReturnValue(makeFaceResult(1));

    const { result } = renderHook(() => useAttentionCapture(track));

    // Initially inactive while landmarker loads
    expect(result.current.capture).toBe('inactive');

    // Flush all chained promises (import → FilesetResolver → createFromOptions)
    await act(async () => {
      await flushPromises();
    });

    // Advance past the sampling interval so at least one sample fires,
    // then flush the microtask queue again
    await act(async () => {
      jest.advanceTimersByTime(1100);
      await flushPromises();
    });

    expect(result.current.capture).toBe('active');
  });

  it('attaches the track to a video element on mount', async () => {
    const track = makeMockTrack();
    renderHook(() => useAttentionCapture(track));

    // Attach happens synchronously before the async load — no need to flush
    expect(track.attach).toHaveBeenCalledTimes(1);
  });

  // ─── Test 3: face result → real heuristics (not hardcoded values) ────────

  it('derives index/components from real heuristics when a face is detected', async () => {
    const track = makeMockTrack();
    // 1 face with identity matrix → head straight, eyes on screen (mostly)
    mockDetectForVideo.mockReturnValue(makeFaceResult(1));

    const { result } = renderHook(() => useAttentionCapture(track));

    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      jest.advanceTimersByTime(1100);
      await flushPromises();
    });

    // After one sample the rolling windows have 1 entry.
    // Eyes on screen = true → gazeWindow has 1 positive → eyesScore = 100.
    // Head straight = true → headWindow has 1 positive → headScore = 100.
    // computeLabAttentionIndex(100, 100) = round((4/7)*100 + (3/7)*100) = 100
    expect(result.current.index).toBe(100);
    expect(result.current.components.eyes).toBe(100);
    expect(result.current.components.head).toBe(100);
    expect(result.current.faces).toBe(1);
    expect(result.current.multiface).toBe(false);
  });

  it('produces non-100 index when no face is detected (negative samples decay the window)', async () => {
    const track = makeMockTrack();
    // detectForVideo returns 0 faces
    mockDetectForVideo.mockReturnValue(makeFaceResult(0));

    const { result } = renderHook(() => useAttentionCapture(track));

    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      jest.advanceTimersByTime(1100);
      await flushPromises();
    });

    // With 0 faces, the hook pushes a negative sample to the rolling windows.
    // After 1 negative sample: score = round(0/1 * 100) = 0 for both eyes and head.
    // computeLabAttentionIndex(0, 0) = 0
    expect(result.current.index).toBe(0);
    expect(result.current.faces).toBe(0);
  });

  // ─── Test 4: multiface = true when 2 faces detected ──────────────────────

  it('sets multiface=true when detectForVideo returns 2 faces', async () => {
    const track = makeMockTrack();
    mockDetectForVideo.mockReturnValue(makeFaceResult(2));

    const { result } = renderHook(() => useAttentionCapture(track));

    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      jest.advanceTimersByTime(1100);
      await flushPromises();
    });

    expect(result.current.faces).toBe(2);
    expect(result.current.multiface).toBe(true);
  });

  // ─── Test 5: cleanup on unmount ──────────────────────────────────────────

  it('clears the interval and calls landmarker.close() on unmount', async () => {
    const track = makeMockTrack();
    const clearIntervalSpy = jest.spyOn(window, 'clearInterval');

    const { unmount } = renderHook(() => useAttentionCapture(track));

    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      jest.advanceTimersByTime(1100);
      await flushPromises();
    });

    unmount();

    // clearInterval must have been called to stop the sampling loop
    expect(clearIntervalSpy).toHaveBeenCalled();
    // The FaceLandmarker must be disposed to release WASM/GPU memory
    expect(mockClose).toHaveBeenCalledTimes(1);

    clearIntervalSpy.mockRestore();
  });

  it('detaches the video element from the track on unmount', async () => {
    const track = makeMockTrack();

    const { unmount } = renderHook(() => useAttentionCapture(track));

    await act(async () => {
      await flushPromises();
    });

    unmount();

    expect(track.detach).toHaveBeenCalled();
  });

  // ─── Test 6: cleanup if track changes ────────────────────────────────────

  it('re-initializes when the track changes (detaches old, attaches new)', async () => {
    const track1 = makeMockTrack();
    const track2 = makeMockTrack();

    const { rerender, unmount } = renderHook(({ track }: { track?: LocalVideoTrack }) => useAttentionCapture(track), {
      initialProps: { track: track1 },
    });

    // Attach happens synchronously in the effect body before the async load
    expect(track1.attach).toHaveBeenCalledTimes(1);

    rerender({ track: track2 });

    await act(async () => {
      await flushPromises();
    });

    // Old track should be detached (effect cleanup ran); new track should be attached
    expect(track1.detach).toHaveBeenCalled();
    expect(track2.attach).toHaveBeenCalledTimes(1);

    unmount();
  });
});
