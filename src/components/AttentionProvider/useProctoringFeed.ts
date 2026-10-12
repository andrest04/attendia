import { MutableRefObject, useEffect, useRef, useState } from 'react';
import { RemoteAttention } from '../../hooks/useAttentionTelemetry/useAttentionTelemetry';
import { ProctoringAlert } from './types';
import { formatTimeLabel, initialProctoringState, ProctoringState, stepProctoring } from './liveAttention';

// How often (ms) the remote telemetry is sampled to look for proctoring events.
// Aligned with the 1 Hz capture/telemetry cadence.
const PROCTORING_SAMPLE_MS = 1000;

/**
 * The live proctoring feed: samples the remote telemetry once per second while the pipeline is
 * active and appends debounced events to a capped log (see stepProctoring for the rules). The
 * log is reset whenever the pipeline goes back to the fallback. `remoteAttention` is read
 * through a ref so the interval always sees fresh telemetry.
 */
export default function useProctoringFeed(
  remoteAttention: MutableRefObject<RemoteAttention[]>,
  isActive: boolean
): ProctoringAlert[] {
  const [alerts, setAlerts] = useState<ProctoringAlert[]>([]);
  const stateRef = useRef<ProctoringState>(initialProctoringState());

  useEffect(() => {
    if (!isActive) {
      stateRef.current = initialProctoringState();
      setAlerts([]);
      return;
    }

    const sample = () => {
      const { state, changed } = stepProctoring(stateRef.current, remoteAttention.current, formatTimeLabel(new Date()));
      stateRef.current = state;
      if (changed) setAlerts(state.log);
    };

    const id = window.setInterval(sample, PROCTORING_SAMPLE_MS);
    return () => window.clearInterval(id);
  }, [isActive, remoteAttention]);

  return alerts;
}
