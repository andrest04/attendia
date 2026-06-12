/**
 * AttentionLab.tsx — Dev-only spike: real in-browser face analysis
 * using MediaPipe Tasks Vision FaceLandmarker + webcam.
 *
 * HARD RULE: nothing in this file (or anywhere under src/components/lab/)
 * may be imported by the real video flow. This is isolated spike code only.
 * Same convention as src/components/design/wireframe.ts.
 *
 * Runs ISOLATED: camera only via getUserMedia.
 * No Twilio SDK providers (VideoProvider / ParticipantProvider / ChatProvider)
 * are mounted on this route. AppStateProvider is present in the tree but makes
 * no Twilio connections here.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import CircularProgress from '@material-ui/core/CircularProgress';
import Container from '@material-ui/core/Container';
import Divider from '@material-ui/core/Divider';
import Paper from '@material-ui/core/Paper';
import Slider from '@material-ui/core/Slider';
import Switch from '@material-ui/core/Switch';
import Typography from '@material-ui/core/Typography';
import FormControlLabel from '@material-ui/core/FormControlLabel';

import { computeAttentionIndex } from '../../AttentionProvider/attentionFormula';
import { AttentionComponents, AttentionLevel } from '../../AttentionProvider/types';
import {
  computeGazeDirection,
  computeHeadPoseAngles,
  stepBlinkCounter,
  stepFocusLostStateMachine,
  addToRollingWindow,
  computeEyesScore,
  computeHeadScore,
  BlinkState,
  FocusLostState,
  RollingWindow,
  Landmark2D,
} from './attentionHeuristics';

// ─── MediaPipe lazy import (CDN WASM, not bundled) ─────────────────────────
// We load mediapipe at runtime to avoid CRA bundling issues with WASM.
// Type-only reference is needed for the function signature.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FaceLandmarkerResult = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FaceLandmarkerType = any;

// ─── Constants ──────────────────────────────────────────────────────────────

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const ROLLING_WINDOW_MS = 10000;
// A real yawn opens the jaw wide; lower values fire on speech/smiles.
const JAW_OPEN_THRESHOLD = 0.5; // blendshape value
// Default blink threshold. Glasses attenuate eyeBlink blendshape values,
// so this is calibratable from the UI (raw value shown in the counters panel).
const DEFAULT_BLINK_THRESHOLD = 0.45;

// Attention level ranges (from existing domain — lowMax=40 / mediumMax=70)
const RANGES = { lowMax: 40, mediumMax: 70 };

function attentionLevel(score: number): AttentionLevel {
  if (score <= RANGES.lowMax) return 'low';
  if (score <= RANGES.mediumMax) return 'medium';
  return 'high';
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    height: '100vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
    background: '#0a0a0f',
    color: '#e0e0e0',
  },
  header: {
    background: '#12121a',
    borderBottom: '1px solid #222235',
    padding: theme.spacing(1, 3),
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  },
  content: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    paddingTop: theme.spacing(1.5),
    paddingBottom: theme.spacing(1.5),
  },
  devChip: {
    background: '#f59e0b',
    color: '#1a1a1a',
    fontWeight: 700,
    fontSize: 11,
  },
  mainGrid: {
    flex: 1,
    minHeight: 0,
    display: 'grid',
    gridTemplateColumns: '1fr 320px',
    gap: theme.spacing(1.5),
  },
  leftCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: 0,
    gap: theme.spacing(1.5),
  },
  rightCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: 0,
    gap: theme.spacing(1.5),
    overflowY: 'auto' as const,
  },
  bottomRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing(1.5),
  },
  videoWrapper: {
    position: 'relative',
    background: '#000',
    borderRadius: 8,
    overflow: 'hidden',
    flex: 1,
    minHeight: 0,
    width: 'auto',
    maxWidth: '100%',
    alignSelf: 'center' as const,
    aspectRatio: '16/9',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
  panel: {
    background: '#12121a',
    border: '1px solid #222235',
    borderRadius: 8,
    padding: theme.spacing(1.25),
  },
  panelTitle: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#6b6b8a',
    marginBottom: theme.spacing(0.75),
  },
  counter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing(0.25, 0),
  },
  counterLabel: {
    fontSize: 12,
    color: '#a0a0c0',
  },
  counterValue: {
    fontSize: 14,
    fontWeight: 700,
    color: '#e0e0e0',
    fontFamily: 'monospace',
  },
  scoreIndex: {
    fontSize: 32,
    fontWeight: 800,
    textAlign: 'center' as const,
    fontFamily: 'monospace',
    lineHeight: 1,
  },
  levelChip: {
    marginTop: theme.spacing(0.5),
    fontWeight: 700,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#a0a0c0',
    marginBottom: theme.spacing(0.5),
  },
  perfRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing(0.25, 0),
  },
  perfLabel: {
    fontSize: 12,
    color: '#6b6b8a',
  },
  perfValue: {
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'monospace',
    color: '#7dd3fc',
  },
  warningRow: {
    background: '#2d1a1a',
    border: '1px solid #7f1d1d',
    borderRadius: 6,
    padding: theme.spacing(0.75, 1),
    marginTop: theme.spacing(0.5),
  },
  warningText: {
    fontSize: 12,
    color: '#fca5a5',
  },
  controls: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    gap: theme.spacing(1),
  },
}));

// ─── Analysis state ──────────────────────────────────────────────────────────

interface AnalysisState {
  blink: BlinkState;
  focusLost: FocusLostState;
  // Yawn reuses the generic rising-edge counter (one count per jaw open/close cycle).
  yawn: BlinkState;
  // Raw blendshape values from the last analyzed frame, shown for threshold calibration.
  lastBlinkValue: number;
  lastJawValue: number;
  multiface: boolean;
  absentMs: number;
  absentSince: number | null;
  gazeWindow: RollingWindow;
  headWindow: RollingWindow;
  // "turned head but looking at screen" detection
  headTurnedButGazingScreen: boolean;
}

function freshAnalysisState(): AnalysisState {
  return {
    blink: { count: 0, wasClosedLastFrame: false },
    focusLost: { count: 0, totalLostMs: 0, lostSince: null },
    yawn: { count: 0, wasClosedLastFrame: false },
    lastBlinkValue: 0,
    lastJawValue: 0,
    multiface: false,
    absentMs: 0,
    absentSince: null,
    gazeWindow: { entries: [], windowMs: ROLLING_WINDOW_MS },
    headWindow: { entries: [], windowMs: ROLLING_WINDOW_MS },
    headTurnedButGazingScreen: false,
  };
}

interface PerfState {
  lastInferenceMs: number;
  emaMs: number;
  maxMs: number;
  frameCount: number;
  effectiveFps: number;
  lastFpsCheck: number;
  framesAtLastCheck: number;
}

function freshPerfState(): PerfState {
  return {
    lastInferenceMs: 0,
    emaMs: 0,
    maxMs: 0,
    frameCount: 0,
    effectiveFps: 0,
    lastFpsCheck: 0,
    framesAtLastCheck: 0,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AttentionLab() {
  const classes = useStyles();

  // MediaPipe FaceLandmarker (loaded lazily)
  const landmarkerRef = useRef<FaceLandmarkerType | null>(null);
  const [loadingModel, setLoadingModel] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  // Camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Set to true in the mount effect's cleanup so async callbacks can bail out.
  const disposedRef = useRef(false);

  // Analysis control
  const [analysisActive, setAnalysisActive] = useState(true);
  const [analysisFps, setAnalysisFps] = useState(2);
  const [blinkThreshold, setBlinkThreshold] = useState(DEFAULT_BLINK_THRESHOLD);

  // Analysis state (mutable ref — updated in rAF loop, snapshot to React state for display)
  const analysisRef = useRef<AnalysisState>(freshAnalysisState());
  const perfRef = useRef<PerfState>(freshPerfState());
  const lastAnalysisTimestampRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  // Posture is manual (Phase 2 placeholder)
  const [postureScore, setPostureScore] = useState(70);

  // Display state (React state for rendering)
  const [displayAnalysis, setDisplayAnalysis] = useState<AnalysisState>(freshAnalysisState());
  const [displayPerf, setDisplayPerf] = useState<PerfState>(freshPerfState());
  const [displayComponents, setDisplayComponents] = useState<AttentionComponents>({
    eyes: 100,
    posture: 70,
    head: 100,
  });

  // ── Load MediaPipe model ──────────────────────────────────────────────────

  const loadModel = useCallback(async () => {
    setLoadingModel(true);
    setModelError(null);
    try {
      // Dynamic import to avoid WASM bundling issues with CRA
      const vision = await import('@mediapipe/tasks-vision');
      const { FaceLandmarker, FilesetResolver } = vision;

      const filesetResolver = await FilesetResolver.forVisionTasks(WASM_CDN);
      const fl = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 2,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
      // Guard: component may have unmounted while awaiting the model download.
      if (disposedRef.current) {
        try {
          fl.close();
        } catch (_) {
          /* ignore close errors on abandoned load */
        }
        return;
      }
      landmarkerRef.current = fl;
      setModelReady(true);
    } catch (err) {
      if (disposedRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      setModelError(`Error al cargar el modelo: ${msg}`);
    } finally {
      if (!disposedRef.current) setLoadingModel(false);
    }
  }, []);

  // ── Start camera ─────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      // Guard: component may have unmounted while awaiting getUserMedia.
      // If so, stop all tracks immediately so the camera light turns off.
      if (disposedRef.current || !videoRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraActive(true);
    } catch (err) {
      if (disposedRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      setCameraError(`No se pudo acceder a la cámara: ${msg}`);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // ── Draw overlay ──────────────────────────────────────────────────────────

  const drawOverlay = useCallback(
    (
      result: FaceLandmarkerResult,
      videoWidth: number,
      videoHeight: number,
      headPoses: Array<{ pitch: number; yaw: number; roll: number }>
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = videoWidth;
      canvas.height = videoHeight;
      ctx.clearRect(0, 0, videoWidth, videoHeight);

      result.faceLandmarks.forEach((landmarks: Landmark2D[], faceIdx: number) => {
        // Draw all landmarks as small dots
        ctx.fillStyle = 'rgba(100, 220, 100, 0.6)';
        landmarks.forEach((lm, idx) => {
          // Highlight iris landmarks
          const isIris = idx === 468 || idx === 473;
          ctx.fillStyle = isIris ? 'rgba(50, 180, 255, 1)' : 'rgba(100, 220, 100, 0.5)';
          const r = isIris ? 3 : 1;
          ctx.beginPath();
          ctx.arc(lm.x * videoWidth, lm.y * videoHeight, r, 0, Math.PI * 2);
          ctx.fill();
        });

        // Draw head-pose axes from nose tip (landmark 1)
        if (headPoses[faceIdx] && landmarks[1]) {
          const nose = landmarks[1];
          const nx = nose.x * videoWidth;
          const ny = nose.y * videoHeight;
          const axisLength = Math.min(videoWidth, videoHeight) * 0.12;

          const { pitch, yaw, roll } = headPoses[faceIdx];
          const toRad = (d: number) => (d * Math.PI) / 180;

          // Yaw axis (Y rotation) — drawn in red
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(nx, ny);
          ctx.lineTo(nx + axisLength * Math.sin(toRad(yaw)), ny);
          ctx.stroke();

          // Pitch axis (X rotation) — drawn in green
          ctx.strokeStyle = '#22c55e';
          ctx.beginPath();
          ctx.moveTo(nx, ny);
          ctx.lineTo(nx, ny + axisLength * Math.sin(toRad(pitch)));
          ctx.stroke();

          // Roll axis (Z rotation) — drawn in blue
          ctx.strokeStyle = '#3b82f6';
          ctx.beginPath();
          ctx.moveTo(nx, ny);
          ctx.lineTo(nx + axisLength * 0.5 * Math.sin(toRad(roll)), ny - axisLength * 0.5 * Math.cos(toRad(roll)));
          ctx.stroke();
        }
      });
    },
    []
  );

  // ── Analysis loop ─────────────────────────────────────────────────────────

  const runAnalysis = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.paused || video.ended || !landmarkerRef.current) {
      rafIdRef.current = requestAnimationFrame(runAnalysis);
      return;
    }

    const now = performance.now();
    const intervalMs = 1000 / analysisFps;
    const shouldAnalyze =
      analysisActive && document.visibilityState !== 'hidden' && now - lastAnalysisTimestampRef.current >= intervalMs;

    if (shouldAnalyze) {
      lastAnalysisTimestampRef.current = now;
      const t0 = performance.now();

      let result: FaceLandmarkerResult;
      try {
        result = landmarkerRef.current.detectForVideo(video, now);
      } catch {
        rafIdRef.current = requestAnimationFrame(runAnalysis);
        return;
      }

      const inferenceMs = performance.now() - t0;

      // Update perf
      const perf = perfRef.current;
      const newEma = perf.emaMs === 0 ? inferenceMs : perf.emaMs * 0.9 + inferenceMs * 0.1;
      const newMax = Math.max(perf.maxMs, inferenceMs);
      const newFrameCount = perf.frameCount + 1;

      // FPS measurement every second
      let newFps = perf.effectiveFps;
      let newFpsCheck = perf.lastFpsCheck;
      let newFramesAtCheck = perf.framesAtLastCheck;
      if (now - perf.lastFpsCheck > 1000) {
        newFps = (newFrameCount - perf.framesAtLastCheck) / ((now - perf.lastFpsCheck) / 1000);
        newFpsCheck = now;
        newFramesAtCheck = newFrameCount;
      }
      perfRef.current = {
        lastInferenceMs: inferenceMs,
        emaMs: newEma,
        maxMs: newMax,
        frameCount: newFrameCount,
        effectiveFps: newFps,
        lastFpsCheck: newFpsCheck,
        framesAtLastCheck: newFramesAtCheck,
      };

      // Process faces
      const numFaces = result.faceLandmarks ? result.faceLandmarks.length : 0;
      const state = analysisRef.current;
      let newState = { ...state };

      if (numFaces === 0) {
        // No face detected
        const absentSince = state.absentSince ?? now;
        newState.absentMs = now - absentSince;
        newState.absentSince = absentSince;
        newState.multiface = false;
      } else {
        newState.absentSince = null;
        newState.multiface = numFaces > 1;

        // Use first face for all per-face signals
        const landmarks: Landmark2D[] = result.faceLandmarks[0];
        const blendshapes =
          result.faceBlendshapes && result.faceBlendshapes[0] ? result.faceBlendshapes[0].categories : [];

        const getBlend = (name: string): number => {
          const cat = blendshapes.find((c: { categoryName: string }) => c.categoryName === name);
          return cat ? cat.score : 0;
        };

        // Blink: average of left+right eyeBlink blendshapes (threshold calibratable from UI)
        const blinkAvg = (getBlend('eyeBlinkLeft') + getBlend('eyeBlinkRight')) / 2;
        newState.blink = stepBlinkCounter(state.blink, blinkAvg, blinkThreshold);

        // Yawn: jawOpen blendshape through the same rising-edge counter
        // (one count per open/close cycle — no per-frame inflation)
        const jawOpen = getBlend('jawOpen');
        newState.yawn = stepBlinkCounter(state.yawn, jawOpen, JAW_OPEN_THRESHOLD);

        // Expose raw blendshape values for threshold calibration in the UI
        newState.lastBlinkValue = blinkAvg;
        newState.lastJawValue = jawOpen;

        // Gaze direction from iris landmarks
        const gaze = computeGazeDirection(landmarks);

        // Head pose from transformation matrix (column-major from MediaPipe)
        const matData =
          result.facialTransformationMatrixes && result.facialTransformationMatrixes[0]
            ? Array.from(result.facialTransformationMatrixes[0].data as Float32Array)
            : null;

        let headPose = { pitch: 0, yaw: 0, roll: 0, headTurned: false, headDown: false };
        if (matData) {
          // MediaPipe returns column-major matrices; pass rowMajor=false
          headPose = computeHeadPoseAngles(matData, 30, 20, false);
        }

        // Focus lost: head turned or head down and not compensated by gaze
        const focusLost = headPose.headTurned || headPose.headDown;
        newState.focusLost = stepFocusLostStateMachine(state.focusLost, focusLost, now);

        // Rolling windows
        newState.gazeWindow = addToRollingWindow(state.gazeWindow, gaze.onScreen, now);
        newState.headWindow = addToRollingWindow(state.headWindow, !headPose.headTurned && !headPose.headDown, now);

        // "Head turned but looking at screen" — the key demo indicator
        newState.headTurnedButGazingScreen = headPose.headTurned && gaze.onScreen;
      }

      analysisRef.current = newState;

      // Compute head poses for all faces (for overlay drawing)
      const headPoses = (result.facialTransformationMatrixes || []).map((mx: { data: Float32Array }) => {
        const arr = Array.from(mx.data);
        return computeHeadPoseAngles(arr, 30, 20, false);
      });

      // Draw overlay
      drawOverlay(result, video.videoWidth, video.videoHeight, headPoses);

      // Snapshot to React state (throttled by analysis fps — no extra setInterval needed)
      const eyesScore = computeEyesScore(newState.gazeWindow);
      const headScore = computeHeadScore(newState.headWindow);
      const components: AttentionComponents = {
        eyes: eyesScore,
        posture: postureScore,
        head: headScore,
      };

      setDisplayAnalysis({ ...newState });
      setDisplayPerf({ ...perfRef.current });
      setDisplayComponents(components);
    }

    rafIdRef.current = requestAnimationFrame(runAnalysis);
  }, [analysisActive, analysisFps, blinkThreshold, drawOverlay, postureScore]);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    loadModel();
    return () => {
      disposedRef.current = true;
      stopCamera();
      // Release WASM memory and GPU context held by the FaceLandmarker.
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch (_) {
          /* ignore */
        }
        landmarkerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restart rAF loop when dependencies change
  useEffect(() => {
    if (!cameraActive || !modelReady) return;
    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(runAnalysis);
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, [cameraActive, modelReady, runAnalysis]);

  // ── Derived display values ────────────────────────────────────────────────

  const attentionIndex = computeAttentionIndex(displayComponents);
  const level = attentionLevel(attentionIndex);
  const levelColor = level === 'high' ? '#22c55e' : level === 'medium' ? '#f59e0b' : '#ef4444';
  const levelLabel = level === 'high' ? 'Alta' : level === 'medium' ? 'Media' : 'Baja';

  const fmtMs = (n: number) => `${n.toFixed(1)} ms`;
  const fmtFps = (n: number) => `${n.toFixed(1)} fps`;
  const fmtMs2 = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Box className={classes.root}>
      {/* Header */}
      <Box className={classes.header}>
        <Typography variant="h6" style={{ color: '#e0e0e0', fontWeight: 700 }}>
          🔬 Attention Analysis Lab
        </Typography>
        <Chip label="DEV ONLY" className={classes.devChip} size="small" />
        {modelReady && <Chip label="Modelo cargado" size="small" style={{ background: '#166534', color: '#bbf7d0' }} />}
        {loadingModel && <CircularProgress size={16} style={{ color: '#f59e0b' }} />}
      </Box>

      <Container maxWidth="xl" className={classes.content}>
        {/* Error states */}
        {modelError && (
          <Box className={classes.warningRow} style={{ marginBottom: 8 }}>
            <Typography className={classes.warningText}>{modelError}</Typography>
          </Box>
        )}
        {cameraError && (
          <Box className={classes.warningRow} style={{ marginBottom: 8 }}>
            <Typography className={classes.warningText}>{cameraError}</Typography>
          </Box>
        )}

        <Box className={classes.mainGrid}>
          {/* Left: video + controls */}
          <Box className={classes.leftCol}>
            <Box className={classes.videoWrapper}>
              <video ref={videoRef} className={classes.video} autoPlay muted playsInline />
              <canvas ref={canvasRef} className={classes.canvas} />
              {!cameraActive && (
                <Box
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.7)',
                  }}
                >
                  <Typography style={{ color: '#6b6b8a' }}>Cámara inactiva</Typography>
                </Box>
              )}
            </Box>

            {/* Controls */}
            <Box className={classes.controls}>
              {!cameraActive ? (
                <Button
                  variant="contained"
                  onClick={startCamera}
                  disabled={loadingModel}
                  style={{ background: '#3b82f6', color: '#fff' }}
                >
                  Iniciar cámara
                </Button>
              ) : (
                <Button variant="outlined" onClick={stopCamera} style={{ color: '#ef4444', borderColor: '#ef4444' }}>
                  Detener cámara
                </Button>
              )}
              <FormControlLabel
                style={{ margin: 0 }}
                control={
                  <Switch
                    checked={analysisActive}
                    onChange={e => setAnalysisActive(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Typography style={{ color: '#a0a0c0', fontSize: 13 }}>
                    {analysisActive ? 'Pausar análisis' : 'Reanudar análisis'}
                  </Typography>
                }
              />
            </Box>

            {/* Bottom row: configuration + performance side by side */}
            <Box className={classes.bottomRow}>
              <Paper className={classes.panel}>
                <Typography className={classes.panelTitle}>Configuración</Typography>
                <Typography className={classes.sliderLabel}>Frecuencia de análisis: {analysisFps} fps</Typography>
                <Slider
                  value={analysisFps}
                  min={0.5}
                  max={30}
                  step={0.5}
                  onChange={(_e, v) => setAnalysisFps(v as number)}
                  style={{ color: '#3b82f6' }}
                />
                <Box style={{ marginTop: 4 }}>
                  <Typography className={classes.sliderLabel}>
                    Umbral de parpadeo: {blinkThreshold.toFixed(2)}
                  </Typography>
                  <Slider
                    value={blinkThreshold}
                    min={0.1}
                    max={0.9}
                    step={0.05}
                    onChange={(_e, v) => setBlinkThreshold(v as number)}
                    style={{ color: '#22c55e' }}
                  />
                </Box>
                <Box style={{ marginTop: 4 }}>
                  <Typography className={classes.sliderLabel}>
                    Postura (simulado — PoseLandmarker fase 2): {postureScore}
                  </Typography>
                  <Slider
                    value={postureScore}
                    min={0}
                    max={100}
                    onChange={(_e, v) => setPostureScore(v as number)}
                    style={{ color: '#a855f7' }}
                  />
                </Box>
              </Paper>

              {/* Performance panel */}
              <Paper className={classes.panel}>
                <Typography className={classes.panelTitle}>Rendimiento (por inferencia)</Typography>
                <Box className={classes.perfRow}>
                  <Typography className={classes.perfLabel}>Última latencia</Typography>
                  <Typography className={classes.perfValue}>{fmtMs(displayPerf.lastInferenceMs)}</Typography>
                </Box>
                <Box className={classes.perfRow}>
                  <Typography className={classes.perfLabel}>Media exp. móvil (EMA)</Typography>
                  <Typography className={classes.perfValue}>{fmtMs(displayPerf.emaMs)}</Typography>
                </Box>
                <Box className={classes.perfRow}>
                  <Typography className={classes.perfLabel}>Máximo</Typography>
                  <Typography className={classes.perfValue}>{fmtMs(displayPerf.maxMs)}</Typography>
                </Box>
                <Box className={classes.perfRow}>
                  <Typography className={classes.perfLabel}>FPS efectivos</Typography>
                  <Typography className={classes.perfValue}>{fmtFps(displayPerf.effectiveFps)}</Typography>
                </Box>
                <Box className={classes.perfRow}>
                  <Typography className={classes.perfLabel}>Fotogramas analizados</Typography>
                  <Typography className={classes.perfValue}>{displayPerf.frameCount}</Typography>
                </Box>
              </Paper>
            </Box>
          </Box>

          {/* Right column: counters + score */}
          <Box className={classes.rightCol}>
            {/* Score panel */}
            <Paper className={classes.panel}>
              <Typography className={classes.panelTitle}>Índice de atención</Typography>
              <Box style={{ textAlign: 'center', padding: '2px 0' }}>
                <Typography className={classes.scoreIndex} style={{ color: levelColor }}>
                  {attentionIndex}
                </Typography>
                <Chip
                  label={levelLabel}
                  className={classes.levelChip}
                  size="small"
                  style={{ background: levelColor, color: '#fff', marginTop: 4 }}
                />
              </Box>
              <Divider style={{ background: '#222235', margin: '6px 0' }} />
              <Box className={classes.counter}>
                <Typography className={classes.counterLabel}>Ojos (ventana 10s)</Typography>
                <Typography className={classes.counterValue}>{displayComponents.eyes}</Typography>
              </Box>
              <Box className={classes.counter}>
                <Typography className={classes.counterLabel}>Postura (manual)</Typography>
                <Typography className={classes.counterValue}>{displayComponents.posture}</Typography>
              </Box>
              <Box className={classes.counter}>
                <Typography className={classes.counterLabel}>Cabeza (ventana 10s)</Typography>
                <Typography className={classes.counterValue}>{displayComponents.head}</Typography>
              </Box>
            </Paper>

            {/* Live counters */}
            <Paper className={classes.panel}>
              <Typography className={classes.panelTitle}>Contadores en vivo</Typography>

              <Box className={classes.counter}>
                <Typography className={classes.counterLabel}>Parpadeos</Typography>
                <Typography className={classes.counterValue}>{displayAnalysis.blink.count}</Typography>
              </Box>
              <Box className={classes.counter}>
                <Typography className={classes.counterLabel} style={{ fontSize: 10, color: '#6b6b8a' }}>
                  eyeBlink crudo (umbral {blinkThreshold.toFixed(2)})
                </Typography>
                <Typography className={classes.counterValue} style={{ fontSize: 11, color: '#6b6b8a' }}>
                  {displayAnalysis.lastBlinkValue.toFixed(2)}
                </Typography>
              </Box>

              <Box className={classes.counter}>
                <Typography className={classes.counterLabel}>Bostezos</Typography>
                <Typography className={classes.counterValue}>{displayAnalysis.yawn.count}</Typography>
              </Box>
              <Box className={classes.counter}>
                <Typography className={classes.counterLabel} style={{ fontSize: 10, color: '#6b6b8a' }}>
                  jawOpen crudo (umbral {JAW_OPEN_THRESHOLD.toFixed(2)})
                </Typography>
                <Typography className={classes.counterValue} style={{ fontSize: 11, color: '#6b6b8a' }}>
                  {displayAnalysis.lastJawValue.toFixed(2)}
                </Typography>
              </Box>

              <Divider style={{ background: '#222235', margin: '5px 0' }} />

              <Box className={classes.counter}>
                <Typography className={classes.counterLabel}>Foco perdido — eventos</Typography>
                <Typography className={classes.counterValue}>{displayAnalysis.focusLost.count}</Typography>
              </Box>
              <Box className={classes.counter}>
                <Typography className={classes.counterLabel}>Foco perdido — duración</Typography>
                <Typography className={classes.counterValue}>
                  {fmtMs2(displayAnalysis.focusLost.totalLostMs)}
                </Typography>
              </Box>

              <Divider style={{ background: '#222235', margin: '5px 0' }} />

              <Box className={classes.counter}>
                <Typography className={classes.counterLabel}>Rostro ausente — duración</Typography>
                <Typography className={classes.counterValue}>{fmtMs2(displayAnalysis.absentMs)}</Typography>
              </Box>

              <Box className={classes.counter}>
                <Typography className={classes.counterLabel}>Múltiples rostros</Typography>
                <Typography
                  className={classes.counterValue}
                  style={{ color: displayAnalysis.multiface ? '#ef4444' : '#22c55e' }}
                >
                  {displayAnalysis.multiface ? 'SÍ' : 'No'}
                </Typography>
              </Box>

              <Divider style={{ background: '#222235', margin: '5px 0' }} />

              {/* Key indicator: head turned but gaze on screen */}
              <Box style={{ marginTop: 4 }}>
                <Typography className={classes.panelTitle} style={{ marginBottom: 4 }}>
                  Indicador clave
                </Typography>
                <Box
                  style={{
                    background: displayAnalysis.headTurnedButGazingScreen ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    border: `1px solid ${displayAnalysis.headTurnedButGazingScreen ? '#3b82f6' : '#222235'}`,
                    borderRadius: 6,
                    padding: '5px 10px',
                  }}
                >
                  <Typography style={{ fontSize: 12, color: '#a0a0c0', marginBottom: 2 }}>
                    Cabeza girada pero mirando a pantalla
                  </Typography>
                  <Typography
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      color: displayAnalysis.headTurnedButGazingScreen ? '#3b82f6' : '#6b6b8a',
                    }}
                  >
                    {displayAnalysis.headTurnedButGazingScreen ? 'DETECTADO' : 'No'}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
