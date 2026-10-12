import { analyzeFrame, createLandmarker, freshAnalysisState, toFaceFrame } from './frameAnalysis';

/** Landmarks with both irises centered in their eyes → the gaze reads as on-screen. */
function onScreenLandmarks(): Array<{ x: number; y: number; z: number }> {
  const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  lm[33] = { x: 0.3, y: 0.5, z: 0 };
  lm[133] = { x: 0.5, y: 0.5, z: 0 };
  lm[159] = { x: 0.4, y: 0.4, z: 0 };
  lm[145] = { x: 0.4, y: 0.6, z: 0 };
  lm[468] = { x: 0.4, y: 0.5, z: 0 };
  lm[362] = { x: 0.5, y: 0.5, z: 0 };
  lm[263] = { x: 0.7, y: 0.5, z: 0 };
  lm[386] = { x: 0.6, y: 0.4, z: 0 };
  lm[374] = { x: 0.6, y: 0.6, z: 0 };
  lm[473] = { x: 0.6, y: 0.5, z: 0 };
  return lm;
}

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Column-major rotation about the vertical axis — a head turned by `degrees`. */
function turnedHead(degrees: number): number[] {
  const rad = (degrees * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
}

const rawDetection = (blinkLeft = 0.1, blinkRight = 0.1, matrix: number[] | null = identity) => ({
  faceLandmarks: [onScreenLandmarks()],
  faceBlendshapes: [
    {
      categories: [
        { categoryName: 'eyeBlinkLeft', score: blinkLeft },
        { categoryName: 'eyeBlinkRight', score: blinkRight },
        { categoryName: 'jawOpen', score: 0.9 },
      ],
    },
  ],
  facialTransformationMatrixes: matrix ? [{ data: new Float32Array(matrix) }] : [],
});

describe('toFaceFrame', () => {
  it('reports no faces for an empty or missing detection', () => {
    expect(toFaceFrame({ faceLandmarks: [] })).toEqual({ faces: 0 });
    expect(toFaceFrame({})).toEqual({ faces: 0 });
  });

  it('extracts the primary face, the mean blink and the head matrix', () => {
    const frame: any = toFaceFrame(rawDetection(0.2, 0.4));

    expect(frame.faces).toBe(1);
    expect(frame.landmarks).toHaveLength(478);
    expect(frame.blinkAverage).toBeCloseTo(0.3);
    expect(frame.headMatrix).toEqual(identity);
  });

  it('counts every detected face but analyses the first', () => {
    const detection = { ...rawDetection(), faceLandmarks: [onScreenLandmarks(), onScreenLandmarks()] };
    expect(toFaceFrame(detection).faces).toBe(2);
  });

  it('treats missing blendshapes as eyes open and a missing matrix as unknown', () => {
    const frame: any = toFaceFrame({ faceLandmarks: [onScreenLandmarks()] });

    expect(frame.blinkAverage).toBe(0);
    expect(frame.headMatrix).toBeNull();
  });
});

describe('analyzeFrame', () => {
  const attentive: any = toFaceFrame(rawDetection());

  it('scores an attentive face as fully on task', () => {
    const { scores } = analyzeFrame(freshAnalysisState(), attentive, 1000);
    expect(scores).toEqual({ eyes: 100, head: 100, index: 100 });
  });

  it('decays the scores when no face is detected', () => {
    let state = freshAnalysisState();
    state = analyzeFrame(state, attentive, 1000).state;
    const lost = analyzeFrame(state, { faces: 0 }, 2000);

    expect(lost.scores.eyes).toBe(50);
    expect(lost.scores.head).toBe(50);
    expect(lost.scores.index).toBeLessThan(100);
  });

  it('counts closed eyes as off task even when the gaze is on screen', () => {
    const closed: any = toFaceFrame(rawDetection(0.9, 0.9));
    expect(analyzeFrame(freshAnalysisState(), closed, 1000).scores.eyes).toBe(0);
  });

  it('counts a clearly turned head as off task', () => {
    const turned: any = toFaceFrame(rawDetection(0.1, 0.1, turnedHead(60)));
    expect(analyzeFrame(freshAnalysisState(), turned, 1000).scores.head).toBe(0);
  });

  it('counts blinks on the rising edge and focus-lost events on sustained head turns', () => {
    const closed: any = toFaceFrame(rawDetection(0.9, 0.9));
    const turned: any = toFaceFrame(rawDetection(0.1, 0.1, turnedHead(60)));

    let state = freshAnalysisState();
    state = analyzeFrame(state, closed, 1000).state;
    state = analyzeFrame(state, attentive, 2000).state;
    expect(state.blink.count).toBe(1);

    state = analyzeFrame(state, turned, 3000).state;
    state = analyzeFrame(state, turned, 5500).state;
    expect(state.focusLost.count).toBe(1);
  });

  it('never mutates the previous state', () => {
    const before = freshAnalysisState();
    analyzeFrame(before, attentive, 1000);
    expect(before.gazeWindow.entries).toEqual([]);
    expect(before.headWindow.entries).toEqual([]);
    expect(before.blink.count).toBe(0);
  });

  it('works without a head matrix (head assumed on task)', () => {
    const noMatrix: any = toFaceFrame(rawDetection(0.1, 0.1, null));
    expect(analyzeFrame(freshAnalysisState(), noMatrix, 1000).scores.head).toBe(100);
  });
});

describe('createLandmarker', () => {
  const resolver = { wasm: true };
  const makeFaceLandmarker = (create: jest.Mock) => ({ createFromOptions: create });

  it('prefers the GPU delegate and passes the detection options', async () => {
    const create = jest.fn().mockResolvedValue('landmarker');

    await expect(createLandmarker(makeFaceLandmarker(create), resolver, 'model.task', () => false)).resolves.toBe(
      'landmarker'
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(resolver, {
      baseOptions: { modelAssetPath: 'model.task', delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 2,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
  });

  it('falls back to the CPU when the GPU cannot be initialised', async () => {
    const create = jest
      .fn()
      .mockRejectedValueOnce(new Error('no webgl'))
      .mockResolvedValueOnce('cpu-landmarker');

    await expect(createLandmarker(makeFaceLandmarker(create), resolver, 'm', () => false)).resolves.toBe(
      'cpu-landmarker'
    );

    expect(create.mock.calls[1][1].baseOptions.delegate).toBe('CPU');
  });

  it('rejects with the last error when every delegate fails', async () => {
    const create = jest
      .fn()
      .mockRejectedValueOnce(new Error('gpu'))
      .mockRejectedValueOnce(new Error('cpu'));

    await expect(createLandmarker(makeFaceLandmarker(create), resolver, 'm', () => false)).rejects.toThrow('cpu');
  });

  it('stops without trying the CPU when the caller was disposed after the GPU failed', async () => {
    const create = jest.fn().mockRejectedValue(new Error('gpu'));

    await expect(createLandmarker(makeFaceLandmarker(create), resolver, 'm', () => true)).resolves.toBeNull();

    expect(create).toHaveBeenCalledTimes(1);
  });
});
