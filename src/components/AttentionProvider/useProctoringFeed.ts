import { MutableRefObject, useEffect, useRef, useState } from 'react';
import { RemoteAttention } from '../../hooks/useAttentionTelemetry/useAttentionTelemetry';
import { ProctoringAlert } from './types';
import { formatTimeLabel, initialProctoringState, ProctoringState, stepProctoring } from './liveAttention';
import { AttentionSeed, mergeProctoringLog } from './liveSnapshot';

// How often (ms) the remote telemetry is sampled to look for proctoring events.
// Aligned with the 1 Hz capture/telemetry cadence.
const PROCTORING_SAMPLE_MS = 1000;

export interface ProctoringFeed {
  /** Live feed: alerts within ALERT_TTL_MS. */
  alerts: ProctoringAlert[];
  /** Full capped log, never expired — for the persisted report. */
  log: ProctoringAlert[];
}

const EMPTY_FEED: ProctoringFeed = { alerts: [], log: [] };

/**
 * The live proctoring feed: samples the remote telemetry once per second while the pipeline is
 * active and appends debounced events to a capped log (see stepProctoring for the rules). The
 * log is reset whenever the pipeline goes back to the fallback. `remoteAttention` is read
 * through a ref so the interval always sees fresh telemetry. A restored `seed` (owner teacher
 * re-entering a running class) contributes its events to the log only: they are history, never
 * live alerts.
 */
export default function useProctoringFeed(
  remoteAttention: MutableRefObject<RemoteAttention[]>,
  isActive: boolean,
  seed: AttentionSeed | null = null
): ProctoringFeed {
  const [feed, setFeed] = useState<ProctoringFeed>(EMPTY_FEED);
  const stateRef = useRef<ProctoringState>(initialProctoringState());

  useEffect(() => {
    if (!isActive) {
      stateRef.current = initialProctoringState();
      setFeed(EMPTY_FEED);
      return;
    }

    const sample = () => {
      const nowMs = Date.now();
      const { state, changed } = stepProctoring(
        stateRef.current,
        remoteAttention.current,
        formatTimeLabel(new Date(nowMs)),
        nowMs
      );
      stateRef.current = state;
      // Every tick re-evaluates expiry too, so alerts vanish without new events.
      if (changed) setFeed({ alerts: state.visible, log: state.log });
    };

    const id = window.setInterval(sample, PROCTORING_SAMPLE_MS);
    return () => window.clearInterval(id);
  }, [isActive, remoteAttention]);

  useEffect(() => {
    if (!seed || !isActive) return;
    const log = mergeProctoringLog(seed.proctoringLog, stateRef.current.log);
    stateRef.current = { ...stateRef.current, log };
    setFeed({ alerts: stateRef.current.visible, log });
  }, [seed, isActive]);

  return feed;
}
