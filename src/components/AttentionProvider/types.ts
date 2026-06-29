export type AttentionLevel = 'high' | 'medium' | 'low';

/** score <= lowMax → 'low'; score <= mediumMax → 'medium'; else → 'high' */
export interface AttentionRanges {
  lowMax: number;
  mediumMax: number;
}

/** Individual attention signal components, each scored 0-100. */
export interface AttentionComponents {
  eyes: number;
  posture: number;
  head: number;
}

/** Attention data for the local user (self). */
export interface SelfAttention {
  /** Aggregate 0-100 index, computed via computeAttentionIndex(components). */
  index: number;
  components: AttentionComponents;
  /** Whether local camera analysis is currently running. */
  capture: 'active' | 'inactive';
  /** Lighting quality detected by the local analysis. */
  lighting: 'ok' | 'low';
}

/** Attention snapshot for a single remote participant. */
export interface ParticipantAttention {
  /** Maps to the Twilio participant identity string. */
  identity: string;
  /** Aggregate attention index 0-100 (latest sample). */
  index: number;
  level: AttentionLevel;
  /** Proctoring flag: more than one face detected in frame. */
  multiface: boolean;
  /** True when the participant's camera is off (no attention data; value is stale/absent). */
  cameraOff: boolean;
  /**
   * Faces detected in the latest sample. `0` means the CV pipeline could not
   * find the participant's face (turned away, bad lighting/angle, GPU failure),
   * so `index` is a decayed-to-0 placeholder, NOT a real "0% attention". The UI
   * must render "sin medición" instead of 0, and the group average excludes them.
   * Optional: absent in ad-hoc fixtures, where consumers treat it as measured.
   */
  faces?: number;
  /**
   * True when the participant's device cannot run the CV pipeline at all (mobile —
   * the pipeline is desktop-only). Distinct from cameraOff/no-face: the student is
   * present and fine, the DEVICE just can't measure. UI shows "No medible (celular)".
   */
  unsupported?: boolean;
  /**
   * Session history of the index, accumulated at the sampling cadence while the
   * camera is on. Optional: present on live data and the mock; absent in ad-hoc
   * fixtures, where consumers fall back to `index`.
   */
  indexMin?: number;
  indexMax?: number;
  /** Time-averaged index over the session (rounded). */
  indexAvg?: number;
}

/** A single data point on the group-attention timeline (for recharts). */
export interface AttentionTimelinePoint {
  time: string;
  value: number;
}

/** A proctoring event detected for a participant. */
export interface ProctoringAlert {
  id: string;
  identity: string;
  kind: 'multiface' | 'absent' | 'away' | 'camera-off';
  detectedAt: string;
  /** Confidence score 0-1. */
  confidence: number;
}

/** Full attention snapshot for the session. */
export interface AttentionData {
  /** 'mock' until the CV pipeline (EP04/05/06) is wired; 'live' thereafter. */
  source: 'mock' | 'live';
  ranges: AttentionRanges;
  /** Session-wide aggregate attention index 0-100. */
  groupAttention: number;
  /**
   * False when the live pipeline has zero measured (camera-on, reachable)
   * participants right now — i.e. `groupAttention` is a placeholder, not a real
   * reading (low connection, everyone camera-off, no students). Consumers must
   * render "sin datos" instead of "0" and must NOT raise the below-threshold
   * alarm. Always true for the mock.
   */
  groupDataAvailable: boolean;
  /** Scores below this are flagged as "group below threshold". */
  attentionThreshold: number;
  /** Group attention over time, ready for recharts. */
  timeline: AttentionTimelinePoint[];
  self: SelfAttention;
  participants: ParticipantAttention[];
  proctoringAlerts: ProctoringAlert[];
}

/** Everything the context exposes to consumers. */
export interface AttentionContextValue extends AttentionData {
  /** Maps a 0-100 score to a level using the configured ranges. */
  attentionLevel(score: number): AttentionLevel;
}
